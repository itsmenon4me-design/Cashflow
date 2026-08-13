#!/bin/sh
# ============================================================
# CashFlow backup script (non-destructive)
# Usage: ./backup.sh [output-dir]
# Default output dir: ./backups
# Run from docker/ directory.
# ============================================================
set -e

STAMP=$(date +%Y%m%d-%H%M%S)
DIR="${1:-./backups}"
mkdir -p "$DIR"

ENV_FILE="${CASHFLOW_ENV_FILE:-.env}"
COMPOSE="docker compose -f docker-compose.yml --env-file $ENV_FILE"
export CASHFLOW_ENV_FILE="$ENV_FILE"

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-cashflow}"

echo "==> PostgreSQL dump -> $DIR/postgres-$STAMP.sql.gz"
$COMPOSE exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$DIR/postgres-$STAMP.sql.gz"

echo "==> Redis RDB -> $DIR/redis-$STAMP.rdb"
$COMPOSE exec -T redis sh -c 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning SAVE' >/dev/null 2>&1 || true
$COMPOSE exec -T redis sh -c 'cat /data/dump.rdb' > "$DIR/redis-$STAMP.rdb" 2>/dev/null || true

echo "==> MinIO data volume -> $DIR/minio-$STAMP.tar.gz"
docker run --rm \
  -v "cashflow_minio_data:/data:ro" \
  -v "$(pwd)/$DIR:/backup" \
  alpine sh -c 'cd /data && tar czf /backup/minio-'$STAMP'.tar.gz .'

echo "==> Backup volume (docker volumes snapshot hint)"
echo "    docker compose -f docker-compose.yml stop"
echo "    tar czf $DIR/volumes-$STAMP.tar.gz -C /var/lib/docker/volumes cashflow_postgres_data cashflow_redis_data"

echo "Backup done -> $DIR (stamp: $STAMP)"
