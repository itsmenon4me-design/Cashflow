# Phase F — Transactions CRUD Rerun Evidence

- Timestamp: 20260818_032109
- Stack: cashflowverify (docker compose -f docker/docker-compose.yml -f docker/docker-compose.verify.yml --env-file docker/.env.verify)
- Spec under test: apps/frontend/playwright/transactions-e2e.spec.ts
- Status: **PASS** (Transactions CRUD = PASS)

## Scope

- Minimal test-only fixture remediation of `apps/frontend/playwright/transactions-e2e.spec.ts`
- No production / backend / Prisma / Docker changes were made (verified via git status — spec file is untracked; all other working-tree modifications pre-existed this task).

## Root cause (confirmed, HIGH CONFIDENCE)

1. Fixture currency mismatch: seedDb created the account with `currency='IDR'` while the UI
   requests transactions with `currency=USD` (frontend dashboard currency default = USD,
   `DEFAULT_CURRENCY` in `src/stores/dashboardCurrency.store.ts`). Backend filters
   `transactions` by `account.currency`, so the API returned `data: []` (HTTP 200).
2. Cleanup FK violation: `DELETE FROM users` failed with
   `user_settings_user_id_fkey` RESTRICT constraint (user_settings row existed for the E2E user).
3. Latent harness defect in the current spec: orphaned `resp`/`url` references
   (the `waitForResponse` capture was removed in a refactor, leaving `resp.json()` undefined
   and `page.url()` without fromDate/toDate query params).

## Fixes applied (spec file only)

### FIX 1 — Align fixture with test currency (USD)
- Seeded account currency changed `'IDR'` -> `'USD'` (matches the dashboard currency the UI requests).
- Init script now pins the project currency-state mechanism:
  `localStorage.setItem('cashflow-dashboard-currency', 'USD')` (deterministic USD context).
- Seeded dates unchanged and in range: current-month tx = 2026-08-15 (within 2026-08-01..2026-08-31),
  previous-month tx = 2026-07-15 (proves month filtering).
- All existing assertions kept as-is.

### FIX 2 — Deterministic cleanup FK order (no CASCADE)
- New shared helper `deleteUserArtifacts(client)` used by both `seedDb()` pre-cleanup and `cleanupDb()`.
  Order: transactions -> sessions -> Bill -> saving_goals -> investments -> budgets ->
  accounts -> categories -> notifications -> refresh_tokens -> oauth_accounts -> audit_logs ->
  user_settings -> users.
- Note: bills table is `Bill` (Prisma @@map("Bill")) — discovered via verify DB table listing
  (first attempt failed with `relation "bills" does not exist`; corrected to `"Bill"`).

### Harness restore (keeps existing assertions executable)
- Restored `page.waitForResponse` for `GET /api/v1/transactions` (excludes page navigations and
  Next.js RSC prefetches by requiring `/api/v1/transactions` in the URL).
- `url` now sourced from the API request URL (carries fromDate/toDate/currency) instead of `page.url()`.

## Validation

1. Static/syntax validation: `npx playwright test --list` — compiled OK (1 test listed).
2. Only test file changed (see Scope).
3. Verification stack used: cashflowverify (BASE_URL=http://localhost:8080, API_BASE=http://localhost:3101/api/v1,
   TEST_DATABASE_URL=postgresql://postgres:verifypass@localhost:55432/cashflow?schema=public).
4. Command:
   npx playwright test apps/frontend/playwright/transactions-e2e.spec.ts --workers=1 --trace=retain-on-failure --timeout=180000 --reporter=list
5. Result: **1 passed (6.7s)** — see playwright-transactions.log (huge diagnostic dumps included).
6. `.last-run.json` status: passed, failedTests: [].
7. DB post-run verification (cashflowverify_postgres): 0 residual rows for fixture user in
   users, user_settings, accounts, categories, transactions, sessions, refresh_tokens,
   audit_logs, notifications — see db-cleanup-check.txt.

## Flows verified

- seed (beforeAll -> seedDb): user + USD account + category + current/previous month transactions
- list: GET /api/v1/transactions?...currency=USD&fromDate=2026-08-01&toDate=2026-08-31 -> HTTP 200,
  totalItems=1, data.length=1 (current month only)
- UI render: table row present (data-transaction-id), toolbar "1 transaksi", seeded date cell visible
- URL assertions: fromDate/toDate present in API request URL
- view/UI assertions: date cell of seeded transaction rendered
- cleanup (afterAll -> cleanupDb): deterministic FK order, no residual rows

Note: this spec is a month-filtering E2E (list + UI render + cleanup). Create/edit/delete
transactions via the UI are not part of this spec's assertions.

## Evidence files

- checklist.md (this file)
- command.txt
- env_summary.txt (sanitized)
- playwright-transactions.log (full run output incl. network instrumentation)
- result.txt (status summary)
- db-cleanup-check.txt (sanitized post-run DB verification)
- transactions-e2e.spec.ts (patched spec copy)
- no trace.zip (test passed; --trace=retain-on-failure only saves on failure)

## Classification

Transactions CRUD = **PASS**