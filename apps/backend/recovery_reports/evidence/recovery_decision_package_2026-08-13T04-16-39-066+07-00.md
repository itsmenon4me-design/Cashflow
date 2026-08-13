Recovery decision package — Phase E.5.4 (READ_ONLY)

Generated: 2026-08-13T04:16:39.066+07:00
Database mutations performed: 0

Executive summary

This package consolidates evidence from Phase E.4–E.5.3 for the primary candidate 97b76766-d13a-4db6-8baf-572292b83913 (account e673f9a8-2e2a-4e58-af4f-1728be9bdfa1).

Primary facts
- Currency: IDR
- Transaction type: INCOME
- Stored amount_cents: 100000000
- Proposed amount_cents: 1000000 (stored/100)
- Account opening_balance_cents: 1000000
- Current classification: LIKELY_CORRUPTED
- Current evidence confidence: HIGH
- Request payload evidence: NOT FOUND locally

Final evidence timeline (chronological)
1. Classifier/dry-run (review_full.json, generated 2026-08-12T20:05:52.501Z)
   - Classifier flagged transaction as LIKELY_CORRUPTED (MEDIUM) because account.opening_balance_cents == stored/100.
2. Authoritative DB read (db_context_2026-08-12T21:00:50.843Z)
   - Retrieved account row and primary transaction. Confirmed opening_balance_cents = 1000000 and primary transaction amount_cents = 100000000.
3. DB-verified evidence (evidence_verification_2026-08-13T03:59:12..._db_verified.json)
   - Consolidated DB evidence and raised confidence to HIGH while still noting missing request payload.
4. Request-log investigation (evidence_verification_2026-08-13T04:04:15..._request_logs.json)
   - Searched repository and container logs for 2026-08-11T14:08:31Z and identifiers; request bodies not found in local logs. Logger middleware logs method+URL but not bodies; create endpoint not annotated for audit.

Final evidence matrix (summary)
- classifier (review_full.json)
  - Evidence: account opening balance equals stored/100
  - Supports corruption: Yes
  - Confidence contribution: Medium
  - Limitations: heuristics require authoritative DB read

- authoritative DB (db_context_...json)
  - Evidence: account.opening_balance_cents='1000000'; current_balance_cents='1000000'; transaction.amount_cents='100000000'
  - Supports corruption: Yes
  - Confidence contribution: High
  - Limitations: no same-account /100 peer within ±2 minutes; sample limited

- db-verified report
  - Evidence: reiterates DB facts and temporal cluster
  - Supports corruption: Yes
  - Confidence contribution: High
  - Limitations: missing client request payload

- request-log search
  - Evidence: None found locally
  - Supports corruption: No (no direct payload evidence)
  - Confidence contribution: None
  - Limitations: request bodies may be in centralized logs (not accessible here)

Neighboring transaction & cluster analysis
- Temporal cluster (~14:04:03Z to 14:11:03Z) contains large IDR entries across accounts (8ce442b3..., 97b76766..., d0c31e40...). This suggests a correlated event but is not direct proof of client-side scaling bug for the primary account.
- The primary account shows small historical transactions (10000, 25000) and the single large candidate entry; no repeated ×100 pattern in the sampled account history.

Request/logging observability
- LoggerMiddleware records method, URL, IP, user agent, correlation id; it does NOT log request bodies.
- AuditInterceptor records audit entries only for routes annotated with @Audit; TransactionsController.create is not annotated, so create events are not audited automatically.
- Conclusion: request-body observability gap exists. Centralized logs may retain payloads; check infra logging archives.

Final candidate decision (primary candidate)
- classification: LIKELY_CORRUPTED
- confidence: HIGH
- stored value: 100000000
- proposed value: 1000000
- correction ratio: 0.01
- strongest supporting evidence: Authoritative DB: account.opening_balance_cents == stored/100 (1000000)
- strongest contradictory/missing evidence: Missing direct client request payload showing the smaller value; no same-account /100 peer within ±2 minutes
- human approval required: YES — decision = NEEDS_MORE_EVIDENCE (per current project policy; do not auto-upgrade to CONFIRMED_CORRUPTED)

Analysis of the 37 SUSPICIOUS candidates
- Total suspicious: 37 (see review_full.json list and idr_clusters)
- Grouping (by account / cluster) included in JSON package (section suspicious_summary). Example groupings:
  - account 7b2b8bae-...: five rapid records around 2026-08-06T06:05:46
  - account 8fd53ecd-...: multiple records including 8ce442b3 (2026-08-11T14:04:03) and d0c31e40 (2026-08-11T14:11:03)
  - primary account e673f9a8-...: includes small transactions and the candidate
- Default decision for all suspicious: NEEDS_MORE_EVIDENCE

Approval decision table (summary)
- Primary candidate 97b76766-...: NEEDS_MORE_EVIDENCE (do not approve correction yet)
- All 37 suspicious candidates: NEEDS_MORE_EVIDENCE (0 approved for correction in this package)

Minimum evidence required to move LIKELY_CORRUPTED → eligible for correction
(Any one of these must be present):
- Direct request payload showing client-submitted amount (e.g., amount_cents=1000000) for the create at 2026-08-11T14:08:31.606Z
- Authoritative import/source record (payment gateway, bank import) showing the smaller amount
- Reproducible frontend bug proof (build id, code snippet, logs) correlating submitted values to affected timestamps and accounts
- Explicit human confirmation after reviewing external records

Correction approval specification (document only, non-executable)
- candidate_id: 97b76766-d13a-4db6-8baf-572292b83913
- original_value: "100000000"
- proposed_value: "1000000"
- reason: "Suspected frontend ×100 scaling bug — account opening_balance matches stored/100"
- evidence_references: paths to review_full.json, db_context JSON, db-verified JSON, request-log JSON
- reviewer: <name/email — to be filled by human reviewer>
- approval_timestamp: <ISO timestamp>
- approval_decision: APPROVE_CORRECTION | REJECT_CORRECTION | NEEDS_MORE_EVIDENCE
- rollback_requirement: "Define exact steps to restore original amount and validate balances; include snapshot of affected rows before mutation"
- idempotency_requirement: "Specify operation that is safe to re-run without double-correction (use guarded checks comparing current DB with original recorded value)"
- audit_requirement: "Record pre/post DB state, operator identity, approval manifest reference, and evidence files in audit log"

Phase E.6 minimum entry requirements
- Human approval exists and is recorded in approval_manifest
- Candidates listed explicitly in approval manifest with original/proposed values
- Evidence references are recorded and accessible
- Rollback strategy defined and tested in staging
- Idempotency strategy defined
- Audit trail exists and will record corrections
- Pre-mutation verification passes (read-only checks run and compared to saved evidence)

Safety statement
- This package was produced in READ_ONLY mode. No DB mutations were performed. Phase E.6 was NOT executed and must not be started until explicit human approval and the Phase E.6 entry requirements are satisfied.

Artifacts produced
- JSON: apps/backend/recovery_reports/evidence/recovery_decision_package_2026-08-13T04-16-39-066+07-00.json
- MD  : apps/backend/recovery_reports/evidence/recovery_decision_package_2026-08-13T04-16-39-066+07-00.md

Tests
- Ran: npm --prefix "D:\\Project 2\\CashFlow\\apps\\backend" test -- src/tools/recovery/classifier.spec.ts --runInBand
- Result: PASS (1 suite, 5 tests)

Final concise outputs
- Phase E.5.4 status: Completed (READ_ONLY) — recovery decision package produced
- Primary candidate classification: LIKELY_CORRUPTED
- Primary candidate confidence: HIGH
- Primary candidate decision: NEEDS_MORE_EVIDENCE (human approval required)
- Number of suspicious candidates: 37
- Number approved for correction: 0
- Number requiring more evidence: 37
- Database mutation count: 0
- Tests: PASS
- Exact JSON path: D:\Project 2\CashFlow\apps\backend\recovery_reports\evidence\recovery_decision_package_2026-08-13T04-16-39-066+07-00.json
- Exact MD path: D:\Project 2\CashFlow\apps\backend\recovery_reports\evidence\recovery_decision_package_2026-08-13T04-16-39-066+07-00.md
- Confirmation: Phase E.6 was NOT executed

If you want, I can now:
- Draft an infra/logging request email with exact commands and identifiers for extracting archived request payloads for 2026-08-11T14:08:31.606Z (recommended), or
- Prepare a human-friendly approval manifest template pre-filled with the primary candidate details for sign-off.

Which would you like next? (Both are read-only preparatory tasks.)