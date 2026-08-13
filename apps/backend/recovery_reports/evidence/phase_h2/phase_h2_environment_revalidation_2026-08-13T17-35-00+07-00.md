# Phase H.2 — Environment Revalidation

## 1. Executive summary

This revalidation addressed the infrastructure blocker that had prevented real PostgreSQL-backed validation. The repo’s local/staging Postgres instance was provisioned successfully on localhost:5433, Prisma validated and migrated successfully, and the previously blocked transfer integration/concurrency suite passed against a live local PostgreSQL database. Frontend and backend connectivity was restored locally, and the browser page responded correctly with no CORS failure. The remaining gaps are not infrastructure blockers: the project still lacks physical Android/iOS validation and a benchmark harness for p50/p95/p99 and throughput measurement, so the Phase H.2 status is `PARTIAL` rather than `PASS`.

## 2. Environment

- PostgreSQL: local Docker container `postgres:15` running on `localhost:5433`
- Database name: `cashflow`
- Database user: `postgres`
- Prisma schema: `prisma/schema.prisma`
- Backend health check: `http://localhost:3001/api/v1/health` returned `200 OK`
- Frontend smoke check: `http://localhost:3000` loaded successfully
- Security exception: `@nestjs/swagger -> js-yaml` remains `UNRESOLVED_UPSTREAM`
- Historical recovery status: `FINAL_HOLD / EXTERNAL_INFRA_DEPENDENCY`

## 3. Build validation

- TypeScript: PASS (`npx tsc --noEmit` in `apps/backend` succeeded)
- Backend tests: PASS (`541 passed, 0 failed` from `npm test -- --runInBand`)
- Backend build: PASS (`npm run build` succeeded)
- Frontend build: PASS (`npm run build` in `apps/frontend` succeeded)

## 4. Frontend performance

- Frontend build completed successfully in production mode.
- Next.js app rendered at `http://localhost:3000` without startup errors.
- No specific frontend performance regression was identified in the current local smoke validation.
- Status: `PARTIAL` because there was no benchmark harness and no measured p50/p95/p99 dataset.

## 5. Backend/API performance

- Backend health endpoint responded successfully.
- API and route startup were correct, and the app served requests on port 3001.
- No latency harness was run for the API endpoints; no benchmark numbers were fabricated.
- Status: `PARTIAL`.

## 6. Database performance

- Local PostgreSQL connection was validated and migrations succeeded.
- Transfer integration cases passed under live Postgres.
- No formal p50/p95/p99 benchmark suite existed for this repo, so performance claims remain limited to local functionality checks.
- Status: `PARTIAL`.

## 7. PWA validation

- A manifest exists at `apps/frontend/src/app/manifest.ts`.
- A service worker exists at `apps/frontend/public/sw.js`.
- The app showed offline-related UI state during local smoke validation.
- Full installability and device-level PWA validation were not performed because no real device was available.
- Status: `PARTIAL`.

## 8. Offline validation

- The app showed offline state and shell behavior during page load.
- The offline provider and sync flow exist in the codebase, but real transition testing across install/device conditions was not available.
- Status: `PARTIAL`.

## 9. Mobile validation

- Browser smoke validation succeeded for the main app shell.
- The repo contains responsive layout code and mobile-oriented routes, but no real device or device emulation suite was run across the required viewports.
- Status: `PARTIAL`.

## 10. Real-device validation

- Real Android and iOS devices were not available.
- Real-device validation remains `NOT_AVAILABLE`.

## 11. Financial integrity under load

- The real Postgres-backed transfer integration suite passed all 3 cases.
- The tested scenarios included:
  - exactly consuming source balance
  - one successful transfer when concurrent requests exceed balance
  - repeated pack of transfers with balanced outcomes
- This is a positive local/staging validation; no production funds were involved.
- Status: `PASS`.

## 12. Race/concurrency validation

- The transfer integration suite passed under live Postgres, including concurrent transfer scenarios and multiple consecutive transfer attempts.
- No duplicate ledger mutation or negative-balance race was observed in the local validation run.
- Status: `PASS`.

## 13. Security exception

```
SECURITY_EXCEPTION:
UNRESOLVED_UPSTREAM

APPLICATION_DIRECT_EXPLOITABILITY:
LIMITED / NOT_ESTABLISHED

ACTION:
MONITOR_UPSTREAM_RELEASE

BLOCKING:
DOCUMENTED_EXCEPTION
```

The backend `npm audit --audit-level=high --json` still reported:

- `@nestjs/swagger@11.4.6 -> js-yaml@5.2.1`
- advisory: `GHSA-pm4m-ph32-ghv5`

This remains documented as an upstream exception and was not silently ignored.

## 14. Historical recovery status

```
HISTORICAL_RECOVERY:
FINAL_HOLD / EXTERNAL_INFRA_DEPENDENCY

AUTHORITATIVE_EVIDENCE:
UNAVAILABLE

HUMAN_APPROVAL:
NOT_APPROVED

MUTATION_AUTHORIZED:
0

PRODUCTION_MUTATION:
0

PRODUCTION_RECOVERY:
NOT_EXECUTED

E.6.2:
NOT_PERMITTED
```

No production mutation or recovery was performed.

## 15. Blockers

- Real Android/iOS device validation remains unavailable.
- No benchmark harness exists for local p50/p95/p99 and throughput measurement.
- PWA and offline validation were partially assessed via local smoke checks but not through install/device-level validation.

## 16. Recommendations

1. Keep the local Postgres staging database as the standard validation target for transfer and integrity tests.
2. Add a minimal benchmark harness for dashboard, transactions, transfer, and report endpoints in local/staging.
3. Validate installability and offline behavior on a real iOS/Android device or device farm.
4. Continue documenting the upstream `@nestjs/swagger -> js-yaml` exception until a verified upstream fix is available.
5. Do not reopen historical recovery or production recovery operations while the evidence remains externally dependent.

## 17. Final phase decision

The local/staging environment blockers were resolved enough to run the actual PostgreSQL-backed validation. The core database, Prisma, migration, transfer/concurrency, and frontend/backend integration checks passed. However, because physical mobile testing and a benchmark harness remain unavailable, the final phase result is `PARTIAL`, not `PASS`.
