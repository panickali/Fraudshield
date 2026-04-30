"""
FraudShield ML Service - FastAPI microservice for fraud scoring
Trains a Random Forest on synthetic data at startup if no model exists.
"""
import os
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_PATH = Path("/tmp/fraud_model.joblib")
ENCODER_PATH = Path("/tmp/label_encoders.joblib")

# ── Feature schema ─────────────────────────────────────────────────────────────
FEATURE_COLS = [
    "amount", "amount_log", "hour_of_day", "day_of_week", "is_weekend",
    "is_night", "txn_count_1min", "txn_count_1hr", "txn_count_24hr",
    "merchant_cat_encoded", "is_new_merchant", "device_match",
    "amount_vs_avg_ratio", "time_since_last_txn_sec"
]

MERCHANT_CATS = [
    "retail", "food", "electronics", "travel", "crypto_exchange",
    "gambling", "jewelry", "atm", "transfer", "utilities", "healthcare",
    "entertainment", "fuel", "grocery"
]

HIGH_RISK_CATS = {"crypto_exchange", "gambling", "atm", "transfer"}

# ── Synthetic data generator ───────────────────────────────────────────────────
def generate_training_data(n_samples: int = 50000):
    np.random.seed(42)
    rng = np.random.default_rng(42)
    fraud_ratio = 0.035
    n_fraud = int(n_samples * fraud_ratio)
    n_legit = n_samples - n_fraud

    def make_legit(n):
        cats = rng.choice(MERCHANT_CATS, n)
        amounts = np.abs(rng.lognormal(8.5, 1.2, n))
        hours = rng.choice(range(8, 22), n)
        return pd.DataFrame({
            "amount": amounts,
            "amount_log": np.log1p(amounts),
            "hour_of_day": hours,
            "day_of_week": rng.integers(0, 7, n),
            "is_weekend": (rng.integers(0, 7, n) >= 5).astype(int),
            "is_night": 0,
            "txn_count_1min": rng.integers(1, 3, n),
            "txn_count_1hr": rng.integers(1, 8, n),
            "txn_count_24hr": rng.integers(1, 20, n),
            "merchant_cat_encoded": [MERCHANT_CATS.index(c) if c in MERCHANT_CATS else 0 for c in cats],
            "is_new_merchant": rng.integers(0, 2, n),
            "device_match": rng.integers(0, 2, n),
            "amount_vs_avg_ratio": rng.uniform(0.5, 2.0, n),
            "time_since_last_txn_sec": rng.uniform(60, 86400, n),
            "label": 0
        })

    def make_fraud(n):
        cats = rng.choice(list(HIGH_RISK_CATS) + ["electronics", "jewelry"], n)
        amounts = np.abs(rng.lognormal(10.5, 1.8, n))
        hours = rng.choice(list(range(0, 5)) + list(range(22, 24)), n)
        return pd.DataFrame({
            "amount": amounts,
            "amount_log": np.log1p(amounts),
            "hour_of_day": hours,
            "day_of_week": rng.integers(0, 7, n),
            "is_weekend": (rng.integers(0, 7, n) >= 5).astype(int),
            "is_night": 1,
            "txn_count_1min": rng.integers(5, 15, n),
            "txn_count_1hr": rng.integers(10, 40, n),
            "txn_count_24hr": rng.integers(15, 60, n),
            "merchant_cat_encoded": [MERCHANT_CATS.index(c) if c in MERCHANT_CATS else 0 for c in cats],
            "is_new_merchant": 1,
            "device_match": 0,
            "amount_vs_avg_ratio": rng.uniform(3.0, 15.0, n),
            "time_since_last_txn_sec": rng.uniform(1, 120, n),
            "label": 1
        })

    df = pd.concat([make_legit(n_legit), make_fraud(n_fraud)], ignore_index=True)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    return df

# ── Train model ────────────────────────────────────────────────────────────────
def train_model():
    logger.info("Generating 50k synthetic training samples...")
    df = generate_training_data(50000)
    X = df[FEATURE_COLS]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=14,
        class_weight="balanced",
        n_jobs=-1,
        random_state=42
    )
    logger.info("Training Random Forest...")
    model.fit(X_train, y_train)

    y_prob = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, y_prob)
    logger.info(f"Model AUC-ROC: {auc:.4f}")

    joblib.dump(model, MODEL_PATH)
    logger.info(f"Model saved to {MODEL_PATH}")
    return model

# ── Load or train ──────────────────────────────────────────────────────────────
model = None

def get_model():
    global model
    if model is None:
        if MODEL_PATH.exists():
            logger.info("Loading existing model...")
            model = joblib.load(MODEL_PATH)
        else:
            model = train_model()
    return model

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(title="FraudShield ML Service")

class ScoreRequest(BaseModel):
    amount: float
    hour_of_day: int
    day_of_week: int
    is_weekend: int
    is_night: int
    txn_count_1min: int
    txn_count_1hr: int
    txn_count_24hr: int
    merchant_category: str
    is_new_merchant: int
    device_match: int
    amount_vs_avg_ratio: float
    time_since_last_txn_sec: float

class ScoreResponse(BaseModel):
    fraud_score: float
    model_version: str = "rf_v1"

@app.on_event("startup")
async def startup():
    get_model()
    logger.info("ML service ready")

@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": model is not None}

@app.post("/score", response_model=ScoreResponse)
async def score(req: ScoreRequest):
    m = get_model()
    cat_enc = MERCHANT_CATS.index(req.merchant_category) if req.merchant_category in MERCHANT_CATS else 0
    features = np.array([[
        req.amount,
        np.log1p(req.amount),
        req.hour_of_day,
        req.day_of_week,
        req.is_weekend,
        req.is_night,
        req.txn_count_1min,
        req.txn_count_1hr,
        req.txn_count_24hr,
        cat_enc,
        req.is_new_merchant,
        req.device_match,
        req.amount_vs_avg_ratio,
        req.time_since_last_txn_sec
    ]])
    score = float(m.predict_proba(features)[0][1])
    return ScoreResponse(fraud_score=round(score, 4))

@app.get("/model-info")
async def model_info():
    m = get_model()
    importances = dict(zip(FEATURE_COLS, m.feature_importances_.tolist()))
    return {
        "n_estimators": m.n_estimators,
        "feature_importances": importances,
        "n_features": len(FEATURE_COLS),
        "merchant_categories": MERCHANT_CATS
    }
