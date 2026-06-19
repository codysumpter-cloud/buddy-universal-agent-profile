---
name: buap-repo-audit
description: >-
  Audit a repository and produce verified findings only, never trusting README/doc claims
  without implementation evidence. Use when asked to audit, assess, review the state of,
  or "tell me what actually works in" a repo or codebase, or to compare docs against
  source. Follows the BUAP repo-audit runbook and labels every finding.
---

# BUAP repo audit

Produce **verified findings only**. Do not trust README or doc claims without
implementation evidence. This is the BUAP `runbooks/repo-audit.md` procedure.

## Steps

1. Read repo-local instructions first: `AGENTS.md`, `CLAUDE.md`, `CODEX.md`,
   `.cursor/rules`, `README`. A repo's own contract outranks generic assumptions.
2. Map the repository structure (tree, entrypoints, packages).
3. Identify build / test / package managers actually in use.
4. Inspect the implementation files related to the user's question — read the code, not
   just the docs.
5. Compare docs against source. Flag every place they disagree.
6. Label each finding:
   - **Verified** — checked directly here (cite file:line, command output).
   - **Source-backed** — supported by cited source material, not run.
   - **Unverified** — plausible but not checked.
   - **Blocked** — missing tool, permission, file, or credential.
7. Recommend the single smallest next action.

## Validation

- Every finding cites files, lines, PRs, commits, or command output.
- State explicitly which checks were NOT run.

## Do not

- Claim functionality exists from docs alone.
- Rewrite or "improve" architecture during an audit — observe, don't change.
- Mix assumptions into the verified-findings list.

For non-trivial audits, delegate the inspection sweep to the `lil-buddy` subagent and
review its report before answering.
