# BUAP Claude Code plugin

This is the Buddy Universal Agent Profile packaged as a native Claude Code plugin. It turns
the BUAP prose contract into harness primitives so the Buddy -> Lil' Buddy -> review loop is
**structural**, not just something the model is asked to remember.

## What it ships

| Component | Path | What it does |
|---|---|---|
| `lil-buddy` subagent | `agents/lil-buddy.md` | A real worker subagent carrying the `LIL_BUDDY_PROFILE.md` contract. Buddy delegates implementation/research to it and reviews its report. |
| Skills | `skills/buap-*/SKILL.md` | The BUAP runbooks as model-invoked skills: `buap-repo-audit`, `buap-fix-pr-checks`, `buap-migrate-repo`. |
| Commands | `commands/buap-*.md` | `/buap-audit` and `/buap-handoff` slash commands. |
| Hooks | `hooks/hooks.json` | `PreToolUse` Bash safety guard (destructive ops -> ask for approval) and a `SessionStart` reminder that re-injects the BUAP claim-label/receipts contract. |

## Install

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
