# Phase F — Multi-currency acceptance (canonical) — evidence checklist

## Run
- Date: 2026-08-18 03:33:58 (local)
- Command: `npx playwright test apps/frontend/playwright/multi-currency-acceptance.final.spec.ts --workers=1 --trace=retain-on-failure --timeout=180000 --reporter=list`
- Workdir: apps/frontend
- Stack: cashflowverify (verify compose), BASE_URL=http://localhost:8080, API_BASE=http://localhost:3101/api/v1, TEST_DATABASE_URL=postgresql://postgres:verifypass@localhost:55432/cashflow?schema=public

## Result
- PASSED: 2 passed (49.5s)
- Test 1 (STEP 2 Transactions Currency): Transactions UI matches API and does not show foreign-currency IDs after switch
- Test 2 (STEP 3 Reports/Analytics): Reports and Analytics UI reflect active currency and match API

## Fixture setup (verify DB only, no code changes)
- Registered `e2e.api.user@test.local` / `TestPass123!` via POST /api/v1/auth/register (public product API)
- New user id: 3634cf2a-8973-491b-9518-bf44af639b4a (username e2eapiuser)
- Status flipped PENDING_VERIFICATION -> ACTIVE in verify DB (login guard rejects non-ACTIVE; previous fixture was ACTIVE per evidence)
- Applied prisma/multi_currency_seed.sql (idempotent; spec beforeAll also runs it)
- Applied prisma/multi_currency_seed_for_registered_user.sql with user id substituted 95c4e837... -> 3634cf2a... (accounts 50000000-*, transactions 60000000-*)
- DB verification: IDR=4, USD=4, SGD=3, EUR=5 -> matches EXPECTED counts

## Observed output (from log)
- Transactions: currency=IDR api_total=4 ui_rows=4 ui_matches_api=true; USD 4/4 true; SGD 3/3 true; EUR 5/5 true
- Analytics: api_tx == ui_tx for all 4 currencies; api_income formatted strings matched UI (Rp 300.000 / $7,500.00 / $500.00 / 5.000,00 EUR)
- Reports: api_tx ok=true for all 4; ui error_state=false; ui_tx matched api_tx

## Files
- command.txt, env_summary.txt, playwright-multicurrency.log (this dir)
- No trace.zip (no failure)
