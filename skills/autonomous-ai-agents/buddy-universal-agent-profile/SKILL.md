---
name: buddy-universal-agent-profile
description: "Buddy + Lil' Buddy portable agent standard across platforms."
version: 1.0.0
author: Cody Sumpter (codysumpter-cloud), Hermes Agent
license: Apache-2.0
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [agent, orchestration, buddy, standard, multi-agent, workflow]
    related_skills: [github-repo-management]
---

# Buddy Universal Agent Profile (BUAP)

Loads the **Buddy** agent behavior standard so any coding agent in the session
operates as a Buddy orchestrator with a Lil' Buddy worker — consistent intent,
planning, delegation, review, and handoff across tools.

BUAP is a **behavior/orchestration standard**, not a sub-agent runtime. It ships
prompt tiers (Kernel → Lite → Standard → Full), platform adapters, schemas,
conformance tests, and CI. Source: `github.com/codysumpter-cloud/buddy-universal-agent-profile`.

## When to Use

- Starting work in a repo where BUAP is installed and you want to operate under the Buddy contract
- Needing a consistent agent identity/orchestration pattern across multiple AI tools (Codex, Claude, Gemini, Grok, Cursor, Windsurf, ChatGPT, Siri, ACP, etc.)
- Preparing a repo to adopt BUAP (install, verify conformance, handoff)
- Auditing whether a target tool actually follows BUAP (conformance checks)
- Needing the multi-agent loop: Human → Buddy → Lil' Buddy → Review → re-brief

Don't use for: running a sub-agent runtime (BUAP doesn't spawn processes by default), or when a repo's own agent contract takes precedence (BUAP respects that).

## Prerequisites

- The target repo has `buddy-universal-agent-profile/` copied into its root, OR
- A platform-specific install is done (Claude plugin, Codex plugin, ChatGPT Project, etc.)
- `gh` authenticated with `repo` scope (for inspecting/updating BUAP in repos)

## How to Run

### Inspect whether a repo uses BUAP

```bash
# Check for BUAP folder or references in a repo
gh repo view <owner>/<repo> --json name,isPrivate 2>/dev/null
# Then clone/navigate and check for buddy-universal-agent-profile/ or AGENTS.md/CLAUDE.md references
```

### Load BUAP for the current session

Point the session at the BUAP root or a tier file:

```
Read the file at <path-to-buap>/CLAUDE.md and follow it.
```

Or for constrained/low-context tools, load a tier:

```
Read <path-to-buap>/BUAP_KERNEL.md  (micro-profile)
Read <path-to-buap>/BUAP_LITE.md    (low-context)
Read <path-to-buap>/BUAP_STANDARD.md (normal)
Read <path-to-buap>/BUAP_FULL.md    (repo-aware)
```

### Install BUAP into a repo

```bash
# Clone and copy into repo root
git clone https://github.com/codysumpter-cloud/buddy-universal-agent-profile.git /tmp/buap
cp -r /tmp/buap <target-repo>/
# Then point the repo's agent entry point at it
# Claude Code: add to CLAUDE.md — "Read buddy-universal-agent-profile/CLAUDE.md and follow it."
# Codex: symlink AGENTS.md or add reference to root AGENTS.md
```

### Run conformance checks

```bash
cd <buap-dir>
node scripts/buap-conformance-check.mjs   # required files + key text
node scripts/buap-lint.mjs                  # plugin manifests, frontmatter, links, invariants
```

### Claude Code plugin install (recommended path)

```
/plugin marketplace add codysumpter-cloud/buddy-universal-agent-profile
/plugin install buap@buap
```

This gives you `/buap-audit`, `/buap-handoff`, a real `lil-buddy` subagent, and safety/receipts hooks.

## Quick Reference

| Tier | File | Context |
|------|------|---------|
| Kernel | `BUAP_KERNEL.md` | Micro, constrained tools |
| Lite | `BUAP_LITE.md` | Low-context, search boxes |
| Standard | `BUAP_STANDARD.md` | Normal AI chats |
| Full | `BUAP_FULL.md` | Repo-aware agents |

| Platform | Install |
|----------|---------|
| Claude Code | `/plugin install buap@buap` or `Read .../CLAUDE.md` |
| Codex | symlink `AGENTS.md` or use `CODEX.md` notes |
| ChatGPT | paste `chatgpt-projects/buddy/00_PROJECT_INSTRUCTIONS_PASTE.md` + upload knowledge files |
| Grok/xAI | paste `GROK_BUAP.md` into custom instructions |
| Siri/App Intents | `SIRI_BUAP.md` + `README_SIRI.md` |
| Xcode/ACP | build `packages/buap-acp-agent/` |
| Cursor | `.cursor/rules/buap.mdc` from template |
| Windsurf | `.windsurf/rules/` from template |
| Gemini CLI | point `GEMINI.md` at the folder |
| Cowork | connect folder, say "Read .../CLAUDE.md and operate under BUAP" |

## Procedure — Adopt BUAP in a repo

1. **Pick the tier** that fits the repo's agent surface (usually Standard or Full).
2. **Copy** `buddy-universal-agent-profile/` into the repo root.
3. **Wire the entry point** — point the repo's `AGENTS.md` / `CLAUDE.md` at BUAP.
4. **Run conformance**: `node scripts/buap-conformance-check.mjs`.
5. **Run lint**: `node scripts/buap-lint.mjs`.
6. **Verify the loop** with a test task: intent → plan → delegate → review → handoff.
7. **Commit** the BUAP folder and the entry-point change together.

## Procedure — Operate as Buddy in-session

1. **Read the BUAP root** or tier file into context at session start.
2. **Buddy role**: clarify intent, plan the work, delegate to Lil' Buddy (or a subagent), review outputs.
3. **Lil' Buddy role**: implement, research, validate — report back with receipts.
4. **Review**: check against BUAP rules — no fake success claims, no hardcoded secrets, no duplicate systems, extend don't replace.
5. **Handoff**: produce copy-paste runnable prompts, commands, diffs, or checklists when the tool can't persist files.

## Pitfalls

- **Repo contract clash**: if the repo has its own `AGENTS.md`/`CLAUDE.md` that conflicts with BUAP, the repo contract takes precedence. BUAP supplies the orchestration beneath it — don't force it on top of an existing contract without checking.
- **Over-installing tiers**: don't load all four tiers at once. Pick one. Loading Kernel + Full together is contradictory.
- **Plugin vs prose**: the Claude plugin path (`/plugin install buap@buap`) gives structural loop (real subagent, slash commands, hooks). The prose path (`Read CLAUDE.md`) is lighter but the loop is advisory, not enforced. Don't claim the plugin path is active when you used prose.
- **MCP bridge claims**: don't claim `buddy-mcp` is locally working until a `buddy-mcp` executable exists and `buddy.self_test` passes. Source-backed ≠ locally verified.
- **Platform sprawl**: BUAP covers 13+ platforms but not all are equally maintained. Prioritize the ones in the Buddy ecosystem; treat the rest as reference.

## Verification

- Conformance passes: `node scripts/buap-conformance-check.mjs` exits 0.
- Lint passes: `node scripts/buap-lint.mjs` exits 0.
- Session behavior: after loading BUAP, the agent clarifies intent before implementing, delegates to a worker, reviews outputs, and produces handoffs — not just jumping to code.
- Plugin (if used): `/buap-audit` and `/buap-handoff` commands are available; `lil-buddy` subagent exists.

## Source

- Repo: `github.com/codysumpter-cloud/buddy-universal-agent-profile`
- Standards: `standards/runtime-contract.md`, `standards/capability-negotiation.md`, `standards/multi-agent-negotiation.md`
- Schemas: `schemas/receipt.schema.json`, `schemas/capability-declaration.schema.json`
- Conformance: `tests/conformance/`, `scripts/buap-conformance-check.mjs`
