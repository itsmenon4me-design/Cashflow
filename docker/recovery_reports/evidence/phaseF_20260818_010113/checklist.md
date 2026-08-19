# Phase F — Income E2E Targeted Remediation (attempt 2) — CHECKLIST

Date: 2026-08-18
Evidence dir: docker/recovery_reports/evidence/phaseF_20260818_010113/
Prior evidence (untouched): phaseF_20260818_002155, _003536, _003734, _005050, _005547

## Fix applied (attempt 2) — double waitForResponse race

File: apps/frontend/playwright/income-e2e.spec.ts (lines 266-272)
Change: removed the duplicate second waitForResponse; the single filtered GET is now captured
directly from the Promise.all([waitForResponse, press Enter]) into `txFilteredResp`.
Matches the established repo pattern already used in the same file for POST (139-144) and PATCH (248-252).

Scope: test-only. No production/backend/DB/auth/API changes. No assertions removed.
Search verification, Edit verification, Delete verification all preserved.

## Result — FAIL (new failure point)

Command: npx playwright test playwright/income-e2e.spec.ts --workers=1 --trace=retain-on-failure --timeout=180000 --reporter=list
Env: E2E_EMAIL=e2e.api.user@test.local / TestPass123! / FRONTEND_BASE=http://localhost:8080 / API_BASE=http://localhost:3101/api/v1

PASSED phases (evidence in playwright/income-e2e.log):
- beforeAll login 201
- category + account creation
- POST /transactions 201 (id a0877bd9-2ef0-455b-85f9-d5466a7f7227)
- reload + GET /transactions: created tx present (totalItems=5)
- View dialog + date assertion
- Edit dialog, PATCH 201, note "...UPDATED" confirmed
- **Search/filter verification: PASS** (previous line-272 timeout GONE — fix worked)
- Delete row located, 4 action buttons present, 4th button (index 3) clicked
- Delete confirm dialog ([role=dialog] Hapus/Delete) visible + clicked

FAILED phase:
- Line 326: `throw new Error('DELETE not observed and API fallback delete failed (status 404)')`
- waitForResponse(DELETE) at line 313 (5s) timed out -> fallback API DELETE (line 317)
- Fallback returned **404 "Transaction not found"** (18:01:29.637)

## Diagnosis of failure 2

The 404 proves the transaction was ALREADY DELETED before the fallback ran — i.e. the **UI delete succeeded**
(backend delete + row removal). Root cause: test synchronization race — `waitForResponse` for the DELETE
is registered at line 313, AFTER the confirm click at line 308. The UI DELETE request fires on the click;
the listener is attached afterwards, so the fast localhost response is missed -> 5s timeout -> fallback ->
404 (delete already done). Classification: **TEST SYNCHRONIZATION RACE — NOT a product defect**.
Product behavior verified correct by the 404 itself (transaction no longer exists).

## Residue note

Leftover data from earlier aborted runs (not failure cause): tx 89db552e-c636-4ee1-bfbd-dce3ae0c88b5
(from 005547 run, delete phase never reached), plus per-run unique category/account rows.

## Decision

STOPPED per failure rule. No further fixes applied. Awaiting approval for fix 3:
register the DELETE waitForResponse BEFORE the confirm click (Promise.all pattern, same as PATCH block).