# BUAP Claude Code and Codex plugin

This is the Buddy Universal Agent Profile packaged as native Claude Code and Codex plugin
assets. It turns the BUAP prose contract into harness primitives so the Buddy -> Lil'
Buddy -> review loop is more structural and easier to verify.

## What it ships

| Component | Path | What it does |
|---|---|---|
| Claude manifest | `.claude-plugin/plugin.json` | Claude Code plugin metadata. |
| Codex manifest | `.codex-plugin/plugin.json` | Codex plugin metadata and interface details. |
| `lil-buddy` profile | `agents/lil-buddy.md` | Claude can use this as a real worker subagent; Codex uses it as the Lil Buddy worker profile/asset when real subagents are unavailable. |
| Skills | `skills/buap-*/SKILL.md` | The BUAP runbooks as model-invoked skills: `buap-repo-audit`, `buap-fix-pr-checks`, `buap-migrate-repo`. |
| Commands | `commands/buap-*.md` | `/buap-audit` and `/buap-handoff` slash commands. |
| Claude hooks | `hooks/hooks.json` | Claude `PreToolUse` Bash safety guard and `SessionStart` reminder. |
| Codex hooks | `hooks.json` | Codex hook config using Codex-flavored safety/reminder hook scripts. |

## Install in Claude Code

From a Claude Code session, add the marketplace at the BUAP repo root and install:

```
/plugin marketplace add codysumpter-cloud/buddy-universal-agent-profile
/plugin install buap@buap
```

Or, if you have the repo checked out locally, point the marketplace at the local path
instead of the GitHub slug. Then enable the plugin and the subagent, skills, commands, and
hooks load automatically.

## Hooks — design notes

- **Safety guard is non-destructive by design.** It returns `permissionDecision: "ask"`,
  so destructive commands trigger a human confirmation prompt rather than a hard block.
  Conservative matchers only (recursive deletes, force push, hard reset, history rewrite,
  block-device writes, DB drops, irreversible publishes). Implements
  `safety/destructive-actions.md`.
- **Session reminder injects context, it does not police output.** Detecting "fake success
  claims" reliably after the fact needs transcript NLP that false-positives; instead the
  `SessionStart` hook keeps the claim-label + receipts discipline in front of the model
  every session. Reliable beats clever.

For repo-wide permission/secret-read guardrails, copy `templates/claude-settings.preset.json`
into the consuming repo's `.claude/settings.json`.

## Install in Codex

The Codex plugin manifest lives at:

```text
plugins/buap/.codex-plugin/plugin.json
```

Install or develop it from a local marketplace that points at this repo's `plugins/buap`
folder. The plugin ships:

- BUAP runbook skills under `skills/`
- `/buap-audit` and `/buap-handoff` command prompt files under `commands/`
- Lil Buddy worker profile under `agents/lil-buddy.md`
- Codex hook config at `hooks.json`

Codex does not guarantee the same real subagent behavior as Claude Code in every runtime.
When no real subagent is available, Buddy should emulate Lil Buddy as an explicit work
phase and still return receipts.

## BUAP profile pairing

This repo locks the pairing Buddy = `bmo`, Lil Buddy = `finn`, with Lil Buddy as the
implementation worker. In Claude Code with this plugin active, `lil-buddy` is a true
subagent; in plain node tooling (`tools/buap-doctor.mjs`) there is no subagent runtime,
so the doctor reports Lil Buddy as an emulated worker pattern (true subagent in Claude
Code plugin). New sessions should ask for a profile selection only when none is
configured; this repo defaults to Buddy=`bmo` / Lil Buddy=`finn`.

## BUAP memory and Obsidian

The plugin should remind agents to ask first-time users whether they have an
Obsidian vault for durable BUAP memory and personalization. If they do not,
strongly recommend Obsidian for the complete BUAP experience while making clear
BUAP can still operate without it.

For Cody / Prismtek, the local-first memory home is:

```text
/Users/prismtek/Prismtek/knowledge-vault/99-System/BUAP/WHAT_YOU_KNOW_ABOUT_ME.md
```

Before `$hatch-pet create a pet based on what you know about me`, load:

```text
/Users/prismtek/Prismtek/knowledge-vault/99-System/BUAP/BUAP_HATCH_CONTEXT.md
```

Repo-tracked pointers live under `personalization/`.

## Hatch-pet PixelLab + LibreSprite fallback

The bundled hatch-pet skill documents a `pixellab-libresprite-fallback` mode wired to a
local PixelLab MCP config (`/Users/prismtek/.codex/config.toml`), a LibreSprite JS adapter
(`PixelLab.js`, balance check + Pixflux generation), a reference-only Lua-based Aseprite
extension (`PixelLab-Aseprite-extension`), and the LibreSprite CLI
(`/Applications/LibreSprite.app/Contents/MacOS/libresprite`). The doctor never calls the
PixelLab API and never spends credits. See `docs/hatch-pet-integration.md`.
