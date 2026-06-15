# Handoff Example — PR repair

```text
You are operating under BUAP.

Goal: Repair PR [number] in [repo].

Read first:
- PR metadata
- changed file list
- failing checks or review comments
- repo-local instructions

Current verified state:
- [status]

Steps:
1. Inspect the PR diff.
2. Identify failing check or merge blocker.
3. Apply the smallest fix.
4. Run relevant validation.
5. Update PR body with validation and risk.

Definition of done:
- PR is mergeable or blocker is explicitly named.
- Validation is recorded.
```
