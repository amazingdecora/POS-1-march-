#!/usr/bin/env bash
# Run ON the Lightsail instance (or via SSH) from the app directory that contains
# docker-compose.yml — e.g. after cloning this repo.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found. Install Docker first (see docs/deploy-lightsail.md)."
  exit 1
fi

BRANCH="${DEPLOY_BRANCH:-main}"
REMOTE="${GIT_REMOTE:-origin}"

echo "Pulling ${REMOTE} ${BRANCH}..."
git fetch "${REMOTE}" "${BRANCH}"
git checkout "${BRANCH}"
git pull "${REMOTE}" "${BRANCH}"

echo "Building and restarting stack..."
if docker compose version >/dev/null 2>&1; then
  docker compose up --build -d
else
  docker-compose up --build -d
fi

echo "Done. Check: curl -sS \"http://127.0.0.1:\${CLIENT_HOST_PORT:-8080}/api/health\""
