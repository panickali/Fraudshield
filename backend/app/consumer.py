"""
FraudShield Kafka Consumer
Reads from 'transactions-raw' topic and processes each event.

FIX: KafkaConsumer is synchronous. Running its blocking for-loop directly
inside an async function blocks the entire event loop. Solution: run the
blocking poll in a thread via loop.run_in_executor, then dispatch each
message to the async processor.
"""
import asyncio
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable
from app.scoring import score_transaction
from app.database import get_db
from app.config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def process_message(txn_data: dict):
    result = await score_transaction(txn_data)

    async with get_db() as db:
        await db.execute("""
            INSERT INTO transactions
              (transaction_id, tenant_id, user_id, amount, currency,
               merchant_id, merchant_category, device_id, ip_address,
               lat, lon, fraud_score, risk_level, decision,
               rule_flags, model_version, processing_ms)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
            ON CONFLICT (transaction_id) DO NOTHING
        """,
            txn_data.get("transaction_id"),
            txn_data.get("tenant_id"),
            txn_data.get("user_id"),
            txn_data.get("amount"),
            txn_data.get("currency", "INR"),
            txn_data.get("merchant_id"),
            txn_data.get("merchant_category"),
            txn_data.get("device_id"),
            txn_data.get("ip_address"),
            txn_data.get("lat"),
            txn_data.get("lon"),
            result["fraud_score"],
            result["risk_level"],
            result["decision"],
            result["rule_flags"],
            result["model_version"],
            result["processing_ms"]
        )

        if result["risk_level"] in ("high", "critical"):
            await db.execute("""
                INSERT INTO alerts
                  (transaction_id, tenant_id, user_id, severity, fraud_score,
                   rule_flags, amount, merchant_category)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            """,
                txn_data.get("transaction_id"),
                txn_data.get("tenant_id"),
                txn_data.get("user_id"),
                result["risk_level"],
                result["fraud_score"],
                result["rule_flags"],
                txn_data.get("amount"),
                txn_data.get("merchant_category")
            )

    logger.info(
        f"Processed {txn_data.get('transaction_id')}: "
        f"score={result['fraud_score']:.3f} [{result['risk_level']}]"
    )


def _create_consumer(settings) -> KafkaConsumer:
    """Retry-loop to connect — Kafka takes 20-40s to fully start."""
    retries = 0
    while True:
        try:
            consumer = KafkaConsumer(
                "transactions-raw",
                bootstrap_servers=settings.kafka_bootstrap_servers,
                group_id="fraudshield-processor",
                auto_offset_reset="earliest",
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                enable_auto_commit=True,
                consumer_timeout_ms=1000,   # poll returns after 1s if no msgs
            )
            logger.info("Kafka consumer connected successfully")
            return consumer
        except NoBrokersAvailable:
            retries += 1
            wait = min(5 * retries, 30)
            logger.warning(f"Kafka not ready (attempt {retries}), retrying in {wait}s...")
            time.sleep(wait)


async def run_consumer():
    settings = get_settings()
    logger.info(f"Starting Kafka consumer → {settings.kafka_bootstrap_servers}")

    # Initial wait — Kafka healthcheck passes before it's truly ready
    logger.info("Waiting 20s for Kafka to fully initialise...")
    await asyncio.sleep(20)

    loop = asyncio.get_event_loop()

    # Create the sync consumer in a thread so we don't block the loop
    consumer = await loop.run_in_executor(None, _create_consumer, settings)

    logger.info("Consumer ready — polling for messages...")

    # Poll loop: fetch one batch at a time in a thread, process async
    while True:
        try:
            # run_in_executor runs the blocking poll in a thread
            records = await loop.run_in_executor(
                None,
                lambda: consumer.poll(timeout_ms=1000, max_records=10)
            )
            for tp, messages in records.items():
                for message in messages:
                    try:
                        await process_message(message.value)
                    except Exception as e:
                        logger.error(f"Error processing message: {e}", exc_info=True)
        except Exception as e:
            logger.error(f"Consumer poll error: {e}", exc_info=True)
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(run_consumer())
