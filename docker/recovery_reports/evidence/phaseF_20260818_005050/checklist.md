# Phase F — Remaining Verification — CHECKLIST

Date: 2026-08-18
Evidence dir: docker/recovery_reports/evidence/phaseF_20260818_005050/
Baseline (not rerun):
- Phase 13 = COMPLETE (BASELINE LOCKED)
- Backend gate PASS: 101/101 suites, 745/745 tests, exit 0 (phaseF_20260818_003536)
- Frontend build / Docker / recreate / healthchecks PASS (phaseF_20260818_003734)
- Phase 13 regression PASS: 2/2 (multi-currency-acceptance.final.spec.ts)

## Execution order (stopped at first failure per rules)

| Step | Spec | Result | Evidence |
|------|------|--------|----------|
| STEP 1 | playwright/income-e2e.spec.ts | **FAIL** | playwright/income-e2e.log |
| STEP 2 | playwright/expense-e2e.spec.ts | NOT RUN (stop at first failure) | - |
| STEP 3 | playwright/transactions-e2e.spec.ts | NOT RUN | - |
| STEP 4 | playwright/transactions-currency-e2e(+e2e2).spec.ts | NOT RUN | - |
| STEP 5 | playwright/multi-currency-acceptance.reports-analytics.spec.ts | NOT RUN | - |
| STEP 6 | playwright/phase9.spec.ts | NOT RUN | - |
| STEP 7 | Backend targeted suites | NOT RUN | - |

## Failure details

- Test: playwright/income-e2e.spec.ts:50:7 "Create → View → Edit → Delete Income via UI"
- Failure point: test.beforeAll (line 26): `expect(login.ok()).toBeTruthy()` — Received: false
- API request: POST http://localhost:3101/api/v1/auth/login { email: "e2e.income2@test.local", password: "longpassword123" }
- API response: 401 {"success":false,"message":"Invalid credentials","errorCode":"ERR_INVALID_CREDENTIALS"}
- Exit code: 1 (Playwright)
- Trace: playwright/income-e2e-test-results/trace.zip
- Error context: playwright/income-e2e-test-results/error-context.md

## Diagnosis evidence (read-only, no fixes)

1. Direct curl POST login for e2e.income2@test.local / longpassword123 via 3101 AND 8080 -> both 401 ERR_INVALID_CREDENTIALS.
2. DB (read-only SELECT): user e2e.income2@test.local EXISTS (id db1ba82c-1ef2-4323-8f02-addd8ae8f91d, status ACTIVE, email_verified_at 2026-08-17T09:03:28Z) — but its stored password hash does not match the spec's hardcoded default password.
3. Contrast: POST login for e2e.api.user@test.local / TestPass123! (user used by canonical Phase 13 specs) -> 201 success. Auth path is fully functional.
4. No seed in the repository creates e2e.income2@test.local (grep: only multi_currency_seed.sql -> e2e.user@test.local with placeholder hash). The user was created at some earlier point with a different password.

## Classification

- Layer: environment / test fixture setup (user provisioning)
- Type: NOT a production defect. Auth behaves correctly (401 for wrong credentials).
- Test defect: no — the spec's default credentials simply do not match the provisioned user's password in this verify DB.
- Fix options (NOT applied, require approval): provision the E2E user with the expected password via the official registration/seed flow, or run with E2E_EMAIL/E2E_PASSWORD env matching an existing user.

## Decision

PHASE F = NOT COMPLETE — stopped at first failure (Income E2E).
No fixes applied. No reruns. No further steps executed.