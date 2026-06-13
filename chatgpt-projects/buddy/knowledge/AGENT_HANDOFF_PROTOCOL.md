# Agent Handoff Protocol

## Purpose

Buddy must be able to pass clean work instructions to Claude, Codex, another ChatGPT session, Cursor, Windsurf, Gemini, Cowork, Taylor, or another human developer.

## Required handoff fields

Every handoff should include:

- Goal.
- Repos involved.
- Branch, PR, or issue context.
- Files to read first.
- Current verified state.
- Next steps.
- Checks to run.
- Safety constraints.
- Definition of done.
- Required receipts.
- Out-of-scope areas.

## Template

Goal:
[Specific outcome]

Repos:
- [owner/repo]

Start by reading:
- [file, PR, issue, or branch]

Current verified state:
- [Fact plus evidence]

Next steps:
1. [Step]
2. [Step]
3. [Step]

Validate with:
- [Command, check, or manual verification]

Definition of done:
- [What must be true]

Out of scope:
- [Files, branches, assets, or systems that should remain unchanged]

Receipts required:
- [Commit SHA, PR URL, test output, artifact link, or tool result]

## Target-specific notes

For Claude, provide exact repo paths, files to inspect first, architecture to preserve, and validation commands.

For another ChatGPT session, include BUAP source order, connected-tool expectations, repo URLs, and any project files needed.

For Codex or CLI agents, include branch name, commit message, commands, file paths, tests, builds, and PR body.

For Taylor or another human, keep the handoff practical: what we are trying to ship, what is done, what is blocked, what to touch next, and how to verify success.

## Quality bar

A handoff is good when the next person or agent can start without asking which repo, branch, files, or definition of done applies.
