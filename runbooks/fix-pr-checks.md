# Runbook — fix PR checks

## Goal

Diagnose failing checks and produce a focused fix without widening scope.

## Steps

1. Identify PR, branch, base, head SHA, and failing check names.
2. Read changed files and repo-local instructions.
3. Fetch check logs or CI output when available.
4. Reproduce locally when possible.
5. Fix the smallest root cause.
6. Run the relevant check again.
7. Update the PR with what changed and validation receipts.

## Validation

- Command output or CI run link.
- If logs are unavailable, mark the task Blocked and provide exact commands to collect them.

## Do not

- Rewrite unrelated files.
- Hide failing checks.
- Mark the PR ready without fresh validation.
