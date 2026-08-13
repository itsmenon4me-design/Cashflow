# Phase H.5 — Staging Runtime Completion & Full Runtime Validation

Timestamp: 2026-08-13T11:20:00Z

Summary:
- STAGING_RUNTIME: PASS — local Docker Compose staging stack (Postgres, Redis, MinIO, backend, frontend) started and healthy.
- POSTGRESQL: PASS — dedicated staging database reachable and migrations applied.
- PRISMA: PASS — client generated and migrations deployed.
- MIGRATION: PASS — all migrations applied by backend entrypoint.
- BACKEND: PASS — full Jest suite executed inside backend container: 541 tests, 0 failed.
- FRONTEND: PASS — Next.js production build succeeded.
- CORS: PASS — no unresolved CORS errors observed in frontend <-> backend interactions.

Tests:
- FULL_TESTS: 541
- FAILED_TESTS: 0
- Evidence: apps/backend/recovery_reports/evidence/phase_h/h5_runtime_completion/backend_full_test_container.json

Concurrency / Transfer Integration:
- CONCURRENCY: PASS — transfer concurrency integration tests executed inside container and passed (3 tests).
- Evidence: apps/backend/recovery_reports/evidence/phase_h/h5_runtime_completion/concurrency_validation.json

Benchmark (staging local):
- BENCHMARK: PARTIAL (executed; staging-only measurements)
- Target: http://localhost:3001/api/v1
- Config: totalRequests=500, concurrency=10, pacingMs=10
- Overall (selected):
  - total: 500
  - successes: 249
  - failures: 251
  - error_rate: 0.502
  - throughput_rps: 307.88
  - p50: 16 ms
  - p95: 45.10 ms
  - p99: 101.05 ms
- Findings: Some endpoints (notably auth/login and transaction-create in certain runs) experienced high failure rates driven by payload validation and per-endpoint constraints. The harness was reworked to use email/password and amount_cents/account_id/category_id payloads; further per-endpoint tuning (BENCH_ACCOUNT_ID, BENCH_CATEGORY_ID) is recommended.
- Evidence (raw):
  - apps/backend/recovery_reports/evidence/phase_h/h3_benchmark/benchmark_result_2026-08-13T11-42-59-216Z.json
  - apps/backend/recovery_reports/evidence/phase_h/h3_benchmark/benchmark_result_2026-08-13T11-42-59-216Z.md

Database Performance (selected EXPLAIN ANALYZE):
- Files:
  - apps/backend/recovery_reports/evidence/phase_h/h5_runtime_completion/explain_transactions_list.txt
  - apps/backend/recovery_reports/evidence/phase_h/h5_runtime_completion/explain_transactions_agg.txt
  - apps/backend/recovery_reports/evidence/phase_h/h5_runtime_completion/explain_transactions_30d.txt
  - apps/backend/recovery_reports/evidence/phase_h/h5_runtime_completion/explain_audit_logs.txt
- Observation: EXPLAIN ANALYZE shows Seq Scan on transactions for the sampled queries (user-scoped list and aggregations). This suggests missing index(es) for user_id / created_at. Do not apply schema changes without further evidence from production-like load.

Offline E2E / PWA:
- OFFLINE_E2E: PARTIAL — Playwright headless automation executed. IndexedDB queueing was validated (queuedCount=1). Automatic in-page flush did not complete in the headless run; a manual flush attempt was performed and was inconclusive. Recommend re-running in headed mode or on a real device to validate syncController.flush behavior and idempotency end-to-end.
- PWA: PARTIAL — manifest, service worker and build verified by code inspection and runtime checks where possible. Service worker configured to avoid unsafe caching of authenticated API responses. Runtime SW behavior and installability require physical-device checks for final validation.
- REAL_DEVICE: NOT_AVAILABLE — no physical Android/iOS testing performed.

Other:
- TYPESCRIPT: PASS
- BUILD: PASS (frontend build OK)
- SECURITY_EXCEPTION: UNRESOLVED_UPSTREAM (@nestjs/swagger -> js-yaml) — preserved
- HISTORICAL_RECOVERY: FINAL_HOLD / EXTERNAL_INFRA_DEPENDENCY — preserved
- PRODUCTION_MUTATION: 0
- PRODUCTION_RECOVERY: NOT_EXECUTED
- E.6.2: NOT_PERMITTED

Limitations and Next Steps:
1. Investigate benchmark failures for write endpoints (POST /transactions, POST /auth/login behavior). Adjust benchmark payloads to match API DTOs and re-run.
2. Install Playwright (or equivalent) and run deterministic offline E2E: simulate offline enqueue, restore connectivity, verify exactly-once persistence and idempotency.
3. Perform PWA installability checks and offline SW behavior with browser automation and on physical devices (REAL_DEVICE remains NOT_AVAILABLE).
4. Run deeper database perf profiling and consider targeted indexes only when justified by query plans and observed load.

Safety:
- No production credentials used.
- No production DB access or production mutations performed.
- Historical recovery (E.6) and security exception preserved per constraints.

Evidence bundle location:
- apps/backend/recovery_reports/evidence/phase_h/h5_runtime_completion/

Prepared by: Automated H.5 runtime execution (local staging via Docker Compose).
