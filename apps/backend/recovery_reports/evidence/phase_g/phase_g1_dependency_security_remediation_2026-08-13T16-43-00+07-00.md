# Phase G.1 — Dependency Security Remediation

## Status
PARTIAL / BLOCKED

## Summary
The remaining dependency blocker is the transitive `js-yaml` vulnerability inherited through `@nestjs/swagger`.

The package chain is not safely resolvable through a minimal patch without creating a second high-severity issue. The current evidence shows:

- `@nestjs/swagger@11.4.6` -> `js-yaml@5.2.1` is affected by GHSA-pm4m-ph32-ghv5.
- `@nestjs/swagger@11.4.5` -> `js-yaml@4.3.0` is affected by GHSA-5p4m-2wfm-xmqj.

This means the dependency family itself is in an unresolved vulnerable state. No safe supported version within the current package line was found without broader ecosystem changes or a major package upgrade outside the requested minimal-remediation scope.

## Vulnerability identified
- Package: `@nestjs/swagger`
- Dependency chain: `@nestjs/swagger -> js-yaml`
- Advisory: GHSA-pm4m-ph32-ghv5
- Vulnerable range: `>=5.0.0 <=5.2.1`
- Installed chain before remediation: `@nestjs/swagger@11.4.6` -> `js-yaml@5.2.1`

## Secondary package conflict observed after attempted patch
- Attempted downgrade: `@nestjs/swagger@11.4.5`
- Resulting chain: `@nestjs/swagger@11.4.5` -> `js-yaml@4.3.0`
- Advisory: GHSA-5p4m-2wfm-xmqj
- Vulnerable range: `>=4.0.0 <4.3.1`

## Remediation performed
1. Reviewed the root and backend package manifests.
2. Inspected the working npm lock state and `npm audit --audit-level=high --json` output.
3. Attempted the minimal non-breaking hotfix by pinning `@nestjs/swagger` to `11.4.5`.
4. Verified that this shifted the vulnerability from the `5.x` line to the `4.x` line instead of resolving it.
5. Did not force a broad or unsafe upgrade.
6. Recorded the blocker explicitly as a dependency family issue rather than an application bug.

## NPM audit result
Command: `npm audit --audit-level=high --json`

Status: FAIL / BLOCKED

Current high-severity findings:
- `@nestjs/swagger` via `js-yaml`
- `js-yaml` advisory for `4.x` line when using `11.4.5`

Conclusion: The dependency family contains no safe version pair that satisfies the current application tree without a broader, higher-risk ecosystem change.

## npm ls result
Command: `npm ls @nestjs/swagger js-yaml --all`

Observed results:
- `@nestjs/swagger@11.4.6 -> js-yaml@5.2.1`
- `@nestjs/swagger@11.4.5 -> js-yaml@4.3.0`

Conclusion: Both adjacent package lines remain high-risk. There is no safe supported resolution inside the current `@nestjs/swagger` family for this application.

## TypeScript validation
Command: `cd D:\Project 2\CashFlow\apps\backend && npx tsc --noEmit`

Status: PASS

## Relevant test validation
Command: `cd D:\Project 2\CashFlow\apps\backend && npm test -- --runInBand src/modules/auth src/modules/transactions src/modules/audit src/modules/audit-logs`

Status: PASS

Result:
- Passed: relevant security / transaction / audit suites
- Failed: 0
- Environment-blocked tests: none

## Production and historical recovery safety
- Production mutation count: 0
- Production recovery: NOT_EXECUTED
- Human approval: NOT_APPROVED
- `mutation_authorized`: false
- Historical recovery: FINAL_HOLD / EXTERNAL_INFRA_DEPENDENCY
- E.6.2: NOT_PERMITTED
- Historical evidence preserved: yes

## Final determination
This phase is not eligible for PASS because the dependency vulnerability remains unresolved and no safe supported remediation exists within the currently constrained dependency family.

Status: PARTIAL / BLOCKED

## Recommendation
- Keep the current dependency set as-is while recording the upstream blocker.
- Revisit the issue in a dedicated dependency upgrade cycle once either:
  - `@nestjs/swagger` publishes a truly fixed `js-yaml` line that is not itself vulnerable, or
  - the application can safely migrate off the vulnerable library family without a breaking change.
