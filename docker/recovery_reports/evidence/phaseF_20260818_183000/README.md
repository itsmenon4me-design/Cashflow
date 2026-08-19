# Phase F evidence — income/expense/currency E2E + search & notifications (2026-08-18 18:30)

## Scope
E2E runtime evidence on the rebuilt verify stack (nginx :8080, API :3101,
postgres :55432 db=cashflow) for the code fixes delivered earlier today.

## Specs run (all PASS)
| Spec | Result | Log |
| --- | --- | --- |
| phase9.spec.ts (selector/QuickAdd persistence) | 1 passed (44.7s) | phaseF_20260818_181500/playwright-phase9.log |
| income-e2e.spec.ts (Create/View/Edit/Search/Delete) | 1 passed (6.3s) | income-e2e.log |
| expense-e2e.spec.ts (Create/View/Edit/Search/Delete) | 1 passed (5.0s) | expense-e2e.log |
| multi-currency-acceptance.final.spec.ts | 2 passed (45.3s) | multi-currency-final.log |
| search-and-notifications-e2e.spec.ts (#9 + #6) | 2 passed (9.3s) | search-notifications-e2e.log |

## Verified behaviors
- /transactions list, /dashboard/summary, /dashboard/widgets all carry
  ?currency=<stored>; per-currency totals match fixture (IDR=4 USD=4 SGD=3 EUR=5);
  no foreign-currency records
- analytics + reports pages: UI=API with correct per-currency formatting
  (Rp 300.000 / $7,500.00 / $500.00 / 5.000,00 €); reports error_state=false with
  2 monthly calls per currency (STEP G reports fix)
- Quick Add on dashboard only; currency selector on /transactions + /accounts
  (approved #5/#7 design); localStorage cashflow-dashboard-currency persists
- Header search -> /transactions?q=<term> filters list (Bug #9)
- "Hapus Semua" clears all notifications via DELETE /notifications; UI empty
  state + API totalItems=0 (Bug #6)

## Fixture state (post-run, verified via API)
- e2e.api.user@test.local: 16 active tx (4/4/3/5), notifications=0
- verify DB users: admin@cashflow.local, e2e.api.user@test.local only
  (stale duplicates deleted; see checklist-search-notifications.md)

## Commands (patterns)
- E2E: npx playwright test apps/frontend/playwright/<spec>.spec.ts --workers=1
  --trace=retain-on-failure --timeout=180000 --reporter=list
  with BASE_URL=http://localhost:8080 API_BASE=http://localhost:3101/api/v1
  E2E_EMAIL=e2e.api.user@test.local E2E_PASSWORD=TestPass123!
- Backend integration: npx jest --silent modules/accounts/accounts.integration.spec.ts
  --verbose with DATABASE_URL=postgresql://postgres:<verify-pass>@localhost:55432/cashflow
  (no ?schema=public suffix; env from docker/.env.verify)
