"""
FraudShield Synthetic Data Generator
Seeds the database with realistic transaction history for demo purposes.
"""
import asyncio
import httpx
import random
import uuid
from datetime import datetime, timezone, timedelta
from faker import Faker
import logging
import time
from app.config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

fake = Faker('en_IN')

MERCHANT_CATS = [
    "retail", "food", "electronics", "travel", "grocery",
    "fuel", "healthcare", "entertainment", "utilities",
    "crypto_exchange", "gambling", "jewelry", "atm", "transfer"
]

HIGH_RISK_CATS = ["crypto_exchange", "gambling", "atm", "transfer"]
NORMAL_CATS = ["retail", "food", "grocery", "fuel", "healthcare", "utilities"]

CITIES = [
    (28.6139, 77.2090, "Delhi"),
    (19.0760, 72.8777, "Mumbai"),
    (12.9716, 77.5946, "Bangalore"),
    (17.3850, 78.4867, "Hyderabad"),
    (22.5726, 88.3639, "Kolkata"),
    (13.0827, 80.2707, "Chennai"),
    (23.0225, 72.5714, "Ahmedabad"),
    (18.5204, 73.8567, "Pune"),
]

# London coords for geo anomaly demo
ANOMALY_CITY = (51.5074, -0.1278)

def random_indian_phone():
    return f"9{random.randint(100000000, 999999999)}"

def generate_users(n=50):
    users = []
    for _ in range(n):
        city = random.choice(CITIES)
        users.append({
            "user_id": f"usr_{uuid.uuid4().hex[:8]}",
            "home_lat": city[0] + random.uniform(-0.1, 0.1),
            "home_lon": city[1] + random.uniform(-0.1, 0.1),
            "city": city[2],
            "avg_amount": random.uniform(500, 20000),
            "risk_profile": random.choices(["low", "medium", "high"], weights=[0.7, 0.2, 0.1])[0]
        })
    return users

def generate_transaction(user, is_fraud=False, days_ago=0):
    hours_ago = random.uniform(0, days_ago * 24)
    ts = datetime.now(timezone.utc) - timedelta(hours=hours_ago)

    if is_fraud:
        cat = random.choice(HIGH_RISK_CATS)
        amount = user["avg_amount"] * random.uniform(4, 20)
        hour = random.choice(list(range(0, 5)) + [23])
        lat = ANOMALY_CITY[0] + random.uniform(-0.5, 0.5)
        lon = ANOMALY_CITY[1] + random.uniform(-0.5, 0.5)
    else:
        cat = random.choice(NORMAL_CATS if user["risk_profile"] == "low" else MERCHANT_CATS)
        amount = user["avg_amount"] * random.uniform(0.2, 2.5)
        hour = random.randint(8, 22)
        lat = user["home_lat"] + random.uniform(-0.05, 0.05)
        lon = user["home_lon"] + random.uniform(-0.05, 0.05)

    ts = ts.replace(hour=hour)
    merchant_id = f"merch_{uuid.uuid4().hex[:6]}"

    return {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "amount": round(amount, 2),
        "currency": "INR",
        "merchant_id": merchant_id,
        "merchant_category": cat,
        "device_id": f"dev_{user['user_id'][-4:]}{'_new' if is_fraud else ''}",
        "ip_address": f"{random.randint(1,255)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(0,255)}",
        "lat": lat,
        "lon": lon,
        "timestamp": ts.isoformat()
    }

async def seed_database():
    settings = get_settings()
    
    # Wait for API to be ready
    logger.info("Waiting for API to be ready...")
    for i in range(30):
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(f"{settings.api_url}/health", timeout=5)
                if r.status_code == 200:
                    break
        except:
            pass
        time.sleep(3)

    logger.info("API ready. Starting data generation...")
    
    users = generate_users(50)
    total = 0
    fraud_count = 0
    
    async with httpx.AsyncClient(
        headers={"Authorization": "Bearer demo_key_fraudshield_2024"},
        timeout=30
    ) as client:
        # Generate 7 days of history
        for days_ago in range(7, 0, -1):
            txns_today = random.randint(80, 150)
            fraud_today = random.randint(3, 8)
            
            batch = []
            for _ in range(txns_today):
                user = random.choice(users)
                is_fraud = random.random() < 0.05
                batch.append(generate_transaction(user, is_fraud, days_ago))
                if is_fraud:
                    fraud_count += 1

            for txn in batch:
                try:
                    r = await client.post(f"{settings.api_url}/v1/transaction", json=txn)
                    if r.status_code == 200:
                        total += 1
                        if total % 50 == 0:
                            logger.info(f"Seeded {total} transactions ({fraud_count} fraud)...")
                except Exception as e:
                    logger.warning(f"Failed to send txn: {e}")

    logger.info(f"✓ Data generation complete: {total} transactions, {fraud_count} fraudulent")

    # Now generate a few live transactions every few seconds
    logger.info("Starting live transaction stream...")
    users = generate_users(20)
    
    while True:
        user = random.choice(users)
        is_fraud = random.random() < 0.08  # 8% fraud rate for demo
        txn = generate_transaction(user, is_fraud, days_ago=0)
        txn["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        try:
            async with httpx.AsyncClient(
                headers={"Authorization": "Bearer demo_key_fraudshield_2024"},
                timeout=10
            ) as client:
                await client.post(f"{settings.api_url}/v1/transaction", json=txn)
        except Exception as e:
            logger.warning(f"Live txn error: {e}")
        
        await asyncio.sleep(random.uniform(0.5, 3.0))

if __name__ == "__main__":
    asyncio.run(seed_database())
