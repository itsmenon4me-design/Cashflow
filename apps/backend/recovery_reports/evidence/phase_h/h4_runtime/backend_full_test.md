# H.4.2 Backend Full Test Run

Timestamp: 2026-08-13T17:38:00Z
Environment: LOCAL_VALIDATION_ONLY

Commands executed:
- Set-Location apps/backend; npx tsc --noEmit
- Set-Location apps/backend; npm test -- --runInBand

TypeScript: PASS (backend tsc --noEmit succeeded)

Jest Test Summary:
- total: 541
- passed: 538
- failed: 3
- skipped: 0

Failing tests (exact):
1) src/modules/transfers/services/transfers.service.integration.spec.ts
   - Test: "TransfersService integration concurrency (requires real Postgres) › Case A: two concurrent transfers that exactly consume balance"
   - Error: PrismaClientKnownRequestError: Invalid prisma.user.create() invocation — indicates Postgres connection attempts failed (ECONNREFUSED).

Failure classification: ENVIRONMENT_BLOCKED — the failing tests require a running Postgres instance (integration tests). They are not flagged here as code defects. Provision a staging/test Postgres and re-run the suite to verify.

Safety: No production databases or credentials were used.

Next steps: Start a staging Postgres and re-run tests.
