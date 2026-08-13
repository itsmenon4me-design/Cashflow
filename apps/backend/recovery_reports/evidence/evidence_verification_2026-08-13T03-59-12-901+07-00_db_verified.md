Executive summary

Phase: E.5.2 — Evidence verification (READ_ONLY) — DB-verified revision
Generated: 2026-08-13T03:59:12.901+07:00
Database mutations performed: 0

Primary candidate: 97b76766-d13a-4db6-8baf-572292b83913
Account: e673f9a8-2e2a-4e58-af4f-1728be9bdfa1 (QA-Balance-577332470)
Original classification: LIKELY_CORRUPTED (MEDIUM)
Evidence-verification result (this revision): LIKELY_CORRUPTED (HIGH)

1) Authoritative DB evidence retrieved

- Account row (authoritative):
  - id: e673f9a8-2e2a-4e58-af4f-1728be9bdfa1
  - name: QA-Balance-577332470
  - currency: IDR
  - opening_balance_cents: 1000000
  - current_balance_cents: 1000000
  - created_at: 2026-08-08T12:08:58.102Z
  - updated_at: 2026-08-11T14:09:53.706Z

- Transaction row (authoritative):
  - id: 97b76766-d13a-4db6-8baf-572292b83913
  - transaction_type: INCOME
  - amount_cents: 100000000
  - category_id: 2de70a2d-dd56-46b6-9b35-8564b2044a83
  - note: null
  - created_at: 2026-08-11T14:08:31.606Z
  - updated_at: 2026-08-11T14:08:58.263Z

2) Analysis: scale consistency

- stored_value = 100000000
- stored_value/100 = 1000000
- account.opening_balance_cents = 1000000 (authoritative DB) — matches stored/100 exactly.
- account.current_balance_cents = 1000000 (no visible balance change in this sample — further bookkeeping analysis required)
- Neighboring transactions within ±30 minutes: only the primary transaction was found for this account in that window.
- No same-account peer with amount_cents == 1000000 within ±2 minutes was found.
- The account's historical transactions sample contains only small transactions (10000, 25000) and the large candidate entry, no clear repeated ×100 pattern.

3) Request/log evidence

- Repository-local search did not find request-body logs for 2026-08-11T14:08:31Z.
- Server request logs may exist outside the repository; collecting them is recommended to reach CONFIRMED_CORRUPTED.

4) Evidence classification decision

- Conservative decision: LIKELY_CORRUPTED, upgraded to HIGH confidence given authoritative confirmation that opening_balance_cents == stored/100.
- Not upgraded to CONFIRMED_CORRUPTED because direct request-payload evidence is still unavailable and no same-account peer with the smaller amount was observed within ±2 minutes.

5) Missing evidence and next actions

- Missing: server request-body logs (POST /transactions) for 2026-08-11T14:08:31Z.
- Missing: same-account peer transaction amount == 1000000 within ±2 minutes.
- Recommended: retrieve server request logs and compare client-submitted amounts to DB-stored amounts. After human review, if client payload shows smaller amount and DB stored the larger amount, consider CONFIRMED_CORRUPTED.

6) Safety statement

- NO DATABASE MUTATION PERFORMED. This script used only SELECT read operations.
- Do not apply any correction or migration until human sign-off.

Files generated

- JSON evidence (db-verified): apps/backend/recovery_reports/evidence/evidence_verification_2026-08-13T03-59-12-901+07-00_db_verified.json
- Human-readable MD: apps/backend/recovery_reports/evidence/evidence_verification_2026-08-13T03-59-12-901+07-00_db_verified.md
- Authoritative DB context JSON: apps/backend/recovery_reports/evidence/db_context_2026-08-12T21-00-50-843Z.json (created by the temporary script)

