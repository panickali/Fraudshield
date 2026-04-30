"""
Rule engine: fast pre-ML checks using Redis velocity counters.
Returns list of triggered rule flags.
"""
import redis.asyncio as aioredis
import math
from typing import List, Dict, Any, Optional
from app.config import get_settings

_redis = None

async def get_redis():
    global _redis
    if _redis is None:
        settings = get_settings()
        _redis = await aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis

async def get_velocity_counts(user_id: str) -> Dict[str, int]:
    r = await get_redis()
    pipe = r.pipeline()
    pipe.get(f"vel:1m:{user_id}")
    pipe.get(f"vel:1h:{user_id}")
    pipe.get(f"vel:24h:{user_id}")
    results = await pipe.execute()
    return {
        "count_1min": int(results[0] or 0),
        "count_1hr":  int(results[1] or 0),
        "count_24hr": int(results[2] or 0),
    }

async def increment_velocity(user_id: str):
    r = await get_redis()
    pipe = r.pipeline()
    pipe.incr(f"vel:1m:{user_id}")
    pipe.expire(f"vel:1m:{user_id}", 60)
    pipe.incr(f"vel:1h:{user_id}")
    pipe.expire(f"vel:1h:{user_id}", 3600)
    pipe.incr(f"vel:24h:{user_id}")
    pipe.expire(f"vel:24h:{user_id}", 86400)
    await pipe.execute()

async def get_last_location(user_id: str) -> Optional[Dict]:
    r = await get_redis()
    lat = await r.get(f"loc:lat:{user_id}")
    lon = await r.get(f"loc:lon:{user_id}")
    ts  = await r.get(f"loc:ts:{user_id}")
    if lat and lon:
        return {"lat": float(lat), "lon": float(lon), "ts": ts}
    return None

async def set_last_location(user_id: str, lat: float, lon: float):
    import time
    r = await get_redis()
    pipe = r.pipeline()
    pipe.setex(f"loc:lat:{user_id}", 86400 * 7, str(lat))
    pipe.setex(f"loc:lon:{user_id}", 86400 * 7, str(lon))
    pipe.setex(f"loc:ts:{user_id}",  86400 * 7, str(time.time()))
    await pipe.execute()

async def get_user_avg_amount(user_id: str) -> float:
    r = await get_redis()
    val = await r.get(f"avg_amt:{user_id}")
    return float(val) if val else 5000.0

async def update_user_avg_amount(user_id: str, amount: float):
    r = await get_redis()
    current = await get_user_avg_amount(user_id)
    # Exponential moving average
    new_avg = 0.9 * current + 0.1 * amount
    await r.setex(f"avg_amt:{user_id}", 86400 * 30, str(new_avg))

async def is_known_merchant(user_id: str, merchant_id: str) -> bool:
    r = await get_redis()
    key = f"merch:{user_id}"
    is_member = await r.sismember(key, merchant_id)
    if not is_member:
        await r.sadd(key, merchant_id)
        await r.expire(key, 86400 * 90)
    return bool(is_member)

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

async def evaluate_rules(txn: Dict[str, Any]) -> List[str]:
    """
    Returns list of triggered rule flag strings.
    """
    flags = []
    settings = get_settings()
    user_id  = txn["user_id"]
    amount   = txn["amount"]
    hour     = txn.get("hour_of_day", 12)
    lat      = txn.get("lat")
    lon      = txn.get("lon")
    merchant = txn.get("merchant_id", "")
    device   = txn.get("device_id", "")

    # Velocity
    vel = await get_velocity_counts(user_id)
    if vel["count_1min"] >= settings.velocity_threshold_1min:
        flags.append("velocity_exceeded")

    # High amount
    if amount >= settings.high_amount_threshold:
        flags.append("high_amount")

    # New merchant
    known = await is_known_merchant(user_id, merchant)
    if not known:
        flags.append("new_merchant")

    # Night transaction (1am–5am)
    if 1 <= hour <= 5:
        flags.append("night_transaction")

    # Geo anomaly
    if lat and lon:
        last_loc = await get_last_location(user_id)
        if last_loc:
            dist = haversine_km(last_loc["lat"], last_loc["lon"], lat, lon)
            if dist > settings.geo_anomaly_km:
                flags.append("geo_anomaly")
        await set_last_location(user_id, lat, lon)

    # Unknown device
    r = await get_redis()
    dev_key = f"dev:{user_id}"
    dev_known = await r.sismember(dev_key, device)
    if device and not dev_known:
        flags.append("unknown_device")
        await r.sadd(dev_key, device)
        await r.expire(dev_key, 86400 * 90)

    return flags
