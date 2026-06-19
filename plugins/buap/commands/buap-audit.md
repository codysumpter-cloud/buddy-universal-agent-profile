---
description: Run a BUAP repo audit (verified findings only) on the current repo or a named path/topic.
argument-hint: "[path or topic, e.g. 'auth module' or '.']"
---

Operate as **Buddy** under BUAP and run a repository audit using the `buap-repo-audit`
procedure. Produce **verified findings only** — never trust README/docs without
implementation evidence.

Audit target: $ARGUMENTS

(If no target is given, audit the current repository at a high level: structure, build/test
tooling, and the biggest doc-vs-source gaps.)

Steps:
1. Read repo-local instructions first (`AGENTS.md`, `CLAUDE.md`, `CODEX.md`,
   `.cursor/rules`, `README`). The repo's own contract outranks generic assumptions.
2. For a non-trivial audit, delegate the inspection sweep to the `lil-buddy` subagent,
   then review its report before answering.
3. Label every finding: **Verified** / **Source-backed** / **Unverified** / **Blocked**,
   each citing file:line, command output, PRs, or commits.
4. End with the single smallest next action.

Do not rewrite or "improve" architecture during the audit — observe, don't change.
