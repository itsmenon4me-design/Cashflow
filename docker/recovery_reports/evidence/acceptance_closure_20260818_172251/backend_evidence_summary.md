# Backend test evidence — session 2026-08-18

Target: verify stack DB (postgres localhost:55432, db=cashflow, creds from
docker/.env.verify, never printed). DATABASE_URL built WITHOUT ?schema=public
(pg parses it as part of the db name).

## Results

### Full backend suite, DATABASE_URL unset (standard regression mode)
- Test Suites: 101 passed, 101 total
- Tests: 745 passed, 745 total
- EXIT=0 (backend_full_suite_no_db_result.txt)

### Full backend suite, DATABASE_URL -> verify DB
- Test Suites: 1 failed, 100 passed, 101 total
- Tests: 1 failed, 744 passed, 745 total
- EXIT=1 (backend_full_suite_with_db_result.txt)
- Sole failure: src/modules/audit/historical-recovery-writeback.integration.spec.ts
  - PRE-EXISTING, tracked file (not created this session), out of bugs #1-15 scope.
  - By design (safety tripwire): refuses to run unless DATABASE_URL contains
    `localhost:5433` (see `isStagingOnly` guard, lines 15-23). No compose file in
    this repo maps 5433 (verify uses 55432, dev 55432, main 5432). The spec was
    NOT modified; it correctly skipped in the no-DB run.

### Targeted integration specs vs verify DB (non-vacuous, real rows)
- accounts.integration.spec.ts: 5/5 PASS (integration_spec_result.txt)
  -> bug #4 evidence (see checklist_bug4.md, command_bug4.md)
- isolation.integration.spec.ts: 8/8 PASS (isolation_spec_result.txt)
  -> currency-scope evidence for #10/#12/#13/#14
- transactions.integration.spec.ts and transfers.service.integration.spec.ts:
  passed inside the with-DB full run (744 includes them; no "Skipping" output)

## Corrections made during verification (test-only, no product code changed)

1. accounts.integration.spec.ts (untracked scaffolding, created this session):
   - First real-DB run failed 2/5; both were test bugs:
     a) asserted same-name-different-currency is allowed, contradicting the
        product rule (partial unique index (user_id, name) WHERE deleted_at IS
        NULL, migration 20260817000000). Now asserts rejection (stronger).
     b) cross-user test passed user A's userId into user B's service calls, so
        the FORBIDDEN path never ran. Now passes uB.id (stronger).
2. isolation.integration.spec.ts (untracked scaffolding, created this session):
   - Test-order bug: the update/delete test soft-deleted shared fixture idrTx,
     breaking subsequent search/monthly/analytics/dashboard assertions (never
     noticed because the suite skipped without DATABASE_URL). Delete test now
     creates its own victim transaction (assertions unchanged/stronger).

## Known non-blocking warning (pre-existing)
TransactionsService logs "Failed to create transaction notification ... error=
this.repo.getAccountCurrency is not a function" in unit tests (mocked repos lack
the method). Graceful failure; all tests green; not part of bugs #1-15.
