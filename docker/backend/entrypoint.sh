#!/bin/sh
set -e

cd /app

if [ "$NODE_ENV" = "production" ]; then
  if [ -z "$JWT_SECRET" ] || [ -z "$JWT_REFRESH_SECRET" ]; then
    echo "FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be set in production."
    exit 1
  fi
  if [ -z "$DATABASE_URL" ]; then
    echo "FATAL: DATABASE_URL must be set in production."
    exit 1
  fi
fi

echo "==> Running Prisma migrations..."
npx prisma migrate deploy

echo "==> Generating Prisma client..."
npx prisma generate

if [ "$SEED_ENABLED" = "true" ]; then
  echo "==> Seeding database..."
  npx prisma db seed || true
else
  echo "==> Seeding skipped (SEED_ENABLED != true)."
fi

echo "==> Starting backend..."
exec node apps/backend/dist/main.js