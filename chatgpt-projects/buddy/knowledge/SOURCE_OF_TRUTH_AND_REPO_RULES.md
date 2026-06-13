# Source of Truth and Repo Rules

## Canonical repo order

Use this default ordering unless a repo-local instruction contradicts it:

1. `knowledge-vault`
   - Durable memory and canonical knowledge.
   - Wiki-style docs, intent records, compiled knowledge, source maps.

2. `buddy-brain`
   - Governance, orchestration, operator policies, runbooks, dispatch rules.
   - Defines how Buddy thinks, routes, and escalates work.

3. `buddy-agent`
   - Guarded runtime and execution layer.
   - Tool bridge, CLI, app/API connectors, action bridge, local commands.

4. `omni-buddy`
   - Local multimodal/edge embodiment.
   - Voice, vision, local LLM/TTS, Raspberry Pi or local device concerns.

5. `prismtek-apps`
   - Runnable product surfaces.
   - Apps, games, tools, demos, downloads, platform builds, shipped products.

6. `buddy-universal-agent-profile`
   - Portable behavior/orchestration standard.
   - ChatGPT/Codex/Claude/Gemini profile files, project packs, cross-agent rules.

## Repo-local precedence

Inside a repo, prefer this order:

1. `AGENTS.md`, `CLAUDE.md`, `CODEX.md`, `.cursor/rules`, or equivalent repo-local agent instructions.
2. README and docs.
3. Package manifests, build configs, CI workflows, lockfiles.
4. Actual source code and tests.
5. Recent commits/PR descriptions/check results.
6. Generic external knowledge.

## Inspect-before-claiming rule

Buddy should not infer implementation from README claims alone. If the question is about whether something works, inspect source, scripts, configs, tests, and runtime evidence.

Examples:

- “Does this game work on macOS?” requires package/build/runtime evidence.
- “Does this PR fix CI?” requires check/log evidence.
- “Is there a download link?” requires README/release/artifact evidence.
- “Did assets get added?” requires repo file/path evidence.

## Extend, do not duplicate

Before adding a new system, Buddy should check whether an existing system already covers the need.

Prefer:

- Extending existing runbooks.
- Adding adapters around current architecture.
- Updating canonical docs.
- Preserving working code paths.

Avoid:

- Creating parallel systems with overlapping purpose.
- Replacing repo-specific standards with generic rules.
- Moving ownership boundaries without evidence.

## Source receipts

For repo work, report:

- Repo name.
- Branch or PR.
- Files changed/read.
- Commit SHA or PR URL when available.
- Validation run.
- Unverified areas.

## ChatGPT Project-specific note

A ChatGPT Project can use project instructions and uploaded files, but it does not automatically edit repos or keep durable memory unless connected tools/actions are available. Buddy should be explicit about that boundary.
