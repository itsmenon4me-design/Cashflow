# CashFlow Production Deployment

Deployment stack: **Cloudflare -> Nginx -> Next.js (frontend) -> NestJS (backend) -> PostgreSQL + Redis + MinIO**

> Domain placeholders: `https://your-domain.com`. Replace everywhere before deploying.
> Never commit real secrets. Use `.env.example` templates and fill local untracked `.env`.

---

## 1. Server Preparation

- Ubuntu 22.04+ (or any Docker host). Minimum 2 vCPU / 4 GB RAM.
- Install:
  ```bash
  apt update
  apt install -y docker.io docker-compose-v2 nginx curl
  ```
- Add `docker` group and log out/in, or use `sudo`.
- Open firewall: `80` (HTTP, behind Cloudflare proxy) and management ports restricted. Do **not** expose PostgreSQL/Redis/MinIO to the internet.

## 2. Environment Variables

Templates (no secrets):
- `docker/.env.example` -> copy to `docker/.env`
- `apps/backend/.env.example` -> `apps/backend/.env.production`
- `apps/frontend/.env.example`

Fill in `docker/.env`:
- `DATABASE_URL`, `POSTGRES_PASSWORD`
- `REDIS_URL`, `REDIS_PASSWORD` (must match; URL `redis://:PASS@redis:6379/0`)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — generate with `openssl rand -hex 64`
- `CORS_ORIGIN=https://your-domain.com`
- `NEXT_PUBLIC_API_URL=https://your-domain.com/api/v1`
- `SEED_ENABLED=false` (must stay off in production)
- `MINIO_ROOT_PASSWORD`

## 3. Docker Setup

```bash
cd docker
cp .env.example .env      # then edit secrets
# CASHFLOW_ENV_FILE tells Compose which env file to inject into containers.
CASHFLOW_ENV_FILE=.env docker compose -f docker-compose.yml --env-file .env config   # validates
CASHFLOW_ENV_FILE=.env docker compose -f docker-compose.yml --env-file .env up -d --build
CASHFLOW_ENV_FILE=.env docker compose -f docker-compose.yml --env-file .env ps
```

- `--env-file .env` feeds the `$VAR` interpolation; `CASHFLOW_ENV_FILE` selects the file placed into each container (`env_file`). Both point at the same production `.env`.
- Dev uses the separate runner (defaults to `.env.docker`):
  ```bash
  docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.docker up -d --build
  ```
- Local runtime verification without touching dev ports:
  ```bash
  CASHFLOW_ENV_FILE=.env.verify docker compose \
    -f docker-compose.yml -f docker-compose.verify.yml --env-file .env.verify up -d --build
  # nginx on :8080, backend :3101, frontend :3100
  ```
- Postgres/Redis/MinIO are on an **internal** bridge network (no host ports). Only Nginx (`:80`), backend (`:3001`), and frontend (`:3000`) are published. For a locked deployment remove the extra `ports:`.
- Containers run production commands (`node main.js`, `next start`). Backend entrypoint runs migrations + generate + start.

## 4. Database Migration

Migrations are applied on container start (`entrypoint.sh`):

```bash
CASHFLOW_ENV_FILE=.env docker compose -f docker-compose.yml --env-file .env exec backend sh -c "npx prisma migrate deploy"
CASHFLOW_ENV_FILE=.env docker compose -f docker-compose.yml --env-file .env exec backend sh -c "npx prisma generate"
```

- **Never** use `prisma db push` in production.
- Existing migrations run in order and are never deleted.

## 5. Prisma Generate

Run inside the backend container (also runs automatically in `entrypoint.sh`):
```bash
CASHFLOW_ENV_FILE=.env docker compose -f docker-compose.yml --env-file .env exec backend npx prisma generate
```

## 6. Start Services

```bash
CASHFLOW_ENV_FILE=.env docker compose -f docker-compose.yml --env-file .env up -d
```

Container restart policy is `unless-stopped`. Healthchecks gate `backend`/`frontend`/`nginx`.

## 7. Nginx

`docker/nginx/nginx.conf` proxies:
- `/` -> Next.js
- `/api/` -> NestJS (no caching, rate-limited `limit_req`)
- `/_next/static/`, `/icons/` -> immutable caching
- `/sw.js` -> no-store (PWA)
- `/manifest.webmanifest` -> short cache
- `/health` -> backend health

Security: security headers, gzip (brotli not bundled in `nginx:stable-alpine`), `server_tokens off`, `client_max_body_size 25m`.

## 8. Domain

- Set DNS A/AAAA record for `your-domain.com` and `www` to Cloudflare-proxied IP.

## 9. Cloudflare

1. Add site, set Plan/DNS.
2. Proxy mode `Proxied` (orange cloud).
3. Origin server: Cloudflare -> origin reach internal Nginx port 80 (or force HTTPS origin).

## 10. HTTPS / SSL Mode

Set Cloudflare **SSL/TLS mode to "Full (strict)"** (origin presents a valid cert; Terminator at the edge). Nginx listens on `:80`; TLS terminates at Cloudflare. `Strict-Transport-Security` is emitted by Nginx for downstream browsers.

Backup options: "Full" (if no origin cert) or "Flexible" (**NOT recommended** because origin stays clear-text).

- Do NOT allow "Permissive" or flexible on production.
- Optionally set an Edge Certificates date.

## 11. Health Check

- Backend: `GET https://your-domain.com/api/v1/health` (`/api/v1/health/live` = liveness, `/api/v1/health/ready` = readiness)
- Parse: `{ "success": true, "status": "healthy" }`.
- Use these for your monitoring/alarms (Uptime Robot, Grafana, etc.).
- Compose container healthchecks also gate startup ordering.

## 12. Backup

```bash
docker/scripts/backup.sh ./backups
```
Produces `postgres-<ts>.sql.gz`, `redis-<ts>.rdb`, `minio-<ts>.tar.gz` + volume snapshot note.

Manual volume snapshot:
```bash
docker compose -f docker-compose.yml stop
tar czf backups/volumes-<ts>.tar.gz -C /var/lib/docker/volumes cashflow_postgres_data cashflow_redis_data
docker compose -f docker-compose.yml up -d
```

Schedule off the host (e.g. cron) and copy off-box (rsync/S3).

## 13. Rollback

- App rollback: rebuild with previous tag/image and `up -d`.
- DB rollback: restore a backup (destructive):
  ```bash
  docker/scripts/restore.sh backups/postgres-<ts>.sql.gz
  CASHFLOW_ENV_FILE=.env docker compose -f docker-compose.yml --env-file .env up -d --no-deps backend frontend
  ```
- Prefer deploying new migrations forward; if you must revert a migration, restore from backup.

## 14. Troubleshooting

| Symptom | Check |
|---|---|
| 502 from Nginx | `docker logs backend`, `curl backend:3001/api/v1/health` |
| Service stuck unhealthy | `docker compose ps`, container logs |
| Migrations fail | `docker logs backend`, DATABASE_URL reachability |
| PWA doesn't install | HTTPS required; check `/sw.js` + `/manifest.webmanifest` 200 |
| 401 everywhere | `JWT_SECRET` changed; tokens invalidated |
| Sync queue stuck offline | load `/` again while online to re-register SW + auto-flush |

### Observed ops
- `docker metrics`, `docker stats`, `docker logs -f backend frontend nginx`.

---

## Security Checklist (production)

- [ ] HTTPS via Cloudflare Full (strict)
- [ ] Cloudflare WAF enabled, rate-limit rules on `your-domain.com/api/*`
- [ ] Nginx security headers present
- [ ] `SECURE_COOKIES=true` heavily verified with identity auth
- [ ] JWT secrets rotated+pulled from env
- [ ] CORS `https://your-domain.com` only
- [ ] PostgreSQL/Redis/MinIO not internet-exposed
- [ ] `server_tokens off` (Nginx)
- [ ] No secrets in git (only `.env.example`)