# Phase F — STEP 4: phase9.spec.ts (currency selector runtime verification) — evidence checklist

## Run
- Date: 2026-08-18 04:07:12 (local)
- Command: `npx playwright test apps/frontend/playwright/phase9.spec.ts --workers=1 --trace=retain-on-failure --timeout=180000 --reporter=list`
- Workdir: apps/frontend
- Stack: cashflowverify, BASE_URL=http://localhost:8080, API_BASE=http://localhost:3101/api/v1

## Result
- **PASSED: 1 passed (33.7s)** — STEP 12G-1 PHASE 9: currency selector runtime verification

## Remediation history (all approved, test-only, phase9.spec.ts)
1. Auth fixture: dummy tokens -> real API login (e2e.api.user@test.local / TestPass123! via E2E_EMAIL/E2E_PASSWORD env; beforeAll pattern from multi-currency-acceptance.final.spec.ts)
2. Field extraction fix: user = body.user (top-level sibling of data, NOT data.user) — verified response shape via API
3. URL base fix: `new URL(url, location.href)` -> `new URL(url, base)` (Node context has no `location`)
4. Storage key alignment: sessionStorage -> localStorage for `cashflow-dashboard-currency` (app store dashboardCurrency.store.ts reads localStorage FIRST; setCurrency writes localStorage + clears sessionStorage)

No assertion/timeout/product-code changes. No tokens/secrets in this dir.

## Evidence from run (log)
- summary/widgets API: GET /api/v1/dashboard/summary|widgets?currency={IDR,USD,SGD,EUR} -> HTTP 200, currency echoed
- uiText per currency: IDR, USD, SGD, EUR (selector reflects each)
- summary total_transactions per currency: IDR=4, USD=4, SGD=3, EUR=5 (matches fixture)
- persisted: USD; quickAddPresent on /accounts: true
- waitForResponse for summary/widgets now resolves (previously 3s timeout each iteration)

## Files
- command.txt, env_summary.txt, playwright-phase9.log, result.txt (this dir)
- No trace.zip (PASS)