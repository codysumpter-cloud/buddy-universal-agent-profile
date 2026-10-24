# BUAP Agent Handoff v1 — portable and verifiable

Schema marker: `prismtek-agent-handoff-v1`. Produced by `createHandoff(runtime, manifest, stepId, options)` in `@prismtek/buap-mission-control`.

A handoff is a **task brief**, not a task-execution token. A host receiving it must independently authenticate the initiator, authorize requested tools, apply sandboxing and egress restrictions, and attach independent execution receipts.

| Field | Meaning |
|---|---|
| `request_id` | Host-supplied correlation/idempotency reference |
| `mission_id`, `mission_sha256` | Exact plan identity and canonical payload hash |
| `from_agent` | Initiating Agent Profile id; **not** a verified network identity |
| `task_id`, `action`, `title`, `scope` | Narrow delegated job |
| `capabilities` | Declared symbolic capability requirements, not grants |
| `source_refs` | Provenance references supplied by the host |
| `required_checks` | Verification checklist for accepting a result |
| `limits` | Estimated budget for scheduling, not a provider quota |
| `authorization` | Current local BUAP rule evaluation (may be `ask`) |
| `transport` | `host_managed`: **not** A2A/MCP transport parity |

Required receive-side behavior: verify the manifest hash, protect cross-tenant context, treat text and tool descriptions as untrusted, obtain user approval for meaningful side effects, and refuse tasks whose declared permissions exceed the receiving agent's own policy. Re-run the exact checks and attach immutable evidence identifiers before marking completed.

For A2A v1 agents, build a distinct authenticated adapter that maps BUAP fields onto the real Agent Card/Task lifecycle and protocol security requirements. Never label this JSON object as a working A2A endpoint.
