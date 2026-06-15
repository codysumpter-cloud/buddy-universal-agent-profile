# Runbook — make PR mergeable

## Goal

Move an open PR toward safe mergeability with evidence.

## Steps

1. Read PR metadata: state, draft status, mergeability, base/head branches, conflicts.
2. Inspect changed files and PR comments.
3. Check CI status and required reviews.
4. If conflicts exist, identify conflicting files and safest resolution path.
5. If checks fail, switch to `fix-pr-checks.md`.
6. If metadata is weak, improve title/body with summary, validation, risks, and rollback.
7. Re-check mergeability.

## Validation

- PR info after updates.
- Changed file list.
- CI/check status when available.

## Do not

- Merge with unknown checks unless risk is explicitly accepted.
- Rewrite branch history without approval.
- Resolve conflicts blindly.
