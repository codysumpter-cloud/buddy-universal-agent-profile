# Template — installing BUAP into a project

Checklist for adding BUAP to a repository. Copy this file into the task/PR
description and tick as you go.

## Steps

- [ ] Copy `buddy-universal-agent-profile/` into the repo root.
- [ ] **Existing agent contract?** (`AGENTS.md`, `CLAUDE.md`, `soul.md`, rules files)
  - Yes → add one reference line to it (see below). Do NOT replace it; the repo
    contract keeps precedence.
  - No → copy the BUAP entry file for your primary tool to the repo root
    (`AGENTS.md` for Codex/OpenCode, `CLAUDE.md` for Claude Code, `GEMINI.md` for
    Gemini CLI).
- [ ] Per-tool wiring (only the tools the team uses):
  - Codex: root `AGENTS.md` reachable → done. Else see `CODEX.md`.
  - Claude Code: root `CLAUDE.md` references the folder.
  - Claude Projects: paste `SYSTEM_PROMPT.md` into project instructions.
  - Cursor: `.cursor/rules/buap.mdc` ← contents of `SYSTEM_PROMPT.md`.
  - Windsurf: `.windsurf/rules/buap.md` ← contents of `SYSTEM_PROMPT.md`.
  - Cowork: connect repo folder; first message: "Read
    buddy-universal-agent-profile/CLAUDE.md and operate under BUAP."
- [ ] Smoke test: ask the agent "What profile are you operating under, and in which
  mode?" Expect BUAP + real/emulated mode + precedence acknowledgment.
- [ ] Commit with message: `chore: install BUAP (buddy-universal-agent-profile)`.

## Reference line (for existing contracts)

> This repo also adopts the Buddy Universal Agent Profile: read
> `buddy-universal-agent-profile/AGENTS.md` (orchestration loop, validation, and
> safety standards). This repo's own rules take precedence where they conflict.

## Uninstall

Delete the folder and the reference line. Nothing else is touched — BUAP keeps no
state outside its folder.
