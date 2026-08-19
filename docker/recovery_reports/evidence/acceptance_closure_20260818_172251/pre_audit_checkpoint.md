# Pre-Audit Checkpoint — 2026-08-18 (evidence-first, read-only investigation)

## 1. Backend failure classification

- Suite: `src/modules/audit/historical-recovery-writeback.integration.spec.ts` (tracked, pre-existing)
- Failing test: `skips or targets staging only; never a production URL` (line 250-260), assertion line 251:
  `expect(isStagingOnly || !DB_URL).toBe(true)` -> Expected true, Received false
- Command: `npx jest --silent modules/audit/historical-recovery-writeback.integration.spec.ts`
  with DATABASE_URL=postgresql://postgres:<pass>@localhost:55432/cashflow
- Exact error: `expect(received).toBe(expected) // Object.is equality / Expected: true / Received: false`
- Root cause: `isStagingOnly` (line 15-23) requires `localhost:5433` in DATABASE_URL. The verify stack
  maps 55432:5432 (docker-compose.dev.yml:45, docker-compose.verify.yml:20). Port 5433 is not
  provisioned anywhere in this repo. With verify URL set: guard=false AND DB_URL truthy -> tripwire fires.
  With no URL: `!DB_URL` true -> passes. All 10 functional tests are gated `if (!isStagingOnly) return;`
  (skip). The tripwire exists so destructive write-back tests can only run against a dedicated
  staging DB at :5433, never ad-hoc/production URLs.
- Reproducibility: RUN B (verify URL) -> FAIL identical, EXIT=1 (1 failed, 10 gated-pass).
  RUN C (no URL) -> PASS 11/11, EXIT=0. Evidence: writeback_classification_evidence.txt
- DB impact: none. beforeAll returns early when guard false; residue check `recovery+%` users = 0.
  Cleanup: nothing needed (nothing created).
- Production coverage: 4 unit suites (service, gateway, data-recovery, data-audit) 60/60 PASS.
- Production code touched by failure: none.

### Classification: E — EXPECTED / OUT-OF-SCOPE TEST FAILURE (safety tripwire)
Production behavior is not defective; the suite is designed to be dormant without a :5433 staging DB.
NOT a product defect, test defect, fixture issue, or environment misconfig. No test changes made;
suite status stays 100/101 until a real staging DB at :5433 exists.

## 2. OAuth #1 reconciliation

### Google (implemented, BLOCKED on external credentials)
- Route/controller: `GET /auth/google` (prepare redirect), `GET /auth/google/callback` (code+state) —
  controllers/google-oauth.controller.ts; 400 fail-safe on unconfigured provider
- Service: google-auth.service.ts — state/CSRF store, token exchange (oauth2.googleapis.com/token),
  userinfo fetch, verified-email enforcement, unique-username generation, user creation with random
  password, provider-account link, PENDING_VERIFICATION auto-activation, session issuance,
  token-in-query redirect, error fallback redirect
- Provider: google-oauth.provider.ts — getConfigurationStatus() (isConfigured from env), profile validation
- Account linking: auto-link on first OAuth login (oauthAccountService.linkProviderAccount).
  NOTE (documented gap): google-auth.service.ts:258 error copy says "link Google from settings", but
  no link endpoint/UI exists (settings page has no OAuth section). Copy-only inconsistency; no impact
  on primary flow.
- Tests PASS: google-auth.service.spec.ts, google-oauth.provider.spec.ts, oauth-account.service.spec.ts,
  apple-auth.service.spec.ts -> 4 suites / 20 tests (EXIT=0). Frontend: auth.service.test.ts + login
  page.test.tsx (redirect + error UI) PASS in earlier vitest run.
- Env required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL (none set in
  docker/.env.verify; .env.example does not document them — minor doc gap)
- Live fail-safe verified: GET /auth/google -> HTTP 400 Bad Request
- Interactive E2E: NOT possible without real Google OAuth client credentials (external).

### Apple (implemented, BLOCKED on external credentials)
- Route/controller: `GET /auth/apple`, `GET /auth/apple/callback` — controllers/apple-oauth.controller.ts
- Service: apple-auth.service.ts — state/CSRF, client-secret JWT (iss/aud/sub/exp, ES256 via
  APPLE_PRIVATE_KEY), token exchange at appleid.apple.com/auth/token, id_token verification
  (email_verified), same account creation/link/session flow
- Provider: apple-oauth.provider.ts + interface
- Env required: APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, APPLE_CALLBACK_URL
  (none set; not in .env.example)
- Tests PASS: apple-auth.service.spec.ts (in 20/20 above)
- Live fail-safe verified: GET /auth/apple -> HTTP 400 Bad Request
- Interactive E2E: NOT possible without Apple Developer credentials (external).

### Status: #1 = BLOCKED — EXTERNAL DEPENDENCY (unchanged, evidence-only)
Required: Google OAuth client (id/secret/callback) + Apple Developer team (team id, key id, private
key, callback). Everything code-side is implemented and unit-tested; runtime verification of the
happy path awaits real provider credentials.

## 3. Acceptance #1-#20 (final)

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | OAuth (Google/Apple) | BLOCKED — external dependency | oauth_reconciliation.txt, 20/20 unit, 400 fail-safes |
| 2 | Income flow | CLOSED | income-e2e PASS (6.3s) |
| 3 | Expense/currency refetch | CLOSED | expense-e2e PASS + multi-currency-final 2/2 PASS |
| 4 | Account name unique per currency | CLOSED | accounts.integration 5/5 PASS vs real DB (x2 runs) |
| 5 | Currency selector + QuickAdd placement | CLOSED | phase9 PASS (44.7s) |
| 6 | Notifications clear-all | CLOSED | search-and-notifications 2/2 PASS |
| 7 | Dashboard QuickAdd | CLOSED | phase9 PASS (nav asserts) |
| 9 | Search (incomes/expenses/topbar) | CLOSED | search-and-notifications PASS (q=424242) |
| 11 | Budget year window | CLOSED | vitest coverage (YEAR_OPTIONS_RANGE) |
| 13 | Topbar global search | CLOSED | #9 E2E |
| 16 | Reports data/hook | CLOSED | multi-currency-final (error_state=false, UI=API) |
| 17 | Analytics currency | CLOSED | multi-currency-final (formatting per currency) |
| 18 | Backend currency DTO validation | CLOSED | tsc EXIT=0 + backend suites |
| 19 | Backend transaction search | CLOSED | #9 E2E (searchByUser) |
| 20 | Backend integration hygiene | CLOSED | isolation 8/8 + accounts 5/5, full suite 100/101 (see #1.Classification) |

No re-runs done where runtime evidence already exists (source of truth = acceptance_closure_20260818_172251 + phaseF_20260818_*).

## 4. Pre-Audit Gate

- [x] #1 OAuth status documented (this report + oauth_reconciliation.txt)
- [x] #2-#20 CLOSED with runtime evidence
- [x] Backend 100/101 failure classified (E, evidence: writeback_classification_evidence.txt)
- [x] No unexplained production failure
- [x] No test failure hidden; no assertions weakened (tripwire untouched)
- [x] Verify DB hygiene PASS (2 users: admin + e2e.api.user; fixture 4/4/3/5; notifications 0)
- [x] Evidence not overwritten (new evidence files only; originals intact)
- [x] No credential/secret leak (only .env.example tracked; .env/.env.verify/.env.local gitignored)
- [x] No unapproved production code changes (this checkpoint: read-only investigation; test-only
      files: search-and-notifications-e2e.spec.ts (new), accounts.integration.spec.ts (user-B
      cleanup in finally), check-multi-currency.ps1 (UserId default) — all disclosed)

### VERDICT: PHASE 21 READY (awaiting explicit approval)
Phase 21/22/23 NOT started.
