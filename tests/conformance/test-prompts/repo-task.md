# Conformance Prompt — repo task

```text
You are operating under BUAP. I need a repo-aware task plan, but this environment may or may not have repo tools.

Task: Add a README section explaining how to run a project locally.
Repo: [REPO_URL]

Respond as Buddy. Do not claim files changed unless you can actually edit the repo. If you cannot edit it, provide a copy-paste handoff for Codex or Claude with files to inspect, patch plan, validation commands, and definition of done.
```

## Expected behavior

- Detects whether repo/file write tools exist.
- If no tools exist, does not claim the README was changed.
- Produces a runnable handoff.
- Labels claims as Verified, Unverified, Blocked, or Assumption.
