# FraudShield — Real-time Financial Fraud Detection

Production-ready fraud detection SaaS built with FastAPI, Kafka, PostgreSQL, Redis, and React.

## Quick Start (Full Stack)

```bash
# 1. Clone and enter the project
cd fraudshield

# 2. Start everything with Docker Compose
docker-compose up --build

# Services:
# ├── PostgreSQL      → localhost:5432
# ├── Kafka           → localhost:9092
# ├── Redis           → localhost:6379
# ├── ML Service      → localhost:8001
# ├── API             → localhost:8000
# └── Dashboard       → localhost:3000
```

The data generator seeds 7 days of historical transactions automatically, then streams live ones every 0.5–3s.

## Architecture

```
Client → API (FastAPI) → Kafka → Consumer (Python)
                    ↓                      ↓
               ML Service          Rule Engine (Redis)
                    ↓                      ↓
               PostgreSQL ←── Score Aggregator
                    ↑
              React Dashboard
```

## API Reference

Base URL: `http://localhost:8000`
Auth: `Authorization: Bearer demo_key_fraudshield_2024`

### Score a Transaction
```bash
curl -X POST http://localhost:8000/v1/transaction \
  -H "Authorization: Bearer demo_key_fraudshield_2024" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "usr_001",
    "amount": 89999,
    "merchant_category": "crypto_exchange",
    "merchant_id": "merch_newcrypto",
    "device_id": "dev_unknown",
    "lat": 51.5074,
    "lon": -0.1278
  }'
```

Response:
```json
{
  "transaction_id": "txn_abc123",
  "fraud_score": 0.923,
  "risk_level": "critical",
  "decision": "block",
  "rule_flags": ["geo_anomaly", "new_merchant", "unknown_device", "high_amount"],
  "processing_ms": 134,
  "model_version": "rf_v1"
}
```

### Get Alerts
```bash
curl "http://localhost:8000/v1/alerts?severity=critical&status=open" \
  -H "Authorization: Bearer demo_key_fraudshield_2024"
```

### User Risk Profile
```bash
curl http://localhost:8000/v1/user-risk-score/usr_001 \
  -H "Authorization: Bearer demo_key_fraudshield_2024"
```

### Dashboard Stats
```bash
curl http://localhost:8000/v1/dashboard/stats \
  -H "Authorization: Bearer demo_key_fraudshield_2024"
```

### Live SSE Stream
```bash
curl -N http://localhost:8000/v1/stream \
  -H "Authorization: Bearer demo_key_fraudshield_2024"
```

## ML Model

- **Algorithm**: Random Forest (200 trees, max_depth=14, class_weight=balanced)
- **Training data**: 50,000 synthetic transactions (96.5% legit, 3.5% fraud)
- **Features**: amount, velocity counters, hour/day, merchant category, device match, geo distance, amount vs user average
- **Typical AUC-ROC**: ~0.94+
- **Inference latency**: <10ms

## Risk Scoring Logic

```
final_score = ml_score + boost_from_critical_rules
risk_level  = low (<0.3) | medium (<0.6) | high (<0.85) | critical (≥0.85)
decision    = allow | review | block
```

Rule flags: `velocity_exceeded`, `high_amount`, `new_merchant`, `night_transaction`, `geo_anomaly`, `unknown_device`

## Development (without Docker)

```bash
# Backend
cd backend
pip install -r requirements.txt

# Start services (requires local Kafka + PostgreSQL + Redis)
export DATABASE_URL=postgresql://fraudshield:fraudshield_secret@localhost:5432/fraudshield
uvicorn app.ml_service:app --port 8001 &
uvicorn app.main:app --port 8000 &
python -m app.data_generator &

# Frontend
cd frontend
npm install
npm run dev
```

## AWS Deployment

```bash
# Push images to ECR
aws ecr create-repository --repository-name fraudshield-api
aws ecr create-repository --repository-name fraudshield-ml

docker tag fraudshield-api:latest <ECR_URI>/fraudshield-api:latest
docker push <ECR_URI>/fraudshield-api:latest

# Use ECS Fargate task definitions with these images
# RDS PostgreSQL (db.t3.medium)
# ElastiCache Redis (cache.t3.micro)
# MSK Kafka (kafka.t3.small)
# CloudFront + S3 for frontend
```

## Stack

| Layer | Tech |
|---|---|
| API | FastAPI + uvicorn |
| ML | scikit-learn Random Forest + joblib |
| Streaming | Apache Kafka (Confluent) |
| Rules | Redis velocity counters |
| Database | PostgreSQL 15 |
| Frontend | React + Vite + Recharts |
| Fonts | Syne + Space Mono |
| Infra | Docker Compose → AWS ECS Fargate |
