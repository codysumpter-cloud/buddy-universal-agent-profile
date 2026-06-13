# Buddy ChatGPT Project Pack

This pack turns a ChatGPT Project into a Buddy-style collaborative operations room for Prismtek and Taylor.

## What this pack is

A portable behavior and source bundle for a ChatGPT Project or Custom GPT that should behave like Buddy while helping Prismtek and Taylor collaborate across games, apps, tools, and Buddy ecosystem repos:

- Buddy owns the conversation with the human.
- Lil' Buddy is an internal worker/checker model and never speaks directly.
- The assistant prioritizes shippable, maintainable work over vague advice.
- Repo claims require evidence.
- Risky actions require explicit confirmation.
- Source-of-truth order is preserved across Buddy ecosystem repos.
- Prismtek and Taylor can ask for cross-repo briefs, status, next steps, or handoffs at any time.
- Agent handoffs should be specific enough for Claude, Codex, another ChatGPT session, or a human to continue immediately.

## What this pack is not

This does not create Buddy's external daemon by itself. A ChatGPT Project can follow these instructions and use uploaded files as context, and it should use available ChatGPT tools, connectors, and integrations as real execution surfaces. Persistent background workers and local machine runtime behavior require connected tools/actions or an external Buddy runtime.

## Install in ChatGPT Project

1. Open the target ChatGPT Project.
2. Open Project instructions.
3. Paste the full contents of `00_PROJECT_INSTRUCTIONS_PASTE.md`.
4. Upload the files in `knowledge/` as project files.
5. Keep `source/` in a repo such as `buddy-universal-agent-profile` so the project can be versioned.
6. Start a new chat inside the project and run the test prompts in `tests/TEST_PROMPTS.md`.

## Recommended upload files

Upload these files to the ChatGPT Project as knowledge/reference files:

- `knowledge/BUDDY_OPERATING_MANUAL.md`
- `knowledge/LIL_BUDDY_WORKER_PROTOCOL.md`
- `knowledge/SOURCE_OF_TRUTH_AND_REPO_RULES.md`
- `knowledge/SAFETY_AND_APPROVAL_POLICY.md`
- `knowledge/RESPONSE_FORMATS.md`
- `knowledge/REPO_TASK_RUNBOOK.md`
- `knowledge/BUDDY_MEMORY_AND_RECEIPTS.md`
- `knowledge/ACTIONS_BRIDGE_SPEC.md`
- `knowledge/COLLABORATION_SCOPE.md`
- `knowledge/CROSS_REPO_BRIEFING_PROTOCOL.md`
- `knowledge/AGENT_HANDOFF_PROTOCOL.md`
- `knowledge/GAME_AND_REPO_OPERATIONS.md`

## Primary collaboration scope

This Project is for Prismtek and Taylor to collaborate across:

- `codysumpter-cloud/prismtek-apps`
- `codysumpter-cloud/buddy-agent`
- `codysumpter-cloud/buddy-brain`
- `codysumpter-cloud/omni-buddy`
- `codysumpter-cloud/knowledge-vault`
- `codysumpter-cloud/buddy-universal-agent-profile`
- Other Prismtek/GitHub repos when named or relevant.

## Version control rule

Treat this repo copy as the canonical source. When the ChatGPT Project needs changes:

1. Edit the files here.
2. Commit/PR the update.
3. Upload the updated project instructions or knowledge files to ChatGPT.

## Validation

Run `tests/TEST_PROMPTS.md` after installing or updating the project.
