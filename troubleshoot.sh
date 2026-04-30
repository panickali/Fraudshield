#!/bin/bash
# FraudShield Troubleshoot Script
# Run this from the fraudshield/ directory: bash troubleshoot.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }
header() { echo -e "\n${CYAN}══ $1 ══${NC}"; }

header "DOCKER ENVIRONMENT"
if docker info > /dev/null 2>&1; then
  pass "Docker daemon is running"
else
  fail "Docker daemon is NOT running — start Docker Desktop first"
  exit 1
fi

if docker compose version > /dev/null 2>&1; then
  pass "Docker Compose v2 available"
elif docker-compose version > /dev/null 2>&1; then
  warn "Using legacy docker-compose — consider upgrading to Docker Compose v2"
else
  fail "Docker Compose not found"
fi

header "FILE STRUCTURE CHECK"
REQUIRED_FILES=(
  "docker-compose.yml"
  "scripts/init_db.sql"
  "backend/requirements.txt"
  "backend/Dockerfile.api"
  "backend/Dockerfile.ml"
  "backend/app/__init__.py"
  "backend/app/config.py"
  "backend/app/database.py"
  "backend/app/main.py"
  "backend/app/ml_service.py"
  "backend/app/rule_engine.py"
  "backend/app/scoring.py"
  "backend/app/consumer.py"
  "backend/app/data_generator.py"
  "frontend/Dockerfile"
  "frontend/package.json"
  "frontend/index.html"
  "frontend/vite.config.js"
  "frontend/src/main.jsx"
  "frontend/src/App.jsx"
  "frontend/src/index.css"
  "frontend/src/lib/api.js"
  "frontend/src/hooks/usePolling.js"
  "frontend/src/components/ui.jsx"
  "frontend/src/components/StatCards.jsx"
  "frontend/src/components/LiveFeed.jsx"
  "frontend/src/components/AlertsPanel.jsx"
  "frontend/src/components/Charts.jsx"
  "frontend/src/components/UserDrawer.jsx"
  "frontend/src/components/TestPanel.jsx"
)

ALL_OK=true
for f in "${REQUIRED_FILES[@]}"; do
  if [ -f "$f" ]; then
    pass "$f"
  else
    fail "MISSING: $f"
    ALL_OK=false
  fi
done

header "DOCKER COMPOSE SYNTAX"
if docker compose config > /dev/null 2>&1; then
  pass "docker-compose.yml is valid"
else
  fail "docker-compose.yml has syntax errors:"
  docker compose config 2>&1 | head -20
fi

header "CONTAINER STATUS"
SERVICES=("postgres" "redis" "zookeeper" "kafka" "ml_service" "api" "consumer" "data_generator" "frontend")
for svc in "${SERVICES[@]}"; do
  STATUS=$(docker compose ps --format json 2>/dev/null | python3 -c "
import json,sys
for line in sys.stdin:
    try:
        d = json.loads(line)
        if '$svc' in d.get('Service','') or '$svc' in d.get('Name',''):
            print(d.get('State','unknown'))
            break
    except: pass
" 2>/dev/null)
  if [ "$STATUS" = "running" ]; then
    pass "$svc: running"
  elif [ -z "$STATUS" ]; then
    warn "$svc: not started (run docker compose up)"
  else
    fail "$svc: $STATUS"
  fi
done

header "PORT AVAILABILITY (before starting)"
PORTS=("5432:PostgreSQL" "2181:Zookeeper" "9092:Kafka" "6379:Redis" "8001:ML-Service" "8000:API" "3000:Frontend")
for entry in "${PORTS[@]}"; do
  PORT="${entry%%:*}"
  NAME="${entry##*:}"
  if lsof -i ":$PORT" > /dev/null 2>&1 || ss -tlnp | grep -q ":$PORT " 2>/dev/null; then
    warn "Port $PORT ($NAME) is already in use — may conflict"
  else
    pass "Port $PORT ($NAME) is free"
  fi
done

header "API HEALTH CHECKS"
API_URL="http://localhost:8000"
ML_URL="http://localhost:8001"

# API
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$API_URL/health" 2>/dev/null)
if [ "$HTTP" = "200" ]; then
  pass "API /health → 200 OK"
  BODY=$(curl -s --max-time 3 "$API_URL/health")
  info "Response: $BODY"
else
  fail "API not reachable at $API_URL/health (HTTP $HTTP)"
  info "Is the api container running? Run: docker compose logs api"
fi

# ML service
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$ML_URL/health" 2>/dev/null)
if [ "$HTTP" = "200" ]; then
  pass "ML service /health → 200 OK"
  BODY=$(curl -s --max-time 5 "$ML_URL/health")
  info "Response: $BODY"
else
  fail "ML service not reachable at $ML_URL/health (HTTP $HTTP)"
  info "Check: docker compose logs ml_service"
fi

header "AUTH + TRANSACTION TEST"
AUTH="Authorization: Bearer demo_key_fraudshield_2024"

# Test auth
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
  -H "$AUTH" "$API_URL/v1/dashboard/stats" 2>/dev/null)
if [ "$HTTP" = "200" ]; then
  pass "Auth OK — /v1/dashboard/stats → 200"
elif [ "$HTTP" = "401" ]; then
  fail "Auth FAILED — API key not found in DB. Init script may not have run."
  info "Fix: docker compose down -v && docker compose up"
else
  fail "Stats endpoint failed (HTTP $HTTP)"
fi

# Fire a real test transaction
echo ""
info "Firing a HIGH-RISK test transaction..."
RESPONSE=$(curl -s --max-time 10 -X POST "$API_URL/v1/transaction" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"diag_user_001",
    "amount":89999,
    "merchant_category":"crypto_exchange",
    "merchant_id":"merch_test_diag",
    "device_id":"dev_unknown_diag",
    "lat":51.5074,
    "lon":-0.1278
  }' 2>/dev/null)

if echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f\"score={d['fraud_score']} risk={d['risk_level']} decision={d['decision']}\")" 2>/dev/null; then
  pass "Transaction scored successfully"
  SCORE=$(echo "$RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin)['fraud_score'])" 2>/dev/null)
  if (( $(echo "$SCORE > 0.5" | bc -l 2>/dev/null || echo 0) )); then
    pass "Score $SCORE looks correct for a high-risk transaction"
  else
    warn "Score $SCORE seems low for crypto_exchange + unknown device + London location"
  fi
else
  fail "Transaction scoring failed"
  info "Response: $RESPONSE"
fi

# Check alerts were created
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
  -H "$AUTH" "$API_URL/v1/alerts?severity=critical" 2>/dev/null)
if [ "$HTTP" = "200" ]; then
  COUNT=$(curl -s --max-time 5 -H "$AUTH" "$API_URL/v1/alerts?severity=critical" | \
    python3 -c "import json,sys; print(json.load(sys.stdin)['total'])" 2>/dev/null)
  pass "Alerts endpoint → 200 (total critical: $COUNT)"
else
  fail "Alerts endpoint failed (HTTP $HTTP)"
fi

header "POSTGRESQL CHECK"
DB_OK=$(docker compose exec -T postgres psql -U fraudshield -d fraudshield \
  -c "SELECT COUNT(*) FROM transactions;" 2>/dev/null | grep -E "^\s+[0-9]")
if [ -n "$DB_OK" ]; then
  COUNT=$(echo "$DB_OK" | tr -d ' ')
  pass "PostgreSQL OK — transactions table has $COUNT rows"
else
  fail "Cannot query PostgreSQL"
  info "Fix: docker compose down -v && docker compose up postgres"
fi

TENANT=$(docker compose exec -T postgres psql -U fraudshield -d fraudshield \
  -c "SELECT api_key FROM tenants LIMIT 1;" 2>/dev/null | grep "demo_key")
if [ -n "$TENANT" ]; then
  pass "Demo tenant + API key exists in DB"
else
  fail "Demo tenant NOT found — init_db.sql did not run"
  info "Fix: docker compose down -v (deletes volume) then docker compose up"
fi

header "REDIS CHECK"
REDIS_PING=$(docker compose exec -T redis redis-cli ping 2>/dev/null)
if [ "$REDIS_PING" = "PONG" ]; then
  pass "Redis responding to PING"
else
  fail "Redis not responding"
fi

header "ML MODEL CHECK"
ML_INFO=$(curl -s --max-time 10 "$ML_URL/model-info" 2>/dev/null)
if echo "$ML_INFO" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f\"n_estimators={d['n_estimators']} features={d['n_features']}\")" 2>/dev/null; then
  pass "ML model loaded and responding"
else
  fail "ML model-info endpoint failed"
  info "Check: docker compose logs ml_service | tail -30"
fi

header "FRONTEND CHECK"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:3000" 2>/dev/null)
if [ "$HTTP" = "200" ]; then
  pass "Frontend serving at http://localhost:3000"
else
  fail "Frontend not reachable (HTTP $HTTP)"
  info "Check: docker compose logs frontend"
fi

header "KAFKA CHECK"
KAFKA_STATUS=$(docker compose exec -T kafka \
  kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1 && echo "OK" || echo "FAIL")
if [ "$KAFKA_STATUS" = "OK" ]; then
  pass "Kafka broker responding"
  TOPICS=$(docker compose exec -T kafka kafka-topics --bootstrap-server localhost:9092 --list 2>/dev/null)
  if echo "$TOPICS" | grep -q "transactions-raw"; then
    pass "Topic 'transactions-raw' exists"
  else
    warn "Topic 'transactions-raw' not yet created (will auto-create on first message)"
  fi
else
  fail "Kafka not responding"
  info "Check: docker compose logs kafka | tail -20"
fi

header "SUMMARY"
echo ""
echo "  Quick fix commands:"
echo ""
echo "  Full reset (clears all data):"
info "docker compose down -v && docker compose build && docker compose up"
echo ""
echo "  Rebuild just one service:"
info "docker compose build api && docker compose up api"
echo ""
echo "  Watch all logs:"
info "docker compose logs -f"
echo ""
echo "  Watch specific service:"
info "docker compose logs -f ml_service"
echo ""
echo "  Open interactive API docs:"
info "open http://localhost:8000/docs"
echo ""
