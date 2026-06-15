# integrations/prismtek-ecosystem-map.md — repo routing map

BUAP is the portable behavior layer. It should route to owning repos instead of copying their full architecture.

## Primary repos

| Repo | Owns | BUAP behavior |
|---|---|---|
| `knowledge-vault` | Durable knowledge, Vegapunk Brain, memory/event architecture, terminology, long-term roadmap | Inspect before memory or architecture changes; emit or consume source-backed knowledge only |
| `buddy-brain` | Governance, council, policies, planning, orchestration doctrine | Inspect before agent policy/council changes; do not duplicate governance rules |
| `buddy-agent` | Runtime execution, tools, skills, action risk, receipts | Inspect before execution or adapter changes; preserve guarded-action behavior |
| `omni-buddy` | Local device runtime, voice/vision, multimodal transport, edge/device behavior | Inspect before local/device/runtime claims; distinguish device-verified from theoretical support |
| `prismtek-apps` | Apps, games, product surfaces, UX, downloads, platform builds | Inspect before product/game claims; verify playable/downloadable status in repo |
| `buddy-universal-agent-profile` | Portable agent profile, prompts, standards, adapters, conformance tests | Define behavior and routing only; do not become the runtime owner |
| `prismtek-site` | Public website/content surface | Inspect before public messaging/site content changes |

## Cross-repo routing examples

| User asks for | Route first | Why |
|---|---|---|
| Make Buddy remember decisions | `knowledge-vault` | Memory/event source of truth lives there |
| Change Buddy/Council behavior | `buddy-brain` then BUAP | Governance owns behavior; BUAP makes it portable |
| Add a tool/action runtime adapter | `buddy-agent` | Execution rules and receipts live there |
| Add local voice/device behavior | `omni-buddy` | Device runtime owns hardware/local surfaces |
| Improve a game or download | `prismtek-apps` | Product state must be verified there |
| Create a ChatGPT/Codex/Claude portable prompt | BUAP | Prompt portability belongs here |

## Anti-sprawl rule

When a desired behavior crosses repos:

1. Name the owning repo.
2. Link or cite the owning file when known.
3. Add only the portable contract to BUAP.
4. Add implementation details to the owning repo.
5. Keep BUAP lightweight enough for copy/paste and broad agent compatibility.

## Linked repo manifest

The machine-readable map lives in `linked-repos/buddy-ecosystem.repos.json`. Update that file when a repo becomes a first-class Buddy ecosystem owner.