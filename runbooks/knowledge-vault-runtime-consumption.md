# Runbook — Knowledge Vault runtime consumption

## Goal

Use Knowledge Vault / Vegapunk Brain as durable Buddy context without inventing memory
or claiming runtime writes that did not happen.

## When to use

Use this runbook when a task involves:

- project history or prior decisions;
- source-of-truth disputes;
- cross-repo architecture;
- resumed work;
- governance/council context;
- public-safe memory updates;
- graph/search/index context.

## Steps

1. Detect whether `codysumpter-cloud/knowledge-vault` is accessible.
2. Read `99-System/Vegapunk Brain/ARCHITECTURE-SUMMARY.md`.
3. Read relevant integration docs for Buddy Agent or Buddy Brain.
4. Use search/index tools when available to retrieve matching `repo:*`, `system:*`,
   `decision:*`, `task:*`, or `concept:*` records.
5. Confirm current implementation truth in the owning repo before claiming freshness.
6. Complete the user task.
7. If the result creates durable knowledge, prepare a public-safe graph event or
   session summary.
8. If no write adapter exists, provide a Knowledge Vault update handoff instead of
   claiming the memory was saved.

## Validation

From the Knowledge Vault repo root, when a shell is available:

```bash
bash "99-System/Vegapunk Brain/scripts/run-vegapunk-brain.sh"
```

If unavailable, mark runtime validation as blocked and cite the missing capability.

## Emit guidance

Emit or draft only public-safe summaries:

- `task:*` for completed work, checks, handoffs, or follow-ups.
- `decision:*` for human-approved architectural or policy choices.
- `system:*` for new runtime/tool capability facts.
- `repo:*` for repo ownership/source-of-truth updates.
- `concept:*` for reusable operating concepts.

## Do not

- Store secrets, private credentials, signed-in browser state, or raw private prompts.
- Treat generated graph outputs as hand-edited source.
- Claim satellite repo emitters exist unless verified.
- Let BUAP become the memory runtime owner.
