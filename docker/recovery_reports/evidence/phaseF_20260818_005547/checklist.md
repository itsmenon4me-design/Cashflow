# Phase F — Income E2E Credential Unblock — CHECKLIST

Date: 2026-08-18
Evidence dir: docker/recovery_reports/evidence/phaseF_20260818_005547/
Prior evidence (untouched): phaseF_20260818_002155, phaseF_20260818_003536, phaseF_20260818_003734, phaseF_20260818_005050

## STEP 1 — READ-ONLY inspection (provisioning mechanisms found)

- apps/frontend/playwright/income-e2e.spec.ts — supports E2E_EMAIL / E2E_PASSWORD env overrides (lines 7-8); FRONTEND_BASE override (line 5)
- docker/run_verify_and_playwright.ps1 — official verify helper; does NOT provision E2E users
- prisma/seed.ts — seeds only admin@cashflow.local / admin123
- prisma/multi_currency_seed.sql — creates e2e.user@test.local with placeholder hash (not usable for login)
- prisma/multi_currency_seed_for_registered_user.sql — post-registration data for canonical user 95c4e837-... (e2e.api.user@test.local)
- No official mechanism provisions e2e.income2@test.local / longpassword123 (user exists in verify DB with unknown/other password)

## STEP 2 — Official unblock method chosen

Spec-documented env-var mechanism (E2E_EMAIL / E2E_PASSWORD) with the known-valid E2E user:
- E2E_EMAIL=e2e.api.user@test.local
- E2E_PASSWORD=TestPass123!
- FRONTEND_BASE=http://localhost:8080
- API_BASE=http://localhost:3101/api/v1
No source/test/Docker/database changes. No ad-hoc SQL password update.

## STEP 3 — Login smoke check

POST http://localhost:3101/api/v1/auth/login -> HTTP 201 (auth/income-e2e-login-smoke.log)
PASS — credential valid before Playwright run.

## STEP 4 — Income E2E rerun (ONLY income spec)

Command: npx playwright test playwright/income-e2e.spec.ts --workers=1 --trace=retain-on-failure --timeout=180000 --reporter=list
Result: FAIL (exit code 1) — NEW failure point, beforeAll login now PASSES.

Successful operations observed in the run:
- beforeAll login: PASS (201)
- category created: PASS (E2E Income Cat ...)
- account created: PASS (USD)
- POST /transactions: 201, created tx id 89db552e-c636-4ee1-bfbd-dce3ae0c88b5
- GET /transactions after reload: created tx present (totalItems=4)
- View dialog opened, date asserted
- Navigated to /transactions page, search filter, Edit dialog opened
- PATCH /transactions: 201, note updated "E2E Income ... UPDATED"

Failure:
- Spec line 272: page.waitForResponse(GET /transactions) Timeout 10000ms exceeded
- Sequence: line 267 fill(updatedSearch) -> line 268-270 Promise.all([waitForResponse(GET), press Enter]) -> line 272 SECOND waitForResponse(GET /transactions) never fired within 10s
- Only one filtered GET appears to fire per search action; the second waitForResponse consumes a request that never arrives (spec race/timing issue)

## Classification

- Layer: test fixture/spec robustness (race in double waitForResponse after search filter)
- Product defect: NOT PROVEN — all API operations succeeded with consistent data
- Auth/environment: resolved (credentials now valid)
- Prior blocker (credential mismatch): RESOLVED via official env-var mechanism

## Decision

PHASE F remains NOT COMPLETE — STOPPED at Income E2E (second failure, spec-level).
No fixes applied. No reruns. No other tests executed. Expense/Transactions/Currency/Reports/Phase9/Backend targeted suites NOT RUN.