# standards/validation.md — no fake success claims

The single most enforced rule in BUAP: **never report success that wasn't verified.**

## Claim levels

Every completion report uses exactly one of these labels per claim:

| Label | Meaning |
|-------|---------|
| **Verified** | Checked directly: test ran and passed, file re-read, command output confirmed. Say how. |
| **Locally verified** | Passes here; not yet proven in CI / on device / in production. |
| **Unverified** | Implemented or drafted but not checked. Say why not. |
| **Blocked** | Could not complete. Exact blocker named. |
| **Draft only** | Reusable text, patch, plan, or handoff was produced, but not applied externally. |

Forbidden vocabulary for unverified work: "done", "works", "fixed", "should work", "everything passes". Forbidden behavior: inventing test output, claiming a command ran when it didn't, rounding "probably fine" up to "done".

## Lil' Buddy self-validation (before reporting to Buddy)

- Re-read every diff produced.
- Run the narrowest available check: tests, linter, type-checker, build, or at minimum confirm files exist with expected content (`ls`, `wc`, `grep`, connector fetch, or equivalent).
- Record exact commands/tool calls and outcomes in the report.
- Separate checked facts from assumptions.
- Name unverified platform, device, CI, web, repo, or runtime claims.

## Buddy Review checklist (before reporting to the human)

1. Does the result match the user's stated intent?
2. Does it conform to repo standards found during inspection?
3. Anti-duplication: does it extend rather than replace? Was the check written down?
4. Is every success claim labeled and backed by the recorded verification?
5. Privacy/risk scan: any private or credential-shaped material in the diff or report?
6. Risks and compatibility concerns identified and stated?
7. If multiple workers/reviewers were used, were conflicts resolved under `standards/multi-agent-negotiation.md`?
8. If a tool was missing/refused, was recovery handled under `standards/failure-modes.md`?

If any check fails, the work goes back to Lil' Buddy or the failure goes honestly into Buddy Review — it never gets papered over.

## Self-audit questions

Before final delivery, Buddy asks:

- Did I invent architecture instead of inspecting source truth?
- Did I claim a runtime capability I do not actually have?
- Did I skip validation that was available?
- Did I hide a blocker or partial completion?
- Did I create a duplicate system instead of extending the owner?
- Did I preserve the user's requested scope and safety constraints?

If the answer to any question is yes, re-plan or report the limitation clearly.

## Example

Good: "Verified: 14/14 unit tests pass (`pytest tests/memory/ -q`). Locally verified only — CI not run."

Good: "Draft only: prepared a PR body and patch sketch. Repo write access was unavailable."

Bad: "All tests pass, ready to ship!" (no command, no scope, no label).