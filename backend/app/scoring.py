"""
Score aggregator: combines rule engine flags + ML score into a final decision.
"""
import httpx
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple
from app.rule_engine import (
    evaluate_rules, get_velocity_counts, get_user_avg_amount,
    update_user_avg_amount, increment_velocity, get_last_location
)
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)

MERCHANT_CATS = [
    "retail", "food", "electronics", "travel", "crypto_exchange",
    "gambling", "jewelry", "atm", "transfer", "utilities", "healthcare",
    "entertainment", "fuel", "grocery"
]

def score_to_risk_level(score: float) -> str:
    if score < 0.3:
        return "low"
    elif score < 0.6:
        return "medium"
    elif score < 0.85:
        return "high"
    return "critical"

def score_to_decision(score: float, flags: List[str]) -> str:
    if score >= 0.85 or (score >= 0.6 and len(flags) >= 3):
        return "block"
    elif score >= 0.5 or len(flags) >= 2:
        return "review"
    return "allow"

async def score_transaction(txn: Dict[str, Any]) -> Dict[str, Any]:
    start = time.time()
    settings = get_settings()
    
    user_id   = txn["user_id"]
    amount    = txn["amount"]
    merchant  = txn.get("merchant_category", "retail")
    ts        = datetime.fromisoformat(txn.get("timestamp", datetime.now(timezone.utc).isoformat()).replace("Z", "+00:00"))
    hour      = ts.hour
    dow       = ts.weekday()

    # Parallel: velocity + avg
    vel        = await get_velocity_counts(user_id)
    avg_amount = await get_user_avg_amount(user_id)
    last_loc   = await get_last_location(user_id)

    # Enrich txn with derived fields before rule evaluation
    txn_enriched = {**txn, "hour_of_day": hour}

    # Evaluate rules (also updates Redis state)
    rule_flags = await evaluate_rules(txn_enriched)

    # Update velocity counter
    await increment_velocity(user_id)
    await update_user_avg_amount(user_id, amount)

    # Build ML feature vector
    is_new_merchant = 1 if "new_merchant" in rule_flags else 0
    device_match    = 0 if "unknown_device" in rule_flags else 1
    amount_ratio    = amount / max(avg_amount, 1.0)
    
    # Time since last txn (from last location timestamp as proxy)
    time_since = 3600.0  # default 1hr
    if last_loc and last_loc.get("ts"):
        time_since = max(1.0, time.time() - float(last_loc["ts"]))

    ml_features = {
        "amount": amount,
        "hour_of_day": hour,
        "day_of_week": dow,
        "is_weekend": 1 if dow >= 5 else 0,
        "is_night": 1 if (hour <= 5 or hour >= 23) else 0,
        "txn_count_1min": vel["count_1min"] + 1,
        "txn_count_1hr":  vel["count_1hr"] + 1,
        "txn_count_24hr": vel["count_24hr"] + 1,
        "merchant_category": merchant,
        "is_new_merchant": is_new_merchant,
        "device_match": device_match,
        "amount_vs_avg_ratio": min(amount_ratio, 20.0),
        "time_since_last_txn_sec": min(time_since, 86400.0),
    }

    # Call ML service
    ml_score = 0.1
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(f"{settings.ml_service_url}/score", json=ml_features)
            if resp.status_code == 200:
                ml_score = resp.json()["fraud_score"]
    except Exception as e:
        logger.warning(f"ML service error: {e}, using rule-based fallback")
        # Fallback: derive score from rules
        ml_score = min(0.3 + len(rule_flags) * 0.15, 0.95)

    # Boost score if critical rules fire
    critical_flags = {"geo_anomaly", "velocity_exceeded", "unknown_device"}
    boost = sum(0.08 for f in rule_flags if f in critical_flags)
    final_score = min(ml_score + boost, 1.0)

    risk_level = score_to_risk_level(final_score)
    decision   = score_to_decision(final_score, rule_flags)
    latency_ms = int((time.time() - start) * 1000)

    return {
        "fraud_score": round(final_score, 4),
        "ml_score":    round(ml_score, 4),
        "risk_level":  risk_level,
        "decision":    decision,
        "rule_flags":  rule_flags,
        "processing_ms": latency_ms,
        "model_version": "rf_v1"
    }
