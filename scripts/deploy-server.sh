#!/usr/bin/env bash
# Run on the Ubuntu Server laptop from /opt/gooverchat.
# Usage: ./scripts/deploy-server.sh
set -e
cd "$(dirname "$0")/.."
echo "==> Pulling latest code..."
git fetch && git checkout main && git pull
echo "==> Building app image..."
docker compose -f docker-compose.prod.yml --env-file .env build app
echo "==> Running migrations..."
docker compose -f docker-compose.prod.yml --env-file .env run --rm app npx prisma migrate deploy --schema=/app/prisma/schema.prisma
echo "==> Starting stack..."
docker compose -f docker-compose.prod.yml --env-file .env up -d
echo "==> Done. Check health: curl http://localhost:3000/api/health"
