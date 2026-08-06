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

Customization
-------------
- Use docker-compose.override.yml for development convenience (hot reload, port mapping, code mounts).
- For production, prefer building images and running them in a secure environment, and use Docker secrets for DB credentials.
