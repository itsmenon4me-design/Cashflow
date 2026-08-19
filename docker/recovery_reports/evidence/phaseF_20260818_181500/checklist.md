# phase9.spec.ts — currency selector runtime verification (re-run 2026-08-18)

## Command
npx playwright test apps/frontend/playwright/phase9.spec.ts --workers=1 --trace=retain-on-failure --timeout=180000 --reporter=list

Environment: BASE_URL=http://localhost:8080, API_BASE=http://localhost:3101/api/v1,
E2E_EMAIL=e2e.user@test.local, E2E_PASSWORD=TestPass123!

Fixture: user e2e.user@test.local (id 00000000-0000-0000-0000-000000000001, ACTIVE,
argon2id hash of TestPass123!) + deterministic 16 transactions (IDR=4, USD=4,
SGD=3, EUR=5) from prisma/multi_currency_seed.sql, applied to verify DB
(cashflowverify_postgres, db=cashflow) after the fixture user was found missing
(previous fixture belonged to a deleted user id).

## Result
1 passed (44.7s) — full log: playwright-phase9.log

## Verified runtime behavior (captured in-log)
- /dashboard/summary and /dashboard/widgets respond 200 and carry ?currency=
  matching the stored currency for IDR, USD, SGD, EUR (4 reloads)
- Per-currency totals: IDR=4, USD=4, SGD=3, EUR=5 (matches fixture)
- Header selector text on /transactions equals the stored currency (uiText per c)
- /transactions list request carries currency=<stored> (e.g.
  /api/v1/transactions?page=1&limit=10&sortBy=date&sortOrder=desc&currency=IDR&fromDate=2026-08-01&toDate=2026-08-31)
- Persistence: localStorage cashflow-dashboard-currency = USD after reload
- Approved #5/#7 design: quickAddOnDashboard=true, quickAddOnAccounts=false,
  selectorOnAccounts=true

## Spec changes vs previous run (2026-08-18 04:07, old header design)
Header previously showed the currency selector on /dashboard and Quick Add
everywhere else; approved product decision (#5/#7, 2026-08-18) inverted it:
Quick Add on dashboard routes only, currency selector on all other routes.
- selector assertion moved from /dashboard to /transactions
- network capture extended to /transactions?currency= requests
- final nav checks now assert QuickAdd on /dashboard, no QuickAdd + selector on
  /accounts (previously a non-asserted heuristic)
- NOTE: captured-entries console array remains empty by design (entries are read
  per currency via page.evaluate; the var is a no-op placeholder)
