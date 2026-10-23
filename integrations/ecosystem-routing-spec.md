# BUAP ecosystem routing: current primary homes

This document is the **canonical routing spec** for active Prismtek projects.

**Owner decision (2026-10-23): BUAP and prismtek-site are the active priorities. BeMore is retired.** This file supersedes older Buddy/BeMore monorepo routing claims in historical documentation. A repository's real-time GitHub archive status and the user's current decision override old reference maps.

## Mandatory write preflight

For any PR, push, branch update, automated code change, merge, or deployment: identify the requested product and verify the *intended* GitHub repository is not archived. Archived repositories can be read for references, migration history, provenance, and licenses, **never written to**. Never unarchive one or bypass a 403 to push work. An unarchived repo can still be the wrong destination. Verify ownership and inspect active code/tests for duplicates.

## Current owners

| Need | Destination |
|---|---|
| Portable AI agent standards, BUAP profiles, identity, memory contracts, orchestration behavior, capability negotiation, install/client adapters, conformance | `codysumpter-cloud/buddy-universal-agent-profile` (active primary) |
| Prismtek.dev website, Prismcade web games and Phaser runtime, Pixel Studio, Pocket Buddy web, site Cloudflare Functions/Workers and website integrations | `codysumpter-cloud/prismtek-site` (active primary) |
| Individual PixelLab Game Builder project source/history | The owning PixelLab project; selectively sync tested web exports to `prismtek-site` |
| Godot 4.7 Forward+ pixel-world/shader/scene work | `codysumpter-cloud/3d-pixel-demo` (still unarchived; project-specific, not the default) |
| Current running device/agent services outside BUAP or site | **Verify the live owning deployment, agent host and writable repo first**; do not infer it from retired Hermes/Buddy repos |
| BeMore native apps / former monorepo | **Retired**, no automatic successor or build work |
| Historical PvP Roblox prototype | **Reference only** while old `roblox` repo is archived; no asserted successor |

**Archived reference-only as verified on 2026-10-23:** `prismtek-apps`, `knowledge-vault`, `buddy-agent`, `buddy-brain`, `omni-buddy`, `roblox`, `hermes-agent` and numerous forks. Historic consolidation records point to `prismtek-apps` but that repository is itself archived; never interpret those records as an active route.

## Source precedence

1. Current user intent, safety and approval boundaries.
2. Current owning project's GitHub `archived` state, README/AGENTS and working code.
3. Verified running services, deployments, build/test receipts.
4. BUAP portable contracts, this routing spec and the linked manifest.
5. Old integration docs, archived project READMEs and historical agent handoffs (read-only reference).
6. External overlays and generic assumptions.

## Example routing

| User requests | Work in |
|---|---|
| Create a new persistent agent profile / update agent prompt tiers | BUAP |
| Update Pixel Studio, WorldBox-style browser game, Prismcade UI | `prismtek-site` (and corresponding PixelLab project when relevant) |
| Fix a Godot Forward+ material or terrain plugin | `3d-pixel-demo`, with strict Godot tests |
| Retrieve old KnowledgeVault notes or former Buddy Agent behavior | Read archived references, then persist *new* memory in connected approved memory service or active code home |
| Reopen BeMore development | Do **not** start unless the owner explicitly reverses retirement and chooses a new active home |

## Migration and verification

Old open PRs targeting archives cannot be simply redirected in GitHub; review historical diffs and carry only useful, licensed, nonduplicated changes into newly scoped PRs in the correct active repo. Report tests and source provenance. If no current owner is verifiable, stop the write, not the explanation.

Supporting material: `linked-repos/buddy-ecosystem.repos.json`, `integrations/buddy-ecosystem-runtime-map.md`, `integrations/prismtek-ecosystem-map.md`, and `standards/repository-discovery.md`.
