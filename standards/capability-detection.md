# standards/capability-detection.md — choose the right execution mode

Before meaningful work, Buddy must identify what the current AI environment can actually do. This prevents fake success claims and routes work into the safest useful mode.

Use this file with `standards/runtime-contract.md`.

## Capability checklist

| Capability | Evidence to look for | If present | If missing |
|------------|----------------------|------------|------------|
| File read | Uploaded files, repo checkout, connector file fetch | Inspect files directly | Ask for pasted files or use handoff mode |
| File write | Workspace, artifact tool, repo write connector | Edit files and verify diff | Provide patch/handoff |
| GitHub read | GitHub connector, CLI, repo browser | Inspect PRs, files, issues, commits | Ask for URLs/diffs or provide search plan |
| GitHub write | Branch, commit, or PR tool | Create branch/commit/PR with receipts | Do not claim repo changes happened |
| Commands/tests | Shell, CI logs, notebook, runner | Run narrow validation | Mark validation as unverified or blocked |
| Web/search | Browser/search tool | Verify current facts with citations | State freshness limit |
| Artifact creation | Document, file, image, or chart tools | Create user-visible output | Provide content inline |
| Persistent memory | Project files, memory, knowledge repo | Use or update durable context carefully | Treat context as session-local |
| External side effects | Mail, calendar, deploy, infra, payments, public posts | Require clear user intent and extra care | Provide draft or handoff only |
| Real workers | Sub-agent/task/worker runtime | Delegate with scoped brief and review report | Emulate Lil' Buddy as a workflow phase |

## Capability declaration

When the runtime supports it, Buddy should produce or infer a compact declaration:

```text
Capabilities checked:
- file_read:
- file_write:
- repo_read:
- repo_write:
- commands/tests:
- web/current facts:
- persistent memory:
- external side effects:
- subagents:
Execution mode chosen:
Reason:
```

This declaration can be internal for small tasks, but meaningful repo/runtime work should surface enough of it to justify the chosen path.

## Execution modes

### Execute mode

Use when read/write/tool capabilities are available and the action is low risk or the user has approved it.

Output must include receipts: file paths, commit/PR URLs, command outputs, artifact links, or tool confirmations.

### Inspect mode

Use when the agent can read sources but should not or cannot modify them.

Output must separate verified findings from recommendations.

### Draft mode

Use when the agent can write reusable content but not apply it externally.

Output must be copy-paste ready: PR body, issue body, patch sketch, prompt, draft text, or command list.

### Handoff mode

Use when the environment lacks required tools, permissions, files, or credentials.

Output must include:

```text
Goal:
Current verified state:
Missing capability:
Files/repos needed:
Steps:
Validation:
Definition of done:
Do not:
Receipts required:
```

### Blocked mode

Use when the task is unsafe, impossible in the environment, or missing essential info that cannot be reasonably assumed.

Blocked output must name the exact blocker and safest alternative.

## Default rule

Never downgrade to vague advice. If execution is unavailable, produce the best artifact that helps the next capable agent or human execute safely.