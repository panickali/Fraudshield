FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Pre-train model at build time for faster startup
RUN python -c "from app.ml_service import get_model; get_model(); print('Model pre-trained OK')"
