# BUAP Ecosystem Routing Spec

This is the canonical routing spec for deciding which Prismtek/Buddy repo owns a question, behavior, or implementation surface.

## Core rule

BUAP routes work to owning repositories. BUAP should define portable behavior and prompt contracts, not duplicate runtime implementation details.

## Repository ownership

| Repo | Owns | Route here when |
|---|---|---|
| `knowledge-vault` | Durable knowledge, Vegapunk Brain, memory/event architecture, terminology, long-term roadmap | The task involves durable memory, graph events, knowledge architecture, or canonical project records |
| `buddy-brain` | Governance, policy, council systems, orchestration doctrine, operator runbooks | The task changes Buddy behavior, council rules, operating policy, or planning doctrine |
| `buddy-agent` | Guarded execution, action risk, receipts, skills, tool usage, adapters | The task changes runtime execution, tools, approvals, action receipts, or skill behavior |
| `omni-buddy` | Local device runtime, voice, vision, transport, multimodal behavior | The task involves local models, device behavior, embodied runtime, or multimodal transport |
| `prismtek-apps` | Products, apps, games, UX, platform downloads | The task changes shipped app/game behavior, assets, builds, releases, or user surfaces |
| `buddy-universal-agent-profile` | Portable profile, prompt tiers, adapters, conformance tests | The task changes how Buddy behavior is installed or carried across AI tools |
| `prismtek-site` | Public website and marketing surface | The task changes public site content, messaging, or portfolio presentation |

## Conflict order

1. Current user request.
2. Safety, privacy, and verification rules.
3. Target repo-local instructions.
4. Owning repo source files.
5. BUAP standards.
6. External overlays.
7. General AI assumptions.

## Routing examples

| User asks for | First repo | Notes |
|---|---|---|
| Add memory events | `knowledge-vault` | BUAP may describe the portable contract, but implementation belongs in Knowledge Vault or its adapters |
| Improve Buddy council behavior | `buddy-brain` | BUAP can carry the behavior to tools after governance is defined |
| Add a new execution tool | `buddy-agent` | Runtime and receipts belong with guarded execution |
| Add local voice behavior | `omni-buddy` | Local/device validation belongs there |
| Improve a game | `prismtek-apps` | Verify source/build/playability in product repo |
| Update ChatGPT/Codex/Claude instructions | `buddy-universal-agent-profile` | This repo owns install surfaces and conformance |

## Relationship to existing integration docs

- `integrations/buddy-ecosystem-runtime-map.md` remains the runtime-owner detail map.
- `integrations/prismtek-ecosystem-map.md` remains the readable repo overview.
- This file is the routing decision spec that ties both together.

## Validation

For routing-sensitive changes, final reports should state:

- owning repo selected;
- files or sources inspected;
- conflicting repos or docs considered;
- reason for final route;
- validation or handoff required.