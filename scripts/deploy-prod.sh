#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=========================================================="
echo "🚀 YAFT Local Production Docker Deployment"
echo "=========================================================="

CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || echo 'detached')"
echo "Current branch: $CURRENT_BRANCH"

# 1. Update production branch to match main
echo "Syncing 'production' branch with 'main'..."
if [ "$CURRENT_BRANCH" = "production" ]; then
  git merge main --ff-only || git merge main -m "sync main into production"
else
  git branch -f production main
fi

# 2. Sync marketing folder if standalone directory exists
if [ -d "/Users/yaft/Code/yaft-mkt" ] && [ -d "$ROOT_DIR/marketing" ]; then
  echo "Syncing marketing site to /Users/yaft/Code/yaft-mkt..."
  cp -R "$ROOT_DIR/marketing/"* /Users/yaft/Code/yaft-mkt/ 2>/dev/null || true
fi

echo "Building and launching Docker containers for Web (Port ${DOCKER_WEB_PORT:-3001}) and API (Port ${DOCKER_API_PORT:-4001})..."

# Use .env.docker if present, otherwise .env, otherwise default fallback values in docker-compose.yml
if [ -f .env.docker ]; then
  docker compose --env-file .env.docker up -d --build
elif [ -f .env ]; then
  docker compose --env-file .env up -d --build
else
  docker compose up -d --build
fi

echo ""
echo "=========================================================="
echo "✅ YAFT Production Snapshot Deployed Successfully!"
echo "=========================================================="
echo "   - Local Web UI:    http://yaft.mylocal.com (or http://localhost:${DOCKER_WEB_PORT:-3001})"
echo "   - Local API:       http://api.yaft.mylocal.com (or http://localhost:${DOCKER_API_PORT:-4001})"
echo "   - API Docs:        http://api.yaft.mylocal.com/api/docs (or http://localhost:${DOCKER_API_PORT:-4001}/api/docs)"
echo "   - Marketing Site:  http://mkt.yaft.mylocal.com"
echo "   - Connected to host PostgreSQL (5432) & MinIO (9000)"
echo ""
echo "Note: Your PM2 development server remains active on Port 3000 / 4000."
