Docker development environment for CashFlow Enterprise

Overview
--------
This docker/ setup provides a development-friendly compose configuration that runs:

- Frontend (Next.js)
- Backend (NestJS)
- PostgreSQL
- Redis
- MinIO (object storage)
- Nginx (reverse proxy)

All services are configured to run together with sensible defaults and persistent volumes for data.

Quick start
-----------
1. Copy environment template and update secrets if needed:
   cp docker/.env.docker .env.docker

2. Start everything in detached mode:
   docker compose -f docker/docker-compose.yml up -d
   (During development use: docker compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml up -d)

3. Check logs:
   docker compose -f docker/docker-compose.yml logs -f backend

4. Stop:
   docker compose -f docker/docker-compose.yml down

Useful tasks
------------
- Rebuild images:
  docker compose -f docker/docker-compose.yml build --no-cache

- Reset Postgres database (will delete data):
  docker compose -f docker/docker-compose.yml down -v postgres_data

Notes
-----
- Do NOT commit real credentials into the repository. Use docker/.env.docker to configure local secrets.
- By default nginx listens on port 80 on the host and proxies / to the frontend and /api to the backend.
- The backend expects DATABASE_URL to be set via environment. When running the stack locally the compose file sets DATABASE_URL to use the postgres service.
- Healthchecks are configured for Postgres, Redis and MinIO. Backend health endpoint is expected at /api/v1/health — implement or adjust in the backend to reflect your health route.

Environment variables (operators)
---------------------------------
| Variable | Purpose | Required |
|---|---|---|
| `CORS_ORIGINS` | Comma-separated list of allowed browser origins (single source of truth; wildcard `*` is rejected). | Yes in production |
| `FRONTEND_URL` | Public frontend URL used to build password-reset links in emails. | Yes in production |
| `INTERNAL_API_KEY` | Shared secret for `POST /api/v1/internal/finance-bot/run-daily` (constant-time guard, fails closed with 401). Generate with `openssl rand -hex 64`. Never reuse JWT secrets. | Yes if the internal endpoint is used over HTTP |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Must be at least 32 characters (backend enforces `JWT_SECRET_MIN_LENGTH`); generate with `openssl rand -hex 64`. | Yes |

Password reset flow
-------------------
1. User requests reset on the frontend (`/forgot-password`).
2. Backend stores a SHA-256 hash of the one-time token (raw token is never persisted).
3. Email carries a link to `FRONTEND_URL/reset-password?token=...&id=...`.
4. `POST /api/v1/auth/reset-password` validates token + expiry, hashes the new password with Argon2id, clears the reset token state (single-use), and revokes all sessions/refresh tokens.
5. Without SMTP configured the reset/verification links are logged by the backend (local-development delivery only); with `SMTP_HOST` set, links are only sent via email and never logged.

Playwright E2E verification (verify stack)
-------------------------------------------
The `docker-compose.verify.yml` stack (nginx `8080→80`, backend `3101→3001`, postgres `55432→5432`) is the verify target for the Playwright acceptance specs in `apps/frontend/playwright/`.

Important: the frontend image is built with `NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1` (see `docker/.env.verify`) and the backend's `CORS_ORIGIN` only allows `http://localhost:8080`. The UI must therefore be exercised through the nginx entry point — browser requests to the frontend container port directly (e.g. `http://localhost:3100`) are cross-origin and fail at the browser (no CORS headers on nginx, OPTIONS preflight → 404). Always run E2E against the nginx origin:

```
cd apps/frontend
$env:BASE_URL='http://localhost:8080'
$env:API_BASE='http://localhost:3101/api/v1'
$env:TEST_DATABASE_URL='postgresql://postgres:verifypass@localhost:55432/cashflow?schema=public'
npx playwright test playwright/multi-currency-acceptance.final.spec.ts --workers=1 --trace=retain-on-failure --timeout=180000 --reporter=list
```

If a run must be repeated with a fresh stack, rebuild the frontend image from the current working tree first (`docker compose -f docker/docker-compose.verify.yml build frontend`) — the deployed image may otherwise be stale relative to `apps/frontend` sources.

Customization
-------------
- Use docker-compose.override.yml for development convenience (hot reload, port mapping, code mounts).
- For production, prefer building images and running them in a secure environment, and use Docker secrets for DB credentials.
