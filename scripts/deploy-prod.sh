#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=========================================================="
echo "🚀 YAFT Local Production Docker Deployment"
echo "=========================================================="

CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || echo 'detached')"
echo "Current branch: $CURRENT_BRANCH"

# Check if production branch exists
if git show-ref --verify --quiet refs/heads/production; then
  echo "Found 'production' branch."
else
  echo "Branch 'production' not found yet. Creating 'production' from current HEAD..."
  git branch production HEAD
fi

echo "Building and launching Docker containers for Web (Port ${DOCKER_WEB_PORT:-3001}) and API (Port ${DOCKER_API_PORT:-4001})..."

# Use .env.docker if present, otherwise default fallback values in docker-compose.yml
if [ -f .env.docker ]; then
  docker compose --env-file .env.docker up -d --build
else
  docker compose up -d --build
fi

echo ""
echo "✅ Docker Production snapshot deployed successfully!"
echo "   - Web UI:  http://localhost:${DOCKER_WEB_PORT:-3001}"
echo "   - API:     http://localhost:${DOCKER_API_PORT:-4001}"
echo "   - Swagger: http://localhost:${DOCKER_API_PORT:-4001}/api/docs"
echo "   - Connected to host PostgreSQL (5432) & MinIO (9000)"
echo ""
echo "Note: Your PM2 development server remains active on Port 3000 / 4000."
