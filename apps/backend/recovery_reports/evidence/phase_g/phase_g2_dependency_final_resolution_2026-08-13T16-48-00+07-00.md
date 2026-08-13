# Phase G.2 — Final Dependency Vulnerability Resolution

## Status
BLOCKED

## Summary
The current dependency tree still contains a high-severity `js-yaml` advisory through `@nestjs/swagger` and there is no safe supported stable resolution within the current `@nestjs/swagger` release line.

The project was re-checked against the current npm registry, installed dependency tree, `npm audit`, and package metadata. The result is consistent: the latest stable `@nestjs/swagger` release remains `11.4.6` and still declares `js-yaml@5.2.1` as a dependency.

## Installed and latest versions
- Installed `@nestjs/swagger`: `11.4.6`
- Latest stable `@nestjs/swagger`: `11.4.6`
- Installed `js-yaml`: `5.2.1`
- Latest stable `js-yaml`: `5.2.3`

## Dependency tree
- `@nestjs/swagger@11.4.6 -> js-yaml@5.2.1`
- This is visible from `npm explain js-yaml` in the backend workspace.
- The affected package path is `node_modules/js-yaml` under `@nestjs/swagger`.

## Advisory evidence
### Current affected advisory
- GHSA: `GHSA-pm4m-ph32-ghv5`
- Severity: `HIGH`
- Affected versions: `>=5.0.0 <=5.2.1`
- Patched versions: `>=5.2.2` (current latest stable is `5.2.3`)
- Dependency path: `@nestjs/swagger@11.4.6 -> js-yaml@5.2.1`
- Installed version is affected: `yes`
- Direct or transitive: `transitive`

### Attempted alternate-range advisory
- GHSA: `GHSA-5p4m-2wfm-xmqj`
- Severity: `HIGH`
- Affected versions: `>=4.0.0 <4.3.1`
- Patched versions: `>=4.3.1`
- Dependency path: `@nestjs/swagger@11.4.5 -> js-yaml@4.3.0` (attempted workaround)
- Installed version is affected: `yes`
- Direct or transitive: `transitive` from the attempted downgrade path

## Remediation attempted
1. Re-verified the current dependency tree and registry metadata.
2. Confirmed `@nestjs/swagger@latest` is still `11.4.6`.
3. Confirmed `js-yaml@latest` is `5.2.3` but not yet adopted by `@nestjs/swagger`.
4. Attempted a minimal safe override/downgrade path to clear the issue.
5. Verified that the attempted `11.4.5` workaround merely shifted the issue into a different `4.x` advisory.
6. No safe supported stable upgrade remains in the current package family.

## npm audit result
Command: `npm audit --audit-level=high --json`

Status: `FAIL`

Remaining high issue count: `2`

Affected packages:
- `@nestjs/swagger`
- `js-yaml`

## TypeScript validation
Command: `cd D:\Project 2\CashFlow\apps\backend && npx tsc --noEmit --pretty false`

Status: `PASS`

Exit code: `0`

## Test validation
Command: `cd D:\Project 2\CashFlow\apps\backend && npx jest --runInBand src/modules/auth src/modules/transactions src/modules/audit src/modules/audit-logs --json --outputFile=./.tmp-jest-results.json`

Status: `PASS`

Result:
- Passed tests: `130`
- Failed tests: `0`
- Passed suites: `20`
- Failed suites: `0`

## Production reachability assessment
The vulnerable library is a transitive dependency of `@nestjs/swagger` used in API documentation tooling. It is not the same as an application-owned YAML parser handling untrusted request bodies. In that sense, the exploitability is narrower than a direct app input vulnerability.

However, the advisory remains unresolved in the current stable dependency chain. That means the library risk is real, but it is an upstream package-level issue rather than a patchable code bug in this repository.

## Final classification
UNRESOLVED_UPSTREAM

## Safety status
- Production mutation count: `0`
- Production recovery: `NOT_EXECUTED`
- Human approval: `NOT_APPROVED`
- `mutation_authorized`: `false`
- E.6.2: `NOT_PERMITTED`
- Historical recovery: `FINAL_HOLD / EXTERNAL_INFRA_DEPENDENCY`

## Conclusion
This is not a repeat of the earlier dependency investigation. The current registry and lockfile were re-validated, and the result is the same: the current stable `@nestjs/swagger` package line still includes a vulnerable `js-yaml` version; a temporary downgrade path simply moves the issue to a different `4.x` advisory. The dependency is therefore an upstream blocker, not a code defect in this repository.
