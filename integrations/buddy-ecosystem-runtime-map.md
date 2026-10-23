# BUAP runtime and repo routing map (updated 2026-10-23)

BUAP defines portable agent contracts, profiles, permissions, worker protocols, and adapters. It does not claim ownership of all live runtime systems. The owner currently prioritizes **BUAP** and **prismtek-site**; **BeMore is retired**.

| Need | Primary active owner |
|---|---|
| Portable agent identity, profiles, delegation, conformance, memory policy and portable adapters | `buddy-universal-agent-profile` |
| Website, Prismcade web games, Pixel Studio, Pocket Buddy web, site Workers | `prismtek-site` |
| PixelLab-created games | The relevant PixelLab Game Builder project for source history; tested website integration in `prismtek-site` |
| Godot 4.7 Forward+ world project (when explicitly in scope) | `3d-pixel-demo` |
| Connected durable memory, local agent execution, device voice/vision | The *actual verified* connected memory service, live host, or owning active repo — **not** an old archive by default |
| Retired BeMore product and old `prismtek-apps` monorepo | Historical read-only reference; no ongoing development target |

## Reference archives

`knowledge-vault`, `buddy-brain`, `buddy-agent`, `omni-buddy`, `prismtek-apps` and `hermes-agent` were archived in GitHub when checked on 2026-10-23. Earlier documentation attributes graph memory, governance, execution, device runtimes and products to these repos; **those are historical mappings**. Their code can inform a *new, explicitly scoped* migration but may not receive writes, workflow updates, or PR merges.

## Task routing

1. Identify the user's target and check the active repo's current GitHub `archived=false` metadata before writing.
2. Verify real runtime/connector availability and the product-specific code owner; do not silently treat an unarchived repo as primary for unrelated work.
3. Inspect active README/AGENTS, code and prior changes; don't duplicate features. Historic vault/agent archives may be consulted read-only.
4. Use available execution adapters only with verified host permissions and approval guards; don't infer live deployments from source docs.
5. Validate CI/builds and real UI or hardware where appropriate; record source-linked receipts, blockers and explicit handoffs.
6. Persist long-term memory in actually connected approved services; archived KnowledgeVault repository is not a writable memory sink.

## External overlays

The optional `DietrichGebert/ponytail` minimal-code and `JuliusBrussee/caveman` concise-communication overlays may assist, but they never override this active ownership map, agent safety or repo-local rules.

## Status labels

- **Source-backed:** present in inspected source.
- **Runtime-verified:** tested in actual working host.
- **Device-verified:** validated on device/hardware.
- **Historical reference:** archived code/docs, *not current implementation*.
- **Blocked:** missing owner, permission, CI, runtime or required account access.
- **Handoff-ready:** actionable handoff with current owner and evidence.

`integrations/ecosystem-routing-spec.md` is the canonical decision spec. `linked-repos/buddy-ecosystem.repos.json` is the machine-readable active/history map.
