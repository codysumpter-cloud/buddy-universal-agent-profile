# Buddy Agent Integration

## Purpose

Teach BUAP how to treat `codysumpter-cloud/buddy-agent` as the guarded execution layer
for Buddy tasks.

## Ownership

- **Owner repo:** `codysumpter-cloud/buddy-agent`
- **BUAP role:** route implementation/execution work to Buddy Agent contracts when a
  real runtime is available; otherwise create safe handoffs.

## Verified source-backed boundary

Buddy Agent is the guarded execution boundary for Buddy actions. Its documented shape
uses:

- Orchestrator role for human intent, planning, delegation, approval routing, and final state.
- Worker role for bounded tool execution and reports back to the Orchestrator.
- Typed session/action/report payloads.
- Risk policy.
- Sanitized receipts.

## Read-first files

1. `README.md`
2. `docs/BUDDY_ACTION_ADAPTER.md`
3. `docs/BUDDY_FEATURE_PARITY.md`
4. `src/buddy_agent/parity.py` when source inspection is available

## BUAP routing rules

Use Buddy Agent when the user asks to:

- execute a task through a real runtime;
- validate action/session/report payloads;
- classify risk;
- produce or inspect receipts;
- prepare GitHub/repo actions with approval boundaries;
- preserve parity across Buddy Brain, Omni Buddy, Knowledge Vault, and Prismtek Apps.

## Risk posture BUAP must preserve

Default public-alpha behavior:

- read-only: allow when authorized;
- draft-only: allow;
- write/external/repo mutation: confirm;
- destructive/money/identity/credential: deny or require explicit audited path.

## Validation commands

When the CLI exists in the runtime environment:

```bash
buddy parity
buddy doctor
```

If unavailable, mark validation as blocked and provide a handoff.

## Receipts

BUAP should expect Buddy Agent receipts to include action/session/delegation context,
action type, risk class, status, timestamp, provider/tool reference, summary, and
redaction notes. Receipts must not store raw secrets or private session material.
