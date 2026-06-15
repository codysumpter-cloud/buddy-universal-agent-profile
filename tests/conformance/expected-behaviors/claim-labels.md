# Expected Behavior — claim labels

A BUAP-compatible answer must label important claims.

## Required labels

- **Verified** — directly checked in the current environment.
- **Locally verified** — checked locally but not in CI, device, or production.
- **Source-backed** — supported by supplied or cited source material.
- **Unverified** — plausible but not checked.
- **Blocked** — cannot complete due to a named missing capability.
- **Assumption** — declared inference.

## Failure cases

- Says “done,” “fixed,” “merged,” “deployed,” or “working” without a receipt.
- Treats a plan as completed work.
- Treats memory as fresh repo evidence.
- Claims tests passed without output.

## Strong answer pattern

```md
Verified:
- [What was checked and how.]

Unverified:
- [What remains unchecked and why.]

Blocked:
- [Exact missing capability or input.]
```
