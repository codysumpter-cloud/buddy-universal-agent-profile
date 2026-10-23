# Repository discovery and archive safety — mandatory preflight

Owner decision: 2026-10-23. Prismtek currently prioritizes **BUAP** and **prismtek-site**, not BeMore or the old monorepo.

## Active ownership

| Repository | Verified GitHub status | Use |
|---|---|---|
| `codysumpter-cloud/buddy-universal-agent-profile` | Unarchived | Primary home for portable agent behavior, identity, profiles, orchestration, adapters and conformance |
| `codysumpter-cloud/prismtek-site` | Unarchived | Primary home for Prismtek.dev, Prismcade web/Phaser games, Pixel Studio and site services |
| `codysumpter-cloud/3d-pixel-demo` | Unarchived | Project-specific Godot 4.7 Forward+ world only when the request is about that project |
| Other projects | Must query metadata | Route only after verifying the owner's current project choice |

The historically central `prismtek-apps`, `knowledge-vault`, `buddy-agent`, `buddy-brain`, `omni-buddy`, `hermes-agent`, and `roblox` GitHub repos were **archived** when checked on 2026-10-23. BeMore is **retired**. Archived repositories are reference-only, not development candidates.

## Mandatory write gate

Before creating PRs, branches, commits, merges, automated edits or deployments:

1. Confirm the task's product/owner, then ask GitHub for the proposed target's current `archived` flag. Refuse writes if archived; do not unarchive or bypass 403 errors.
2. Inspect current README, AGENTS, relevant code, deployment and tests at the **active** repo. Do not equate "unarchived" with "correct owner".
3. Inspect archived old source only as a *read-only* reference for code, provenance or licenses. Check duplicates in the destination; transfer only focused useful changes on a fresh active branch, preserving attribution.
4. Verify CI, build and runtime behavior before claiming or merging a change. For graphical games, tests alone do not verify rendering.
5. If no correct live owner is confirmed, report the ambiguity and withhold a write rather than inventing a project or reviving BeMore.

## Source-of-truth precedence

Current user decision and safety > active repo's current instructions and code > verified deployments/builds > BUAP contracts > historical archived docs > generic assumptions. Persistent memories help locate context but never prove live repository or release state.

## Access and recovery

Use connected GitHub metadata and code when possible. If inaccessible, identify the missing verification step rather than routing to a historical default. Each meaningful implementation should name the selected repo, alternative repos ruled out, validation evidence, and unresolved blockers.
