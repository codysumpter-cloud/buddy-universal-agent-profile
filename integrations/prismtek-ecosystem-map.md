# Prismtek ecosystem map — active vs. archived (2026-10-23)

## Primary working homes

| Repo or service | Current role | Write rule |
|---|---|---|
| [BUAP](https://github.com/codysumpter-cloud/buddy-universal-agent-profile) | Portable agent profiles, standards, behavior, orchestration, adapters and conformance | **Primary active** for portable agent work |
| [Prismtek Site](https://github.com/codysumpter-cloud/prismtek-site) | Website, Prismcade browser/Phaser games, Pixel Studio, Pocket Buddy web, site Workers and integrations | **Primary active** for web products |
| [3D Pixel Demo](https://github.com/codysumpter-cloud/3d-pixel-demo) | Canonical Godot 4.7 Forward+ game project | **Active, project-specific** when Godot work is requested |
| PixelLab Game Builder project | Source/history of each respective PixelLab-native game | Use owner project for edits; verified exports may sync to site |
| Other unarchived repositories | Specialized projects | Verify user intent and ownership each time |

**BeMore is retired.** Do not open new native BeMore tasks or resurrect `prismtek-apps`.

## Historical sources (read-only)

`prismtek-apps`, `knowledge-vault`, `buddy-agent`, `buddy-brain`, `omni-buddy`, `hermes-agent` and `roblox` are GitHub-archived. Legacy directions naming them as runtime, app or governance owners are archival descriptions, not active code destinations. Read them for migration research, licenses, code provenance and conceptual reference only.

## Examples

| Request | Route |
|---|---|
| Update BUAP personas or define AI agent profiles | `buddy-universal-agent-profile` |
| Improve Prismcade HUD, mobile game UI or site tools | `prismtek-site`, plus source PixelLab project when appropriate |
| Fix Godot lighting / water / terrain | `3d-pixel-demo`, after explicit Godot scope |
| Migrate an old archived feature | First inspect correct active owner and existing behavior, then create a *new focused* PR after license/tests; never merge the archive PR |
| Do memory work | Use verified connected memory provider and BUAP scope/retention rules, with archived KnowledgeVault as reference only |
| Ask for BeMore updates | Explain it is retired; proceed only if user expressly restarts and selects active home |

## Guardrail

Before every GitHub write, query fresh `archived` metadata and verify a product match. Never unarchive or bypass write protections to rescue old PRs. A memory note and this routing map do not prove an actual runtime or deployment exists. Detailed authority: `integrations/ecosystem-routing-spec.md`.
