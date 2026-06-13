# Buddy Universal Agent Profile (BUAP)

A portable, tool-agnostic agent behavior standard for the Prismtek / Buddy ecosystem
(GitHub org: **codysumpter-cloud**). Drop this folder into any repository and any
capable coding agent — Codex, Claude Code, Claude Projects, Cowork, OpenCode,
Gemini CLI, Cursor, Windsurf, or future frameworks — behaves as **Buddy** (user-facing
orchestrator) with at least one **Lil' Buddy** (implementation worker).

BUAP is a **behavior/orchestration standard, not a sub-agent runtime**. It does not
spawn processes. Where real sub-agent runtimes exist, `standards/orchestration.md`
documents how to connect them; where they don't, Lil' Buddy is emulated as a workflow
pattern.

## The contract in one block

```
Roles:   Buddy = user-facing orchestrator (intent, plan, delegate, review, communicate)
         Lil' Buddy = worker (research, implementation, validation, reporting)
Loop:    Human → Buddy → Lil' Buddy → Buddy Review → Human
Truth:   github.com/codysumpter-cloud →
         knowledge-vault → buddy-brain → buddy-agent → omni-buddy → prismtek-apps
Rules:   inspect repos before architecture changes · repo standards override generic
         AI assumptions · no fake success claims · no hardcoded secrets ·
         no duplicate systems · extend, don't replace
```

## Folder map

| Path | Purpose |
|------|---------|
| `AGENTS.md` | Entry point for Codex / OpenCode / AGENTS.md-aware tools |
| `CLAUDE.md` | Entry point for Claude Code / Claude Projects / Cowork |
| `CODEX.md` | Codex-specific install notes and quirks |
| `GEMINI.md` | Entry point for Gemini CLI |
| `SYSTEM_PROMPT.md` | Copy-paste system prompt for any other agent |
| `BUDDY_PROFILE.md` | Full Buddy role specification |
| `LIL_BUDDY_PROFILE.md` | Full Lil' Buddy role specification |
| `standards/` | Orchestration, repo discovery, safety, validation, response format |
| `chatgpt-projects/buddy/` | ChatGPT Project source pack: pasteable project instructions, uploadable knowledge files, source metadata, and test prompts |
| `examples/` | Worked end-to-end examples |
| `templates/` | Bootstrap, install, and onboarding templates |

## Installation

**Any repo (all tools):** copy `buddy-universal-agent-profile/` into the repo root.

- **Codex:** symlink or copy `AGENTS.md` to the repo root as `AGENTS.md`, or add
  "Read buddy-universal-agent-profile/AGENTS.md first" to your existing root
  `AGENTS.md`. Details: `CODEX.md`.
- **Claude Code:** add to the repo's `CLAUDE.md` (or create one):
  `Read buddy-universal-agent-profile/CLAUDE.md and follow it.`
- **Claude Projects:** paste `SYSTEM_PROMPT.md` into the project's custom
  instructions; attach this folder's files as project knowledge.
- **ChatGPT Projects:** use `chatgpt-projects/buddy/`; paste
  `00_PROJECT_INSTRUCTIONS_PASTE.md` into Project instructions and upload the
  files in `chatgpt-projects/buddy/knowledge/` as Project files.
- **Cursor:** create `.cursor/rules/buap.mdc` (or legacy `.cursorrules`) containing
  the contents of `SYSTEM_PROMPT.md`, or an instruction to read this folder.
- **Windsurf:** add `SYSTEM_PROMPT.md` contents to `.windsurf/rules/` (or global
  rules), or instruct Cascade to read this folder first.
- **Cowork:** connect the repo folder and say: "Read
  buddy-universal-agent-profile/CLAUDE.md and operate under BUAP." Cowork has a real
  sub-agent tool — Buddy should use it for Lil' Buddy work.
- **Gemini CLI:** point `GEMINI.md` context (root `GEMINI.md` or settings
  `contextFileName`) at this folder. Details: `GEMINI.md`.
- **Anything else:** feed `SYSTEM_PROMPT.md` as the system prompt.

If a repo already has its own agent contract (e.g. buddy-brain's BMO `AGENTS.md`),
that repo contract **takes precedence**; BUAP supplies the orchestration loop beneath it.

## Versioning

BUAP-1 (2026-06). Changes to roles, loop, or rules bump the major version.
