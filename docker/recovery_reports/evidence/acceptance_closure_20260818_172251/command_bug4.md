# Evidence: Bug #4 integration spec run (non-vacuous)

## Command
Run from apps/backend (PowerShell 5.1), verifying against the verify-stack DB:

```powershell
$lines = Get-Content "D:\Project 2\CashFlow\docker\.env.verify"
$user  = (($lines | Where-Object { $_ -match '^POSTGRES_USER=' }) -replace '^POSTGRES_USER=\s*','' -replace '^"|"$','').Trim()
$pass  = (($lines | Where-Object { $_ -match '^POSTGRES_PASSWORD=' }) -replace '^POSTGRES_PASSWORD=\s*','' -replace '^"|"$','').Trim()
$db    = (($lines | Where-Object { $_ -match '^POSTGRES_DB=' }) -replace '^POSTGRES_DB=\s*','' -replace '^"|"$','').Trim()
$env:DATABASE_URL = "postgresql://$user`:$pass@localhost:55432/$db"
npx jest --silent modules/accounts/accounts.integration.spec.ts --verbose
```

- Credentials read from docker/.env.verify (never printed).
- NOTE: do NOT append `?schema=public` — pg parses it as part of the database name
  ("database =public does not exist").
- NOTE: use an absolute path for docker/.env.verify; relative path fails when
  workdir is apps/backend (this caused the earlier "client password must be a
  string" / empty-credential failures).

## Connectivity smoke check
`node -e` with node-postgres from root node_modules:
CONNECT OK {"current_user":"postgres","current_database":"cashflow"}

## Result
Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Snapshots:   0 total
Time:        ~4 s

Full output: integration_spec_result.txt
Checklist:   checklist_bug4.md
