# Runbook — repo audit

## Goal

Produce verified findings only. Do not trust README claims without implementation evidence.

## Steps

1. Read repo-local instructions: `AGENTS.md`, `CLAUDE.md`, `CODEX.md`, `.cursor/rules`, README.
2. Map the repository structure.
3. Identify build/test/package managers.
4. Inspect implementation files related to the user's question.
5. Compare docs against source.
6. Label each finding as Verified, Source-backed, Unverified, or Blocked.
7. Recommend the smallest next action.

## Validation

- Cite files, lines, PRs, commits, or command output.
- State checks not run.

## Do not

- Claim functionality exists from docs alone.
- Rewrite architecture during an audit.
- Mix assumptions into verified findings.
