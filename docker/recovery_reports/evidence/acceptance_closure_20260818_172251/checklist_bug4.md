# Acceptance Evidence — Bug #4 (soft-delete account name uniqueness)

Date: 2026-08-18
Target: verify stack database (postgres localhost:55432, db=cashflow)

## What was verified (integration spec: accounts.integration.spec.ts)

1. Account list filtered by currency (IDR/USD/SGD/EUR isolation intact) — PASS
2. Cross-currency detail/update/delete are rejected/not found — PASS
3. Active duplicate account name is rejected — PASS
   - same name + same currency -> CONFLICT (service pre-check + partial unique index)
   - same name + another currency -> also CONFLICT (partial unique index on
     (user_id, name) WHERE deleted_at IS NULL; per-user name slot across currencies)
4. Soft-deleted account name can be reused (partial unique index) — PASS
   - create -> soft-delete -> recreate same name OK
   - two ACTIVE accounts with same name remain impossible
5. Cross-user access is rejected; account names are per-user — PASS
   - user B getById/update/softDelete on user A's account -> FORBIDDEN (ownership
     check in AccountsService.getById, service line 109-110)
   - user B may reuse user A's account name (names scoped per user)

## Evidence of non-vacuous execution

- Run command (see command.txt): jest against real DATABASE_URL of verify DB
- Fresh rows created and cleaned in verify DB: temp users acc-int-*/acc-int-b-*
  (service logs Account Created/Deleted with real UUIDs)
- Result: Test Suites: 1 passed / Tests: 5 passed, 5 total (see integration_spec_result.txt)

## Notes / corrections made during verification

- The spec was previously PASSING VACUOUSLY: guards `if (!hasDatabase || !svc) return;`
  early-returned when DATABASE_URL was unset. This run sets DATABASE_URL and
  executes against the real verify DB.
- First real run exposed 2 test bugs in the (then untracked) spec:
  a) expected same-name-different-currency to be allowed, contradicting the
     product rule (partial unique index on (user_id, name) among active rows,
     migration 20260817000000_soft_delete_account_name_uniqueness). Fixed to
     assert rejection (stronger assertion).
  b) cross-user test passed user A's userId into user B's service calls, so the
     FORBIDDEN path was never exercised. Fixed to pass uB.id (stronger assertion).
- No production code was changed for these two corrections.
