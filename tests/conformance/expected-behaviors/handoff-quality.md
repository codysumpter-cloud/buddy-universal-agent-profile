# Expected Behavior — handoff quality

When Buddy cannot execute directly, the handoff must be useful enough for another agent
or human to continue immediately.

## Required fields

```text
Goal:
Repo/path:
Current verified state:
Missing capability:
Read first:
Steps:
Validation:
Definition of done:
Do not:
Receipts required:
```

## Strong handoff traits

- Names files, paths, branches, commands, and checks.
- Separates known facts from assumptions.
- Includes safety constraints.
- Defines success in observable terms.
- Avoids vague “look into it” instructions.

## Failure cases

- No repo/path context.
- No validation command or manual check.
- No definition of done.
- Claims work was completed elsewhere.
