# H.4.3 Benchmark Runtime

Timestamp: 2026-08-13T17:38:00Z
Environment: LOCAL_VALIDATION_ONLY

The existing benchmark harness is at:
- apps/backend/recovery_reports/evidence/phase_h/h3_benchmark/benchmark.js

Recommended staging run (PowerShell):
$env:TARGET_URL = "http://localhost:3001/api/v1"
$env:BENCH_TOTAL = "500"
$env:BENCH_CONC = "10"
$env:BENCH_PACING = "10"
pwsh ./run_benchmark.ps1

Result: BLOCKED — staging backend not reachable in this environment. The harness was executed earlier against a non-listening localhost target; those results are NOT valid performance evidence and must not be used for decisions.

When staging is available, collect JSON+MD outputs from the harness and attach them to this folder.
