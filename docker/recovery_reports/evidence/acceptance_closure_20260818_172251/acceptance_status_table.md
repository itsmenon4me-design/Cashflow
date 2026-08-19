# CashFlow manual-QA bugs #1-#15 — acceptance status (2026-08-18, verify stack)

Environment: rebuilt verify stack cashflowverify (nginx :8080, API :3101, postgres :55432 db=cashflow).
Fixture: e2e.api.user@test.local (id 3634cf2a-8973-491b-9518-bf44af639b4a, ACTIVE, 16 tx: IDR=4/USD=4/SGD=3/EUR=5).
Evidence root: docker/recovery_reports/evidence/ (acceptance_closure_20260818_172251/ + phaseF_20260818_*).

| # | Bug (short) | Root cause / fix | Runtime evidence | Status |
| --- | --- | --- | --- | --- |
| 1 | OAuth login unavailable | No OAuth credentials provisioned; fail-safe 400s confirmed | (blocked, evidence-only) | BLOCKED |
| 2 | Income flow | Search/debounce + queryConfig + accountCurrencies wiring | income-e2e.spec.ts PASS (6.3s), phaseF_20260818_183000/income-e2e.log | CLOSED |
| 3 | Expense/currency refetch | No full reload; soft refetch on currency change | expense-e2e PASS (5.0s) + multi-currency-acceptance.final PASS (45.3s, UI=API per currency) | CLOSED |
| 4 | Account name unique per currency | Partial unique index (user_id,name) WHERE deleted_at IS NULL + service pre-checks | accounts.integration.spec.ts 5/5 PASS vs real DB (integration_spec_result.txt + rerun after cleanup) | CLOSED |
| 5 | Currency selector + QuickAdd placement | Approved design: QuickAdd dashboard-only, selector elsewhere | phase9.spec.ts PASS (44.7s), quickAddOnDashboard=true/accounts=false, selectorOnAccounts=true | CLOSED |
| 6 | Notifications clear-all missing | removeAll + "Hapus Semua" button | search-and-notifications-e2e.spec.ts PASS: DELETE /notifications 200, UI empty state, API totalItems=0 | CLOSED |
| 7 | Dashboard QuickAdd | showQuickAdd routing rule in header-bar | phase9 PASS (nav asserts) | CLOSED |
| 9 | Search (incomes/expenses/topbar) dead | Debounce + queryConfig + header search -> /transactions?q= | search-and-notifications-e2e PASS: q=424242 -> /transactions?q=, api_total=1, ui_rows=1 | CLOSED |
| 11 | Budget year window | YEAR_OPTIONS_RANGE=12, current-1..current+10 | budgets/constants.ts unit coverage (earlier vitest PASS) | CLOSED |
| 13 | Topbar global search | Same wiring as #9 (header-bar search) | #9 E2E (above) | CLOSED |
| 16 | Reports data/hook effect | currency refetch deps + accountCurrencies | multi-currency-final PASS: reports error_state=false, 2 monthly calls/currency, UI=API | CLOSED |
| 17 | Analytics currency | Same fix pattern | multi-currency-final PASS: analytics UI=API, formatted Rp 300.000 / $7,500.00 / $500.00 / 5.000,00 EUR | CLOSED |
| 18 | Backend currency DTO validation | @IsIn(['IDR','USD','SGD','EUR']) on accounts/analytics DTOs | tsc EXIT=0 + backend jest suites PASS (acceptance_closure/backend_full_suite_*.txt) | CLOSED |
| 19 | Backend transaction search | searchByUser (note/reference/id/amount/type) + q filter | #9 E2E (q=424242 hits searchByUser) | CLOSED |
| 20 | Backend integration hygiene | isolation + accounts integration specs | isolation 8/8 + accounts 5/5 PASS vs real DB; full suite 100/101 (only writeback tripwire, out of scope) | CLOSED |

## Test/evidence status (all runs)
- Backend jest no DB: 101 suites / 745 tests PASS (EXIT=0) — backend_full_suite_no_db_result.txt
- Backend jest with verify DB: 100/101 suites, 744/745 tests; sole failure = historical-recovery-writeback
  tripwire (requires localhost:5433; not provisioned; deliberately untouched, documented in backend_evidence_summary.md)
- Frontend vitest 11/11 PASS; tsc EXIT=0 (backend + frontend)
- E2E: phase9 1/1, income 1/1, expense 1/1, multi-currency-final 2/2, search-and-notifications 2/2 — all PASS
  against live verify stack with real JWT auth (no mocks)

## Skips (documented, no fake PASS)
- transactions-e2e.spec.ts: NOT run — deleteUserArtifacts deletes the fixture user id
  (00000000-...), would destroy the evidence fixture; its month-filter scope is covered by
  multi-currency-final date-range assertions
- transactions-currency-e2e(.e2e2).spec.ts: NOT run — e2e variant is an incomplete file
  (truncated mid-line); e2e2 injects a dummy JWT (would 401 against the real API); both are
  superseded by multi-currency-acceptance.final.spec.ts (real auth, stronger assertions)
- historical-recovery-writeback.integration.spec.ts: fails by design off-port; out of #1-#15 scope

## Verify DB hygiene (this session)
- Deleted stale users (children-first, in-transaction): e2e.user@test.local (id 00000000-...,
  duplicate seed) + leaked acc-int-b-1787050004368@example.com; 2 categories referenced by
  fixture tx reassigned to fixture user
- accounts.integration.spec.ts user-B cleanup now in finally (re-run 5/5 PASS, no leak:
  accounts_integration_rerun_after_cleanup.txt)
- DB now: admin@cashflow.local + e2e.api.user@test.local only; notifications=0;
  fixture re-verified 4/4/3/5 via API (run-multi-currency-api-check.ps1)
- Entrypoint `prisma db seed` is a no-op (no prisma.seed config) -> deletions persist across rebuilds
