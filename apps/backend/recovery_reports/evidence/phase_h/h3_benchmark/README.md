H.3 Minimal Local Benchmark Harness

This folder contains a minimal, dependency-free benchmark harness for local/staging validation.

Files:
- benchmark.js  -- Node script (uses global fetch, Node 18+)
- run_benchmark.ps1 -- small helper to run the benchmark with recommended env settings

Prerequisites
- Node 18+ (global fetch used)
- Local or staging backend running and reachable (do NOT point to production)
- If authentication is required, provide either:
  - BENCH_USER and BENCH_PASS environment variables (the script will POST to /auth/login), or
  - AUTH_TOKEN environment variable with a bearer token
- If testing transaction creation, an account id can be passed via BENCH_ACCOUNT_ID

Default target URL
- The script defaults to http://localhost:3001/api/v1 but respects TARGET_URL or BASE_URL environment variables.

Recommended safe staging load
- totalRequests: 200
- concurrency: 5
- pacingMs: 10

How to run (PowerShell)
- Example (no-auth endpoints):
  $env:TARGET_URL = 'http://localhost:3001/api/v1'
  $env:BENCH_TOTAL = '200'
  $env:BENCH_CONC = '5'
  pwsh ./run_benchmark.ps1

- Example (login-based):
  $env:TARGET_URL = 'http://localhost:3001/api/v1'
  $env:BENCH_USER = 'test-user'
  $env:BENCH_PASS = 'test-password'
  pwsh ./run_benchmark.ps1

Outputs
- JSON report: benchmark_result_<timestamp>.json
- Markdown summary: benchmark_result_<timestamp>.md
Both are placed in this directory. JSON is machine-readable for further aggregation.

Caveats / Safety
- The harness uses synthetic test data; it will attempt POST /transactions to create small synthetic transactions if transaction endpoints accept POSTs. Always run against staging/test only.
- The script is intentionally minimal and designed for reproducible local use. For larger/stress benchmarks use dedicated tools (autocannon, k6, artillery) outside this repository.

Contact
- This harness was added as part of Phase H.3 performance & PWA validation work.
