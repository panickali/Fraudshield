from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    database_url: str = "postgresql://fraudshield:fraudshield_secret@localhost:5432/fraudshield"
    redis_url: str = "redis://localhost:6379"
    kafka_bootstrap_servers: str = "localhost:9092"
    ml_service_url: str = "http://localhost:8001"
    api_url: str = "http://localhost:8000"
    
    velocity_threshold_1min: int = 5
    high_amount_threshold: float = 50000.0
    geo_anomaly_km: float = 500.0
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
