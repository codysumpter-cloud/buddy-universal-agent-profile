# Buddy Brain Integration

> **Consolidated.** `codysumpter-cloud/buddy-brain` was migrated into the `prismtek-apps`
> monorepo at `tools/buddy-brain` (source head `22bdfd4067635c0aa242565a652329bf509802e9`) and archived read-only.
> Route work to the path, not the archived repository URL.
> Record: `prismtek-apps/docs/migrations/buddy-brain.yaml`. Tracker: `prismtek-apps#359`.

## Purpose

Teach BUAP how to treat `codysumpter-cloud/prismtek-apps` at `tools/buddy-brain` as the operator brain,
governance, council, memory, policy, runbook, and cross-repo coordination source.

## Ownership

- **Owner path:** `codysumpter-cloud/prismtek-apps` at `tools/buddy-brain`
- **BUAP role:** defer governance, policy, council posture, durable operator context,
  skills registry, and coordination rules to Buddy Brain.

## Verified source-backed boundary

Buddy Brain owns:

- operator brain and policy layer;
- council roles and review posture;
- durable context and continuity files;
- runtime posture;
- skills registry;
- sync helpers and coordination contracts.

Product/runtime repos should consume those contracts instead of inventing second systems.

## Read-first files

1. `README.md`
2. `AGENTS.md`
3. `soul.md`
4. `memory.md`
5. `routines.md`
6. `RESPONSE_GUIDE.md`
7. `context/RUNBOOK.md`
8. `TASK_STATE.md`
9. `WORK_IN_PROGRESS.md`
10. `skills/README.md`

## BUAP routing rules

Use Buddy Brain when the task involves:

- governance or policy;
- Council roles or reviews;
- cross-repo decision-making;
- operator runbooks;
- continuity/status reconstruction;
- skills registry changes;
- runtime posture or source-of-truth boundaries.

## Validation commands

When operating in Buddy Brain:

```bash
make doctor
make runtime-doctor
make workspace-sync
make project-snapshot
```

Host-dependent commands may fail until the required local runtime stack exists. If so,
record the blocker instead of claiming runtime validation passed.

## Knowledge Vault relationship

Buddy Brain should consume `decision:*`, `repo:*`, `system:*`, and safe `person:*`
records before plan review. It should emit public-safe `decision:*`, `system:*`,
`task:*`, and `concept:*` updates after human-approved policy or governance changes.
