#!/bin/sh
# ============================================================
# CashFlow restore script
# WARNING: DESTRUCTIVE — overwrites current data with the backup.
# Usage: ./restore.sh <postgres-dump.sql.gz> [minio-backup.tar.gz]
# Run from docker/ directory.
# ============================================================
set -e

if [ -z "$1" ]; then
  echo "Usage: ./restore.sh <postgres-dump.sql.gz> [minio-backup.tar.gz]"
  exit 1
fi

DUMP="$1"
MINIO_TAR="${2:-}"

ENV_FILE="${CASHFLOW_ENV_FILE:-.env}"
COMPOSE="docker compose -f docker-compose.yml --env-file $ENV_FILE"
export CASHFLOW_ENV_FILE="$ENV_FILE"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-cashflow}"

if [ ! -f "$DUMP" ]; then
  echo "ERROR: dump file not found: $DUMP"
  exit 1
fi

echo "==> Restoring PostgreSQL from $DUMP"
$COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";" >/dev/null
$COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"$POSTGRES_DB\";" >/dev/null
gunzip -c "$DUMP" | $COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

if [ -n "$MINIO_TAR" ] && [ -f "$MINIO_TAR" ]; then
  echo "==> Restoring MinIO data from $MINIO_TAR"
  docker run --rm \
    -v "cashflow_minio_data:/data" \
    -v "$(pwd):/backup" \
    alpine sh -c 'cd /data && rm -rf ./* && tar xzf /backup/'"$MINIO_TAR"
fi

echo "Restore complete. Restart services:"
echo "  $COMPOSE up -d --no-deps backend frontend"
