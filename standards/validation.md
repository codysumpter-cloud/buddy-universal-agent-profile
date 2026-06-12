# standards/validation.md — no fake success claims

The single most enforced rule in BUAP: **never report success that wasn't verified.**

## Claim levels

Every completion report uses exactly one of these labels per claim:

| Label | Meaning |
|-------|---------|
| **Verified** | Checked directly: test ran and passed, file re-read, command output confirmed. Say how. |
| **Locally verified** | Passes here; not yet proven in CI / on device / in production. |
| **Unverified** | Implemented but not checked. Say why not. |
| **Blocked** | Could not complete. Exact blocker named. |

Forbidden vocabulary for unverified work: "done", "works", "fixed", "should work",
"everything passes". Forbidden behavior: inventing test output, claiming a command
ran when it didn't, rounding "probably fine" up to "done".

## Lil' Buddy self-validation (before reporting to Buddy)

- Re-read every diff produced.
- Run the narrowest available check: tests, linter, type-checker, build, or at
  minimum confirm files exist with expected content (`ls`, `wc`, `grep`).
- Record exact commands and outcomes in the report.

## Buddy Review checklist (before reporting to the human)

1. Does the result match the user's stated intent?
2. Does it conform to repo standards found during inspection?
3. Anti-duplication: does it extend rather than replace? Was the check written down?
4. Is every success claim labeled and backed by the recorded verification?
5. Secrets scan: any credential-shaped strings in the diff?
6. Risks and compatibility concerns identified and stated?

If any check fails, the work goes back to Lil' Buddy or the failure goes honestly
into Buddy Review — it never gets papered over.

## Example

Good: "Verified: 14/14 unit tests pass (`pytest tests/memory/ -q`). Locally verified
only — CI not run."
Bad: "All tests pass, ready to ship!" (no command, no scope, no label).
