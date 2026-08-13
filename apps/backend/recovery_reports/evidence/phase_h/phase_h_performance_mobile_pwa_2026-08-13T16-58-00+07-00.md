# Phase H — Performance, Mobile/PWA & Real-Device Validation

## Executive summary
This validation was executed in a local-only environment and is therefore not a complete production-readiness picture. The codebase shows a functioning Next.js frontend, a valid NestJS build, and passing UI tests, but the required real Postgres-backed concurrency validation and real-device validation remain blocked by missing infrastructure.

## Environment
- Frontend: Next.js 16.3.0 / React 19.2.8
- Backend: NestJS 11.x / TypeScript / Prisma 7.x
- Database: Prisma schema present, but no live PostgreSQL instance was available for the integration tests.
- Real devices: not available.
- Security exception: `@nestjs/swagger@11.4.6 -> js-yaml@5.2.1` remains an unresolved upstream advisory.

## Build validation
- Frontend build: PASS
- Backend build: PASS
- TypeScript: PASS

## Frontend performance
The frontend production build compiled successfully and the app loads. No benchmark harness exists for a formal p50/p95/p99 measurement, so performance validation is limited to build-time and runtime smoke checks.

## Backend/API performance
The backend compiles and test suites are largely green, but no real database-backed load benchmark is available. API endpoint latency/throughput measurements remain blocked by environment availability.

## Database performance
Database benchmark validation is blocked because no local/staging PostgreSQL service was available. The transfers integration tests failed with `ECONNREFUSED` when connecting to Prisma.

## PWA validation
The manifest exists via `src/app/manifest.ts`, and the service worker exists at `public/sw.js`. Registration logic exists in the app provider. The app is not fully end-to-end validated as a production PWA because no live backend and no device install test were available.

## Offline validation
An offline banner and queueing logic exist; transactions are queued when offline. This is a meaningful partial implementation, but end-to-end offline sync was not validated against a real backend due missing CORS/backend availability.

## Mobile validation
A local browser-based smoke test at mobile viewport size rendered the home page without visible layout collapse. This does not replace real Android/iOS device validation.

## Real-device validation
REAL_DEVICE_VALIDATION: NOT_AVAILABLE

## Financial integrity under load
The backend has local validation and general test coverage, but the real PostgreSQL-backed concurrency tests are blocked. This limits confidence in live financial consistency under concurrent mutations.

## Race/concurrency validation
The real transfers concurrency suite failed due missing PostgreSQL and therefore is recorded as `ENVIRONMENT_BLOCKED`, not passed.

## Security exception
- `@nestjs/swagger@11.4.6 -> js-yaml@5.2.1`
- Advisory: `GHSA-pm4m-ph32-ghv5`
- Secondary attempted path: `@nestjs/swagger@11.4.5 -> js-yaml@4.3.0`
- Advisory: `GHSA-5p4m-2wfm-xmqj`
- Status: `UNRESOLVED_UPSTREAM`
- Application direct exploitability: `LIMITED / NOT_ESTABLISHED`
- Action: `MONITOR_UPSTREAM_RELEASE`

## Historical recovery status
- HISTORICAL_RECOVERY: `FINAL_HOLD / EXTERNAL_INFRA_DEPENDENCY`
- AUTHORITATIVE_EVIDENCE: `UNAVAILABLE`
- EXACT_MISMATCH_PROVEN: `FALSE`
- HUMAN_APPROVAL: `NOT_APPROVED`
- MUTATION_AUTHORIZED: `0`
- PRODUCTION_MUTATION: `0`
- PRODUCTION_RECOVERY: `NOT_EXECUTED`
- E.6.2: `NOT_PERMITTED`

## Blockers
- Missing real PostgreSQL for transfers integration concurrency tests.
- Missing real Android/iOS device access.
- Missing full benchmark harness.
- Local browser API smoke test showed a CORS block to localhost:3001.
- Upstream `@nestjs/swagger/js-yaml` advisory remains unresolved.

## Recommendations
1. Provision a local Postgres-backed staging environment and rerun the transfers concurrency tests.
2. Add a real mobile/PWA test harness or access actual devices.
3. Create a staging benchmark harness for dashboard, reports, and transaction endpoints.
4. Keep the security exception documented until upstream package fix is verified.
5. Do not proceed to production recovery or mutation operations.

## Final phase decision
Status: PARTIAL

The repository is buildable and mostly testable in local conditions, but required real infrastructure-backed validation is still blocked. Phase H remains incomplete, not failed by application code alone, but blocked by environment and dependency exceptions.
