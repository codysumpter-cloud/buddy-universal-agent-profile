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
- A real worker path exists in the ecosystem: Buddy Brain's `mcp/codex-bridge/`
  (now `prismtek-apps/tools/buddy-brain/mcp/codex-bridge/`)
  dispatches Codex runs into isolated git worktrees with structured artifacts. When
  operating from an orchestrator that can call it, treat each bridge run as a
  Lil' Buddy (see `standards/orchestration.md`).
- Precedence: repo `AGENTS.md` > global `~/.codex/AGENTS.md`. BUAP follows the same
  rule — repo contracts win.

## Buddy MCP bridge for Codex

Buddy Agent PR `codysumpter-cloud/buddy-agent#24` (archived repository; historical
reference) defines a local stdio MCP bridge so
Codex, Odysseus, and other MCP clients can call safe Buddy tools without forking
Odysseus or duplicating Buddy Agent runtime code.

Read:

1. `integrations/buddy-mcp-server.md`
2. `runbooks/buddy-mcp-bridge.md`
3. `adapters/codex-buddy-mcp.template.toml`
4. `codysumpter-cloud/prismtek-apps` -> `services/buddy-agent/docs/BUDDY_MCP_SERVER.md`

Truthfulness rule: PR #24 is source-backed documentation, but a fresh checkout does
not prove that a local `buddy-mcp` executable exists. Do not claim the bridge is
working until the current environment has a configured MCP client and a passing
`buddy.self_test` receipt.

## Personalization / User Profile Loading

BUAP provides a repo-backed profile path for Codex sessions. It does not claim to
change hidden, global, or model-provider personalization.

When repository access is available, Codex should read:

1. `docs/CODEX_PERSONALIZATION_PROFILE.md`
2. Cody's local-first BUAP memory, when available:
   - `knowledge-vault/99-System/BUAP/WHAT_YOU_KNOW_ABOUT_ME.md`
   - `knowledge-vault/99-System/BUAP/BUAP_HATCH_CONTEXT.md`
   - `knowledge-vault/99-System/BUAP/BUAP_PROFILE_PAIRING.md`
   - `knowledge-vault/99-System/BUAP/BUAP_TOOLING_CONTEXT.md`
3. Repo pointers:
   - `personalization/WHAT_YOU_KNOW_ABOUT_ME_POINTER.md`
   - `personalization/BUAP_HATCH_CONTEXT.md`
4. `linked-repos/buddy-ecosystem.repos.json`
5. `integrations/buddy-ecosystem-runtime-map.md`
6. Buddy Brain profile/context docs:
   - `buddy-brain/AGENTS.md`
   - `buddy-brain/soul.md`
   - `buddy-brain/memory.md` in direct main-session work only
   - `buddy-brain/routines.md`
   - `buddy-brain/RESPONSE_GUIDE.md`
   - `buddy-brain/context/RUNBOOK.md`
   - `buddy-brain/docs/CODEX_PERSONALIZATION_BRIDGE.md`
7. Knowledge Vault / Vegapunk Brain docs:
   - `knowledge-vault/99-System/Vegapunk Brain/ARCHITECTURE-SUMMARY.md`
   - `knowledge-vault/99-System/Vegapunk Brain/integrations/codex-personalization.md`
8. Ponytail external instruction overlay, when available or installed:
   - `ponytail/README.md`
   - `ponytail/AGENTS.md`
   - `ponytail/docs/agent-portability.md`
   - `ponytail/skills/ponytail/SKILL.md`
9. Caveman external instruction overlay, when available or installed:
   - `caveman/README.md`
   - `caveman/AGENTS.md`
   - `caveman/INSTALL.md`
   - `caveman/skills/caveman/SKILL.md`

Use these files as Source-backed context, then verify freshness in the owning
repo before claiming current runtime behavior. Do not copy secrets, credential
files, raw private prompts, browser state, private local paths, or ignored
private notes into prompts, public repos, receipts, or memory events.

Before `$hatch-pet create a pet based on what you know about me`, load
`/Users/prismtek/Prismtek/knowledge-vault/99-System/BUAP/BUAP_HATCH_CONTEXT.md`
and, when useful, the high-level
`/Users/prismtek/Prismtek/knowledge-vault/99-System/BUAP/WHAT_YOU_KNOW_ABOUT_ME.md`.
Active Cody profile pairing: Buddy=`bmo`, Lil Buddy=`finn`.

## OpenCode

OpenCode also honors `AGENTS.md` conventions: same per-repo install as option 1.
If it supports agent/mode definitions, define a "lil-buddy" worker mode from
`LIL_BUDDY_PROFILE.md` and have the primary mode delegate to it.
