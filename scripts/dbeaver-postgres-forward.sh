#!/usr/bin/env bash
# =============================================================================
# PostgreSQL access for DBeaver (Docker Compose stack)
# =============================================================================
# Run from Git Bash, WSL, or macOS/Linux:
#   chmod +x scripts/dbeaver-postgres-forward.sh
#   ./scripts/dbeaver-postgres-forward.sh
#
# What it does:
#   1. Starts the `db` service (if needed) so Postgres is running.
#   2. Waits until the database accepts connections.
#   3. Prints DBeaver connection settings (host/port/user/db/password).
#
# Optional environment variables (same shell session):
#   HOST_PG_PORT=5432       Host port mapped to Postgres (must match docker-compose).
#   EXTRA_LOCAL_PORT=15432  If set, starts a small sidecar container that listens on
#                           this localhost port and forwards into the compose network
#                           to `db:5432`. Use when you cannot change compose or need a
#                           second local port. Press Enter when done to remove it.
#
# Examples:
#   ./scripts/dbeaver-postgres-forward.sh
#   HOST_PG_PORT=5433 docker compose up -d db
#   EXTRA_LOCAL_PORT=15432 ./scripts/dbeaver-postgres-forward.sh
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FORWARD_CONTAINER_NAME="${FORWARD_CONTAINER_NAME:-ad-pg-dbeaver-forward}"

cleanup() {
  if [[ -n "${EXTRA_LOCAL_PORT:-}" ]]; then
    docker rm -f "${FORWARD_CONTAINER_NAME}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker not found. Install Docker Desktop / Docker Engine."
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "Error: docker compose / docker-compose not found."
  exit 1
fi

echo "Starting database service (docker compose)..."
"${COMPOSE[@]}" up -d db

echo "Waiting for PostgreSQL to accept connections..."
ready=0
for i in $(seq 1 90); do
  if "${COMPOSE[@]}" exec -T db pg_isready -U amazing_user -d amazing_decora >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [[ "${ready}" -ne 1 ]]; then
  echo "Timeout: database did not become ready. Check: docker compose logs db"
  exit 1
fi

PUBLISHED="$("${COMPOSE[@]}" port db 5432 2>/dev/null || true)"
if [[ -n "${PUBLISHED}" ]]; then
  HOST_PORT="${PUBLISHED##*:}"
else
  HOST_PORT="${HOST_PG_PORT:-5432}"
fi

echo ""
echo "========== DBeaver — PostgreSQL =========="
echo "  Host:      127.0.0.1"
echo "  Port:      ${HOST_PORT}"
echo "  Database:  amazing_decora"
echo "  Username:  amazing_user"
echo "  Password:  amazing_pass"
echo ""
echo "  JDBC URL:  jdbc:postgresql://127.0.0.1:${HOST_PORT}/amazing_decora"
echo "  URL:       postgresql://amazing_user:amazing_pass@127.0.0.1:${HOST_PORT}/amazing_decora"
echo "=========================================="
echo ""
echo "Tip: If port 5432 is already used on Windows, set in .env or your shell:"
echo "     export HOST_PG_PORT=5433"
echo "     docker compose up -d db"
echo "     Then run this script again (port shown above will update)."
echo ""

if [[ -n "${EXTRA_LOCAL_PORT:-}" ]]; then
  NET="$(docker inspect amazing-decora-db --format '{{range $k,_ := .NetworkSettings.Networks}}{{$k}}{{break}}{{end}}' 2>/dev/null || true)"
  if [[ -z "${NET}" ]]; then
    echo "Error: container amazing-decora-db not found. Is the db service running?"
    exit 1
  fi

  docker rm -f "${FORWARD_CONTAINER_NAME}" >/dev/null 2>&1 || true
  echo "Starting sidecar: 127.0.0.1:${EXTRA_LOCAL_PORT} -> db:5432 (Docker network: ${NET})"
  # netshoot includes socat; use explicit entrypoint so args are passed correctly
  docker run -d --name "${FORWARD_CONTAINER_NAME}" \
    -p "127.0.0.1:${EXTRA_LOCAL_PORT}:5432" \
    --network "${NET}" \
    --entrypoint socat \
    nicolaka/netshoot \
    TCP-LISTEN:5432,fork,reuseaddr TCP:db:5432

  echo ""
  echo "Use DBeaver with:"
  echo "  Host 127.0.0.1  Port ${EXTRA_LOCAL_PORT}  (same user/db/password as above)"
  echo ""
  echo "Press Enter to stop the sidecar and exit..."
  read -r _
fi
