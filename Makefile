.PHONY: build up down reset logs test score check

build:
	docker compose build

up:
	docker compose up

upd:
	docker compose up -d

down:
	docker compose down

reset:
	docker compose down -v
	docker compose build
	docker compose up

logs:
	docker compose logs -f

logs-%:
	docker compose logs -f $*

check:
	bash troubleshoot.sh

score:
	curl -s -X POST http://localhost:8000/v1/transaction \
	  -H "Authorization: Bearer demo_key_fraudshield_2024" \
	  -H "Content-Type: application/json" \
	  -d '{"user_id":"test_001","amount":89999,"merchant_category":"crypto_exchange","merchant_id":"m1","device_id":"d_unknown","lat":51.5,"lon":-0.1}' \
	  | python3 -m json.tool

alerts:
	curl -s http://localhost:8000/v1/alerts \
	  -H "Authorization: Bearer demo_key_fraudshield_2024" \
	  | python3 -m json.tool

stats:
	curl -s http://localhost:8000/v1/dashboard/stats \
	  -H "Authorization: Bearer demo_key_fraudshield_2024" \
	  | python3 -m json.tool

psql:
	docker compose exec postgres psql -U fraudshield -d fraudshield

redis:
	docker compose exec redis redis-cli

api-shell:
	docker compose exec api bash

ml-shell:
	docker compose exec ml_service bash
