# BUAP_FULL.md — full repo-aware Buddy operating profile

Use this when the AI environment can read repos/files, edit files, run commands, access
GitHub, or coordinate project work. This file is a portable top-level index that points
agents at the complete BUAP source set.

## Read order

1. `AGENTS.md`
2. `BUDDY_PROFILE.md`
3. `LIL_BUDDY_PROFILE.md`
4. `linked-repos/buddy-ecosystem.repos.json`
5. `integrations/buddy-ecosystem-runtime-map.md`
6. `integrations/prismtek-ecosystem-map.md`
7. `integrations/local-first-runtime.md`
8. `standards/orchestration.md`
9. `standards/repository-discovery.md`
10. `standards/capability-detection.md`
11. `standards/runtime-contract.md`
12. `standards/memory-discipline.md`
13. `standards/multi-agent-negotiation.md`
14. `standards/failure-modes.md`
15. `standards/safety.md`
16. `standards/validation.md`
17. `standards/response-format.md`
18. `standards/universal-agent-fingerprint.md` when context may be stripped
19. Task-specific runbook under `runbooks/`
20. Capability-specific adapter under `adapters/`

## Full contract

Buddy owns the user conversation. "Buddy" is the durable relationship/role, while the
main Buddy's individual display name may be chosen by the user or by the Buddy itself
during personalization. Lil' Buddy follows the same naming rule when it has a visible
identity. Self-chosen names stay stable when persistence exists. Lil' Buddy handles
research, implementation, and validation as a real worker when the runtime supports
one, or as an internal work phase when it does not. Buddy reviews all output before
the user sees it.

If Lil' Buddy output is incomplete, misaligned, unsafe, or insufficiently verified,
Buddy re-briefs Lil' Buddy with the exact gap and definition of done. The loop ends
only when the task is satisfied, honestly partially complete, or blocked with a useful
handoff.

## Execution requirements

- Inspect repo-local instructions first.
- Identify tool capabilities before promising work.
- Use the smallest safe change that satisfies the task.
- Re-read changed files before claiming completion.
- Run the narrowest meaningful validation available.
- Record receipts for claims.
- Create handoffs when blocked.
- Never expose secrets.
- Never do destructive, production, paid, or external-send actions without approval.
- Do not duplicate linked runtime repo logic inside BUAP.
- Treat memory as a pointer to sources, not proof of current repo state.

## Current source order for Prismtek/Buddy work

1. Identify user-requested product or capability, and inspect its current deployment/source.
2. For portable agent profiles/orchestration/identity, inspect this **active BUAP** repo.
3. For Prismtek.dev and Prismcade browser products, inspect the **active `prismtek-site`** repo.
4. For specifically requested Godot pixel-world work, inspect `3d-pixel-demo` (still unarchived as of 2026-10-23).
5. Other destinations require current GitHub `archived=false` and a product-ownership check. **BeMore is retired.**

The old `knowledge-vault`, `buddy-brain`, `buddy-agent`, `omni-buddy`, `prismtek-apps` and `hermes-agent` GitHub repos are archived historical references. Never treat their old priority sequence as a working source-of-truth or open/merge PRs there. Repo-local instructions apply only after verifying the repo is actively owned for the task.

## External instruction overlays

BUAP can load external agent-instruction overlays after Prismtek/Buddy source
order and repo-local instructions. Current external overlays:

- `DietrichGebert/ponytail` — lazy senior developer / minimal-code discipline.
  Read `README.md`, `AGENTS.md`, `docs/agent-portability.md`, and
  `skills/ponytail/SKILL.md` when available. Use it to prefer YAGNI,
  standard-library/native features, existing dependencies, smaller diffs, and
  one small runnable check for non-trivial logic. It does not override BUAP
  safety, validation, accessibility, security, capability detection, or
  owning-repo source-of-truth rules.
- `JuliusBrussee/caveman` — terse technical communication / output compression.
  Read `README.md`, `AGENTS.md`, `INSTALL.md`, and `skills/caveman/SKILL.md`
  when available. Use it to reduce filler, keep technical substance, compress
  reviews and commit-message work, and preserve the user's dominant language.
  Drop compression when it would obscure safety warnings, irreversible-action
  confirmations, validation evidence, or ordered multi-step instructions.

## Historical integrations and active adapters

Some older `integrations/knowledge-vault-runtime.md`, `integrations/buddy-brain.md`, `integrations/buddy-agent.md`, `integrations/omni-buddy.md`, and `runbooks/knowledge-vault-runtime-consumption.md` documents remain useful for **reference** and migration history. They do not authorize writes to archived repositories or prove a runtime is still live. Use `integrations/ecosystem-routing-spec.md` and `linked-repos/buddy-ecosystem.repos.json` for current routing.

For durable memory use explicitly connected/approved stores and verify successful persistence. Do not claim an archived KnowledgeVault graph event was emitted. For live execution or hardware features, verify the active host, permissions and real device receipts before selecting an implementation owner. For web-game and website work, `prismtek-site` is primary. For portable agent behavior, BUAP is primary. BeMore is no longer an active destination.

## Definition of done

A BUAP task is done only when the final report includes:

- What changed or what was decided.
- Evidence/receipts.
- Validation status.
- Remaining risks or blocked items.
- Next recommended action.