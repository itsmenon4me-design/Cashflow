# search-and-notifications-e2e.spec.ts — Bugs #9 + #6 runtime verification (2026-08-18)

## Command
npx playwright test apps/frontend/playwright/search-and-notifications-e2e.spec.ts --workers=1 --trace=retain-on-failure --timeout=180000 --reporter=list

Environment: BASE_URL=http://localhost:8080, API_BASE=http://localhost:3101/api/v1,
E2E_EMAIL=e2e.api.user@test.local, E2E_PASSWORD=TestPass123!

Fixture: e2e.api.user@test.local (id 3634cf2a-8973-491b-9518-bf44af639b4a, ACTIVE,
argon2id hash of TestPass123!) with deterministic 16 transactions (IDR=4, USD=4,
SGD=3, EUR=5). Live verify stack: frontend nginx :8080, backend API :3101,
postgres cashflowverify_postgres db=cashflow.

## Result
2 passed (9.3s) — full log: search-notifications-e2e.log

## Bug #9 (header/global search dead) — verified
- Header search (aria-label "Pencarian global") + Enter navigates to
  /transactions?q=424242 (asserted URL)
- /api/v1/transactions request carries q=424242 and returns exactly 1 row
  (api_total=1, amount_cents=424242) — amount search matches
- UI renders exactly 1 transaction row ([data-transaction-id]:visible count=1)
- Flow: seed current-month transaction via API -> type amount in header search ->
  Enter -> router.push('/transactions?q=...') -> q effect refetches filtered list

## Bug #6 (notifications clear-all) — verified
- Seeding 2 transactions via API produced 2 TRANSACTION notifications
  (before clear-all: 2)
- "Hapus Semua" button on /notifications calls DELETE /notifications (200)
- UI switches to empty state ("Belum ada notifikasi.")
- API GET /notifications returns totalItems=0 after clear-all
- Seeded transactions cleaned up in afterAll; fixture left intact

## Environment hygiene performed alongside (same session)
- Deleted stale users from verify DB (children-first, in-transaction):
  e2e.user@test.local (id 00000000-0000-0000-0000-000000000001, accidental
  duplicate with 16 seed + 2 soft-deleted E2E tx) and leaked integration user
  acc-int-b-1787050004368@example.com
- 2 categories referenced by kept fixture transactions were reassigned to the
  fixture user (cross-references from an earlier seed re-pipe)
- accounts.integration.spec.ts user-B cleanup moved into finally so it runs on
  assertion failure too; re-ran spec 5/5 PASS (accounts_integration_rerun_after_cleanup.txt)
- verify DB now contains exactly 2 users: admin@cashflow.local + e2e.api.user@test.local
- Fixture re-verified after cleanup: IDR=4, USD=4, SGD=3, EUR=5, notifications=0
- NOTE: entrypoint `npx prisma db seed` is a no-op (no prisma.seed config in
  package.json), so deleted users will not be re-created by a rebuild
