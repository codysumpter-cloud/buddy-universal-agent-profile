# Knowledge Vault Runtime Integration

## Purpose

Teach BUAP-compatible agents how to use `codysumpter-cloud/knowledge-vault` as the
Buddy ecosystem's durable memory and graph runtime without making BUAP itself the
runtime owner.

## Ownership

- **Owner repo:** `codysumpter-cloud/knowledge-vault`
- **Runtime system:** `99-System/Vegapunk Brain/`
- **BUAP role:** discover, route, consume public-safe context, and emit public-safe
  summaries/events when the runtime adapter exists.

## What Knowledge Vault provides

Vegapunk Brain is an event-sourced shared-memory platform for Buddy ecosystem repos.
The source runtime flow is:

```text
Buddy Agent / Buddy Brain / Omni Buddy / Prismtek Apps
→ Event Emitters
→ Vegapunk Brain Inbox
→ Event Ingestor
→ Event Router
→ Graph Compiler
→ Knowledge Graph
→ Indexes / Search / Health / Exports
→ Future Sessions
```

## Read-first files

When a task needs durable Buddy context, read:

1. `99-System/Vegapunk Brain/ARCHITECTURE-SUMMARY.md`
2. `99-System/Vegapunk Brain/scripts/README.md`
3. `99-System/Vegapunk Brain/integrations/buddy-agent.md`
4. `99-System/Vegapunk Brain/integrations/buddy-brain.md`
5. `99-System/Vegapunk Brain/future-state.md`

## Runtime paths BUAP should know

| Layer | Path | BUAP use |
|---|---|---|
| Event schema | `99-System/Vegapunk Brain/emitters/graph-event.schema.json` | Validate public-safe event shape before handoff/write. |
| Inbox | `99-System/Vegapunk Brain/inbox/events/` | Stage incoming graph events when an audited adapter exists. |
| Processed events | `99-System/Vegapunk Brain/inbox/processed/` | Durable routed event history. |
| Compiler | `99-System/Vegapunk Brain/tools/graph_compiler.py` | Compile events into graph records. |
| Rebuilder | `99-System/Vegapunk Brain/tools/graph_rebuilder.py` | Rebuild graph from seed + processed event history. |
| Search | `99-System/Vegapunk Brain/tools/graph_search.py` | Retrieve durable context before architecture decisions or resumed tasks. |
| Health | `99-System/Vegapunk Brain/tools/graph_health.py` | Check graph integrity. |
| Indexes | `99-System/Vegapunk Brain/indexes/*.json` | Use generated indexes for fast lookup when available. |

## Local validation command

From the `knowledge-vault` repo root:

```bash
bash "99-System/Vegapunk Brain/scripts/run-vegapunk-brain.sh"
```

The Knowledge Vault script compiles the example session, lints seed/generated records,
builds the compiled graph, lints the compiled graph, generates indexes, and runs a
sample search.

## BUAP consume flow

Use this before major architecture, memory, governance, repo ownership, or resumed task
work:

1. Detect whether Knowledge Vault repo access exists.
2. If available, read the architecture summary and relevant integration docs.
3. Use graph search/indexes for `repo:*`, `system:*`, `decision:*`, and `task:*` records.
4. Treat graph output as source-backed context, not as fresh runtime proof.
5. Confirm against owning repos before claiming current implementation status.

## BUAP emit flow

Use this after meaningful task completion only when a safe write path exists:

1. Summarize the task outcome without secrets or private local paths.
2. Classify the record as `task:*`, `decision:*`, `system:*`, `repo:*`, or `concept:*`.
3. Validate against the graph event schema.
4. Stage the event for Knowledge Vault intake.
5. Let Knowledge Vault compile and validate before treating it as durable memory.

If the write path is missing, produce a handoff instead of claiming the event was saved.

## Boundaries

- BUAP does not own or mutate canonical memory by itself.
- Knowledge Vault owns durable graph memory and runtime tools.
- Buddy Agent should emit task/action/runtime records after execution.
- Buddy Brain should emit governance/policy/council decisions.
- Omni Buddy should emit device/runtime/transport status records.
- Private credentials, signed-in browser state, raw secrets, and unreviewed private repo
  details must not be emitted.

## Current limitation

The Knowledge Vault platform contains the intake/compile/rebuild system, but satellite
repos still need their own native event emitters wired into task/session/release flows.
BUAP should route and prepare events; it must not pretend satellite emitters already
exist unless verified in the owning repo.
