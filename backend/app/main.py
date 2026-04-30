"""
FraudShield API - Main FastAPI application

FIXES:
  1. serialize() converts datetime/Decimal/asyncpg Records to JSON-safe types
  2. All endpoints use serialize() - fixes 500 errors on /dashboard/stats
  3. SSE stream uses proper timestamptz cursor and converts rule_flags list correctly
  4. UUID casting explicit ($1::uuid) to avoid asyncpg type errors
  5. StreamingResponse has CORS + no-cache headers for SSE
"""
import uuid
import json
import asyncio
import logging
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional, List, Any

from fastapi import FastAPI, HTTPException, Header, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.database import get_db, get_pool, close_pool
from app.scoring import score_transaction
from app.config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── Serialization ──────────────────────────────────────────────────────────────
def serialize(obj: Any) -> Any:
    """Recursively convert asyncpg types to JSON-safe Python types."""
    if obj is None:
        return None
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, list):
        return [serialize(i) for i in obj]
    if isinstance(obj, dict):
        return {k: serialize(v) for k, v in obj.items()}
    return obj

def rows_to_json(rows) -> list:
    return [serialize(dict(r)) for r in rows]

def row_to_json(row) -> dict:
    return serialize(dict(row)) if row else {}


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="FraudShield API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await get_pool()
    logger.info("API service started")

@app.on_event("shutdown")
async def shutdown():
    await close_pool()


# ── Auth ───────────────────────────────────────────────────────────────────────
async def get_tenant(authorization: str = Header(...)):
    key = authorization.replace("Bearer ", "").strip()
    async with get_db() as db:
        row = await db.fetchrow(
            "SELECT id, name FROM tenants WHERE api_key = $1", key
        )
        if not row:
            raise HTTPException(status_code=401, detail="Invalid API key")
        return {"id": str(row["id"]), "name": row["name"]}


# ── Models ─────────────────────────────────────────────────────────────────────
class TransactionRequest(BaseModel):
    transaction_id: str = Field(default_factory=lambda: f"txn_{uuid.uuid4().hex[:8]}")
    user_id: str
    amount: float
    currency: str = "INR"
    merchant_id: Optional[str] = None
    merchant_category: str = "retail"
    device_id: Optional[str] = None
    ip_address: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    timestamp: Optional[str] = None

class TransactionResponse(BaseModel):
    transaction_id: str
    fraud_score: float
    risk_level: str
    decision: str
    rule_flags: List[str]
    processing_ms: int
    model_version: str


# ── POST /v1/transaction ───────────────────────────────────────────────────────
@app.post("/v1/transaction", response_model=TransactionResponse)
async def score_transaction_endpoint(
    body: TransactionRequest,
    tenant: dict = Depends(get_tenant)
):
    ts = body.timestamp or datetime.now(timezone.utc).isoformat()
    txn_dict = {**body.model_dump(), "timestamp": ts, "tenant_id": tenant["id"]}

    result = await score_transaction(txn_dict)

    async with get_db() as db:
        await db.execute("""
            INSERT INTO transactions
              (transaction_id, tenant_id, user_id, amount, currency,
               merchant_id, merchant_category, device_id, ip_address,
               lat, lon, fraud_score, risk_level, decision,
               rule_flags, model_version, processing_ms, created_at)
            VALUES ($1,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            ON CONFLICT (transaction_id) DO NOTHING
        """,
            body.transaction_id, tenant["id"], body.user_id,
            body.amount, body.currency, body.merchant_id, body.merchant_category,
            body.device_id, body.ip_address, body.lat, body.lon,
            result["fraud_score"], result["risk_level"], result["decision"],
            result["rule_flags"], result["model_version"], result["processing_ms"],
            datetime.fromisoformat(ts.replace("Z", "+00:00"))
        )
        if result["risk_level"] in ("high", "critical"):
            await db.execute("""
                INSERT INTO alerts
                  (transaction_id, tenant_id, user_id, severity, fraud_score,
                   rule_flags, amount, merchant_category)
                VALUES ($1,$2::uuid,$3,$4,$5,$6,$7,$8)
            """,
                body.transaction_id, tenant["id"], body.user_id,
                result["risk_level"], result["fraud_score"],
                result["rule_flags"], body.amount, body.merchant_category
            )

    return TransactionResponse(
        transaction_id=body.transaction_id,
        fraud_score=result["fraud_score"],
        risk_level=result["risk_level"],
        decision=result["decision"],
        rule_flags=result["rule_flags"],
        processing_ms=result["processing_ms"],
        model_version=result["model_version"],
    )


# ── GET /v1/alerts ─────────────────────────────────────────────────────────────
@app.get("/v1/alerts")
async def get_alerts(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    tenant: dict = Depends(get_tenant)
):
    offset = (page - 1) * limit
    conditions = ["tenant_id = $1::uuid"]
    params: list = [tenant["id"]]
    idx = 2
    if severity:
        conditions.append(f"severity = ${idx}"); params.append(severity); idx += 1
    if status:
        conditions.append(f"status = ${idx}"); params.append(status); idx += 1

    where = " AND ".join(conditions)
    async with get_db() as db:
        rows = await db.fetch(f"""
            SELECT id::text, transaction_id, user_id, severity, status,
                   fraud_score, rule_flags, amount, merchant_category,
                   created_at, resolved_at
            FROM alerts WHERE {where}
            ORDER BY created_at DESC LIMIT {limit} OFFSET {offset}
        """, *params)
        total = await db.fetchval(f"SELECT COUNT(*) FROM alerts WHERE {where}", *params)

    return {"alerts": rows_to_json(rows), "total": total, "page": page, "limit": limit}


# ── PATCH /v1/alerts/:id/resolve ──────────────────────────────────────────────
@app.patch("/v1/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, tenant: dict = Depends(get_tenant)):
    async with get_db() as db:
        result = await db.execute("""
            UPDATE alerts SET status = 'resolved', resolved_at = NOW()
            WHERE id = $1::uuid AND tenant_id = $2::uuid
        """, alert_id, tenant["id"])
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "resolved"}


# ── GET /v1/user-risk-score/:user_id ──────────────────────────────────────────
@app.get("/v1/user-risk-score/{user_id}")
async def get_user_risk(user_id: str, tenant: dict = Depends(get_tenant)):
    async with get_db() as db:
        row = await db.fetchrow("""
            SELECT
                COUNT(*)                                     AS txn_count_30d,
                COUNT(*) FILTER (WHERE fraud_score > 0.6)   AS flagged_30d,
                ROUND(AVG(fraud_score)::numeric, 3)         AS avg_score,
                ROUND(MAX(fraud_score)::numeric, 3)         AS max_score,
                COALESCE(SUM(amount), 0)                    AS total_amount,
                ROUND(AVG(amount)::numeric, 2)              AS avg_amount,
                MAX(created_at)                             AS last_txn_at
            FROM transactions
            WHERE user_id = $1 AND tenant_id = $2::uuid
              AND created_at > NOW() - INTERVAL '30 days'
        """, user_id, tenant["id"])

        if not row or row["txn_count_30d"] == 0:
            raise HTTPException(status_code=404, detail="User not found")

        avg_score = float(row["avg_score"] or 0)
        risk_tier = (
            "critical" if avg_score >= 0.85 else
            "high"     if avg_score >= 0.6  else
            "medium"   if avg_score >= 0.3  else "low"
        )
        return {
            "user_id": user_id,
            "risk_score_30d": avg_score,
            "max_score_30d": float(row["max_score"] or 0),
            "risk_tier": risk_tier,
            "txn_count_30d": int(row["txn_count_30d"]),
            "flagged_count_30d": int(row["flagged_30d"]),
            "total_amount_30d": float(row["total_amount"] or 0),
            "avg_amount_30d": float(row["avg_amount"] or 0),
            "last_txn_at": row["last_txn_at"].isoformat() if row["last_txn_at"] else None,
        }


# ── GET /v1/dashboard/stats ────────────────────────────────────────────────────
@app.get("/v1/dashboard/stats")
async def dashboard_stats(tenant: dict = Depends(get_tenant)):
    tid = tenant["id"]
    async with get_db() as db:
        stats = await db.fetchrow("""
            SELECT
                COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '24 hours')                          AS txn_24h,
                COUNT(*) FILTER (WHERE fraud_score>0.6 AND created_at>NOW()-INTERVAL '24 hours')        AS fraud_24h,
                ROUND(AVG(fraud_score) FILTER (WHERE created_at>NOW()-INTERVAL '24 hours')::numeric,3)  AS avg_score_24h,
                COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '1 hour')                            AS txn_1h,
                COALESCE(SUM(amount) FILTER (WHERE created_at>NOW()-INTERVAL '24 hours'),0)             AS volume_24h,
                COUNT(*) FILTER (WHERE risk_level='critical' AND created_at>NOW()-INTERVAL '24 hours')  AS critical_24h,
                COUNT(*)                                                                                 AS total_all_time
            FROM transactions WHERE tenant_id=$1::uuid
        """, tid)

        hourly = await db.fetch("""
            SELECT date_trunc('hour', created_at)          AS hour,
                   COUNT(*)                                AS total,
                   COUNT(*) FILTER (WHERE fraud_score>0.6) AS fraud,
                   ROUND(AVG(fraud_score)::numeric,3)      AS avg_score
            FROM transactions
            WHERE tenant_id=$1::uuid AND created_at>NOW()-INTERVAL '24 hours'
            GROUP BY 1 ORDER BY 1
        """, tid)

        dist = await db.fetch("""
            SELECT CASE WHEN fraud_score<0.3 THEN 'low'
                        WHEN fraud_score<0.6 THEN 'medium'
                        WHEN fraud_score<0.85 THEN 'high'
                        ELSE 'critical' END AS bucket,
                   COUNT(*) AS count
            FROM transactions
            WHERE tenant_id=$1::uuid AND created_at>NOW()-INTERVAL '24 hours'
            GROUP BY 1
        """, tid)

        top_users = await db.fetch("""
            SELECT user_id,
                   COUNT(*)                             AS flag_count,
                   ROUND(MAX(fraud_score)::numeric,3)   AS max_score
            FROM transactions
            WHERE tenant_id=$1::uuid AND fraud_score>0.6 AND created_at>NOW()-INTERVAL '24 hours'
            GROUP BY user_id ORDER BY flag_count DESC LIMIT 5
        """, tid)

        cat_breakdown = await db.fetch("""
            SELECT merchant_category,
                   COUNT(*)                                   AS count,
                   ROUND(AVG(fraud_score)::numeric,3)         AS avg_score,
                   COUNT(*) FILTER (WHERE fraud_score>0.6)    AS fraud_count
            FROM transactions
            WHERE tenant_id=$1::uuid AND created_at>NOW()-INTERVAL '24 hours'
            GROUP BY 1 ORDER BY fraud_count DESC LIMIT 8
        """, tid)

    return {
        "summary":          row_to_json(stats),
        "hourly":           rows_to_json(hourly),      # datetime 'hour' → isoformat
        "score_distribution": rows_to_json(dist),
        "top_flagged_users":  rows_to_json(top_users),
        "category_breakdown": rows_to_json(cat_breakdown),
    }


# ── GET /v1/transactions ───────────────────────────────────────────────────────
@app.get("/v1/transactions")
async def get_transactions(
    risk_level: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    tenant: dict = Depends(get_tenant)
):
    offset = (page - 1) * limit
    conditions = ["tenant_id = $1::uuid"]
    params: list = [tenant["id"]]
    if risk_level:
        params.append(risk_level)
        conditions.append(f"risk_level = ${len(params)}")
    where = " AND ".join(conditions)

    async with get_db() as db:
        rows = await db.fetch(f"""
            SELECT transaction_id, user_id, amount, currency, merchant_category,
                   fraud_score, risk_level, decision, rule_flags, processing_ms, created_at
            FROM transactions WHERE {where}
            ORDER BY created_at DESC LIMIT {limit} OFFSET {offset}
        """, *params)
        total = await db.fetchval(
            f"SELECT COUNT(*) FROM transactions WHERE {where}", *params
        )

    return {"transactions": rows_to_json(rows), "total": total, "page": page}


# ── GET /v1/stream  (Server-Sent Events) ──────────────────────────────────────
@app.get("/v1/stream")
async def transaction_stream(tenant: dict = Depends(get_tenant)):
    """
    SSE endpoint. Polls DB every 2s for new rows since last seen timestamp.
    rule_flags (Postgres TEXT[]) comes as Python list — serialize() handles it.
    """
    async def event_generator():
        last_ts: Optional[str] = None
        while True:
            try:
                async with get_db() as db:
                    if last_ts is None:
                        rows = await db.fetch("""
                            SELECT transaction_id, user_id, amount, merchant_category,
                                   fraud_score, risk_level, decision, rule_flags, created_at
                            FROM transactions WHERE tenant_id=$1::uuid
                            ORDER BY created_at DESC LIMIT 5
                        """, tenant["id"])
                        rows = list(reversed(rows))
                    else:
                        rows = await db.fetch("""
                            SELECT transaction_id, user_id, amount, merchant_category,
                                   fraud_score, risk_level, decision, rule_flags, created_at
                            FROM transactions
                            WHERE tenant_id=$1::uuid AND created_at > $2::timestamptz
                            ORDER BY created_at ASC LIMIT 20
                        """, tenant["id"], last_ts)

                for row in rows:
                    data = serialize(dict(row))
                    last_ts = data["created_at"]
                    yield f"data: {json.dumps(data)}\n\n"

            except Exception as e:
                logger.warning(f"SSE error: {e}")
            await asyncio.sleep(2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )


# ── GET /health ────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "fraudshield-api"}
