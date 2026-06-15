# CODEX.md — BUAP install notes for Codex (and OpenCode)

Codex reads `AGENTS.md` files automatically; this file covers wiring BUAP in.

## Install options

1. **Per repo (recommended):** copy this folder to the repo root, then either
   - copy `buddy-universal-agent-profile/AGENTS.md` to the repo root as `AGENTS.md`
     (only if the repo has none), or
   - if a root `AGENTS.md` already exists, append:
     `Also read and follow buddy-universal-agent-profile/AGENTS.md (BUAP).`
     Never create a second competing contract.
2. **Global:** merge the contents of `AGENTS.md` into `~/.codex/AGENTS.md`.
   A Codex-specific global profile already exists there in this workspace —
   BUAP is the portable superset; don't duplicate, reference.

## Codex-specific notes

- Codex has no persistent sub-agent runtime exposed to instructions. Lil' Buddy is
  **emulated**: run the loop as explicit phases (plan → work → review) in one session,
  using the response format in `standards/response-format.md`.
- A real worker path exists in the ecosystem: buddy-brain's `mcp/codex-bridge/`
  dispatches Codex runs into isolated git worktrees with structured artifacts. When
  operating from an orchestrator that can call it, treat each bridge run as a
  Lil' Buddy (see `standards/orchestration.md`).
- Precedence: repo `AGENTS.md` > global `~/.codex/AGENTS.md`. BUAP follows the same
  rule — repo contracts win.

## Personalization / User Profile Loading

BUAP provides a repo-backed profile path for Codex sessions. It does not claim to
change hidden, global, or model-provider personalization.

When repository access is available, Codex should read:

1. `docs/CODEX_PERSONALIZATION_PROFILE.md`
2. `linked-repos/buddy-ecosystem.repos.json`
3. `integrations/buddy-ecosystem-runtime-map.md`
4. Buddy Brain profile/context docs:
   - `buddy-brain/AGENTS.md`
   - `buddy-brain/soul.md`
   - `buddy-brain/memory.md` in direct main-session work only
   - `buddy-brain/routines.md`
   - `buddy-brain/RESPONSE_GUIDE.md`
   - `buddy-brain/context/RUNBOOK.md`
   - `buddy-brain/docs/CODEX_PERSONALIZATION_BRIDGE.md`
5. Knowledge Vault / Vegapunk Brain docs:
   - `knowledge-vault/99-System/Vegapunk Brain/ARCHITECTURE-SUMMARY.md`
   - `knowledge-vault/99-System/Vegapunk Brain/integrations/codex-personalization.md`
6. Ponytail external instruction overlay, when available or installed:
   - `ponytail/README.md`
   - `ponytail/AGENTS.md`
   - `ponytail/docs/agent-portability.md`
   - `ponytail/skills/ponytail/SKILL.md`

Use these files as Source-backed context, then verify freshness in the owning
repo before claiming current runtime behavior. Do not copy secrets, credential
files, raw private prompts, browser state, private local paths, or ignored
private notes into prompts, public repos, receipts, or memory events.

## OpenCode

OpenCode also honors `AGENTS.md` conventions: same per-repo install as option 1.
If it supports agent/mode definitions, define a "lil-buddy" worker mode from
`LIL_BUDDY_PROFILE.md` and have the primary mode delegate to it.
