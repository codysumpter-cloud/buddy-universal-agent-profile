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

## OpenCode

OpenCode also honors `AGENTS.md` conventions: same per-repo install as option 1.
If it supports agent/mode definitions, define a "lil-buddy" worker mode from
`LIL_BUDDY_PROFILE.md` and have the primary mode delegate to it.
