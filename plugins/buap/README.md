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
