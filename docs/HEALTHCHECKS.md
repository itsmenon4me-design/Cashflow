Infrastructure Health Checks for CashFlow Enterprise

Overview
--------
This document describes the health endpoints implemented for the backend. They are designed to be compatible with Docker healthchecks, Kubernetes liveness/readiness probes, CI/CD systems, reverse proxies, and monitoring tools.

Endpoints
---------
All endpoints are mounted under the global API prefix (default /api/v1):

- GET /api/v1/health - Full health report (application + dependency checks)
- GET /api/v1/health/live - Liveness probe (process alive)
- GET /api/v1/health/ready - Readiness probe (dependencies healthy)

Response format (example)
-------------------------
{
  "success": true,
  "status": "healthy",
  "application": "CashFlow Enterprise",
  "version": "v1",
  "environment": "development",
  "uptime": 123456,
  "timestamp": "2026-01-01T00:00:00.000Z",
  "checks": {
    "database": { "status": "healthy", "latency": 4 },
    "redis": { "status": "healthy", "latency": 1 }
  }
}

Docker Healthcheck
------------------
Use the readiness endpoint as the Docker healthcheck. Example in docker-compose:

healthcheck:
  test: ["CMD-SHELL", "curl -f http://localhost:3001/api/v1/health/ready || exit 1"]
  interval: 10s
  timeout: 5s
  retries: 3

Kubernetes
----------
- Liveness probe -> /api/v1/health/live (HTTP 200 indicates process is alive)
- Readiness probe -> /api/v1/health/ready (HTTP 200 indicates service ready to receive traffic)

Logging & Security
------------------
- Any unhealthy dependency is logged using the centralized LoggerService.
- No secrets, passwords, or internal stack traces are returned in responses.

Extensibility
-------------
The HealthService is implemented as a reusable service and can be extended to include additional checks such as:
- MinIO
- Message queue brokers (e.g., RabbitMQ)
- External API dependencies
- Disk space / filesystem checks

Notes
-----
- Ensure PrismaService and RedisService are properly configured for the environment where these checks run.
- The startup time used by uptime is the time when the HealthService instance was constructed — fine for process uptime measurements. If you prefer application-level start time from bootstrap, set an APP_START_TIME environment variable and read it in the service.
