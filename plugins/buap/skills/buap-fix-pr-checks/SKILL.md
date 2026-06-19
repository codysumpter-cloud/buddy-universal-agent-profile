---
name: buap-fix-pr-checks
description: >-
  Diagnose failing PR / CI checks and produce a focused fix without widening scope. Use
  when asked to fix failing checks, make a PR green/mergeable, debug CI failures, or
  resolve red builds on a pull request. Follows the BUAP fix-pr-checks runbook and backs
  the result with fresh validation receipts.
---

# BUAP fix PR checks

Diagnose failing checks and produce a focused fix **without widening scope**. This is the
BUAP `runbooks/fix-pr-checks.md` procedure.

## Steps

1. Identify the PR, branch, base, head SHA, and the exact failing check names.
2. Read the changed files and repo-local instructions.
3. Fetch check logs / CI output when available (`gh pr checks`, `gh run view --log`).
4. Reproduce the failure locally when possible.
5. Fix the smallest root cause. Do not touch unrelated files.
6. Run the relevant check again and capture the output.
7. Update the PR with what changed and the validation receipts.

## Validation

- Attach command output or a CI run link as the receipt.
- If logs are unavailable, mark the task **Blocked** and provide the exact commands the
  human can run to collect them — do not guess at the cause.

## Do not

- Rewrite unrelated files to "while we're here" them.
- Hide or mute a failing check instead of fixing it.
- Mark the PR ready without fresh validation.

For multi-check or unfamiliar failures, delegate diagnosis + fix to the `lil-buddy`
subagent and review its receipts before reporting the PR ready.
