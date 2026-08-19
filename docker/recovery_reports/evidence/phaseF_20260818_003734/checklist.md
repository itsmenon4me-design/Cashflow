# Phase F — Frontend / Verify Stack / Phase 13 Regression Gate — CHECKLIST

Date: 2026-08-18
Evidence dir: docker/recovery_reports/evidence/phaseF_20260818_003734/
Baseline:
- Phase 13 = COMPLETE (preserved)
- Phase F = NOT COMPLETE
- Backend Phase F Gate = PASS (evidence: phaseF_20260818_003536/backend_revalidation_test-results.txt — 101/101 suites, 745/745 tests, exit 0)
- Original Phase F evidence immutable: phaseF_20260818_002155/backend_test-results.txt (SHA256 96C7B492BC1220FAD263C3651546820F52EA6111BE571E28DCE40BF77B5CA58C)

## STEP 1 — Frontend build sanity
- Command: npm run build (apps/frontend)
- Exit code: 0
- Result: PASS — TypeScript compiled, 31 routes generated (/, login, reports, analytics, transactions, ...)
- Artifact: frontend_build.log

## STEP 2 — Verify frontend image rebuild
- Command: docker compose -f docker/docker-compose.yml -f docker/docker-compose.verify.yml --env-file docker/.env.verify build --no-cache frontend
- Exit code: 0
- Result: PASS — Image cashflowverify-frontend Built (2.09GB)
- New image: cashflowverify-frontend:latest (ID 6fc833afc181, created 2 minutes before ps check)
- Artifact: build_frontend.log, docker_images.txt

## STEP 3 — Recreate frontend + nginx
- Command: docker compose ... up -d --no-deps --force-recreate frontend nginx
- Exit code: 0
- Result: PASS — cashflowverify_frontend Up 36 seconds (healthy); cashflowverify_nginx Up 25 seconds (healthy)
- Artifacts: compose_ps_before.txt, compose_ps_after.txt, up_frontend_nginx.log

## STEP 4 — Healthcheck gate
- http://localhost:8080 -> 200
- http://localhost:8080/api/v1/health -> 200
- http://localhost:3101/api/v1/health -> 200
- Result: PASS
- Artifact: healthchecks.txt

## STEP 5 — Canonical Phase 13 regression
- Spec: playwright/multi-currency-acceptance.final.spec.ts (1 worker, trace retain-on-failure, timeout 180000)
- Result: 2 passed, 0 failed (43.4s) — exit 0
- Observed assertions:
  - Transactions: IDR api_total=4 ui_matches_api=true; USD 4/4 true; SGD 3/3 true; EUR 5/5 true
  - Analytics: IDR api_income=Rp 300.000 ui_income_matched=true; USD $7,500.00 true; SGD $500.00 true; EUR 5.000,00 € true
  - Reports: all 4 currencies ok=true, error_state=false, ui_reports_monthly_calls=2, ui_matched=true
  - Stale 599 protection: no 599 encountered
- Artifact: playwright/playwright_run.log
- Note: no trace artifacts (trace=retain-on-failure; no failures occurred)

## STEP 6 — Evidence collection
- Artifacts preserved as listed above; original evidence dirs untouched.

## STEP 7 — Decision
PHASE F — INTERMEDIATE GATE = PASS
PHASE F = NOT COMPLETE
Next approved step: remaining Phase F feature Playwright/integration verification (not executed in this run).

## Hard stop honored
No Phase F feature specs, no income/expense/transactions-e2e, no currency variant specs, no reports-analytics spec, no phase9 spec, no further backend tests, no code changes, no fixes.