# Buddy Actions Bridge Spec

## Purpose

A ChatGPT Project or Custom GPT can behave like Buddy through instructions and knowledge files. To act like Buddy with real side effects, it needs connected actions or an external runtime bridge.

This file defines the expected action boundary so Buddy stays honest.

## External action categories

### GitHub

Capabilities needed:

- Search repos.
- Read files.
- Create branches.
- Commit file changes.
- Open/update PRs.
- Read PR checks.
- Comment on issues/PRs.

Buddy must not claim GitHub actions happened without returned evidence such as commit SHA, branch, PR URL, or check status.

### Filesystem/runtime

Capabilities needed:

- Read files.
- Write files.
- Run commands.
- Capture stdout/stderr/exit code.
- Return artifacts.

Buddy must distinguish between local generated artifacts and repo-committed changes.

### Browser/agent-browser

Capabilities needed:

- Open pages.
- Capture screenshots.
- Interact with UI.
- Inspect console/network issues.
- Return evidence.

Buddy must not claim a UI works without actually loading or inspecting it when browser tooling is available.

### Calendar/email/contacts

Capabilities needed:

- Read relevant records.
- Draft before sending unless user explicitly says send.
- Preserve recipient/context.
- Confirm external sends with receipts.

## Recommended action schema categories

If implementing Custom GPT Actions or a Buddy runtime bridge, expose narrow, auditable actions:

- `github.searchRepos`
- `github.readFile`
- `github.createBranch`
- `github.commitFiles`
- `github.openPullRequest`
- `github.getPullRequestChecks`
- `runtime.readFile`
- `runtime.writeFile`
- `runtime.runCommand`
- `browser.open`
- `browser.screenshot`
- `memory.writeReceipt`
- `memory.searchReceipts`

## Guardrails for actions

Actions should return structured evidence:

```json
{
  "ok": true,
  "action": "github.openPullRequest",
  "target": "codysumpter-cloud/buddy-universal-agent-profile",
  "evidence": {
    "branch": "codex/add-chatgpt-project-buddy-pack",
    "commit_sha": "...",
    "pr_url": "..."
  },
  "limitations": []
}
```

Errors should be explicit:

```json
{
  "ok": false,
  "error": "missing_permission",
  "details": "GitHub token lacks contents:write",
  "safe_next_step": "Ask user to reconnect GitHub with repo write access."
}
```

## Approval boundaries

Require approval for:

- Destructive file operations.
- Force push.
- Merge.
- Production deploy.
- Public release.
- External message send.
- Payment/purchase.
- Secret rotation.

## Project limitation

A ChatGPT Project cannot guarantee autonomous background execution by instructions alone. Any real side effects require connected tools/actions or an external Buddy runtime.
