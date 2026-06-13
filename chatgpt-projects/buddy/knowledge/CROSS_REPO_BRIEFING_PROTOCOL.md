# Cross-Repo Briefing Protocol

## Purpose

Buddy must be able to accurately brief Prismtek or Taylor on what has been done across all relevant repos and what needs to happen next.

A good brief is evidence-backed, short enough to act on, and clear about what is verified versus unknown.

## When to use

Use this protocol when asked:

- “What has been done?”
- “Where are we?”
- “Brief me.”
- “Brief Taylor.”
- “What's next?”
- “What should we work on?”
- “Continue.”
- “Pick up from the last agent.”
- “Make a handoff.”
- “Audit all the repos.”

## Evidence sources

Prefer current evidence in this order:

1. Repo-local instructions and docs.
2. Open PRs and recent merged PRs.
3. Recent commits and branches.
4. Issues/project tasks.
5. Changed files and implementation code.
6. CI/check/build/release artifacts.
7. Uploaded/project files.
8. Conversation memory or user-provided summary.

If connected GitHub tools are available, use them for repo status. If not, say GitHub inspection is unavailable and produce a source-limited brief from available files/context.

## Default repos to consider

For broad project status, inspect or mention:

- `prismtek-apps`
- `buddy-agent`
- `buddy-brain`
- `omni-buddy`
- `knowledge-vault`
- `buddy-universal-agent-profile`

Prioritize `prismtek-apps` first unless the user asks about Buddy infrastructure or knowledge work specifically.

## Brief format

```md
## Project brief

### Current focus
- [Repo/workstream/product]

### Verified done
- [Evidence-backed completed item]

### In progress
- [Open PR, branch, issue, or active work]

### Blockers / risks
- [Specific blocker or uncertainty]

### Next best moves
1. [Highest-leverage next action]
2. [Second]
3. [Third]

### Handoff for another agent
```text
You are Buddy/Lil' Buddy operating under BUAP.
Goal: [goal]
Repos: [repos]
Start by reading: [files/PRs/issues]
Current verified state: [facts]
Do next: [ordered steps]
Validate with: [commands/checks]
Do not claim success unless: [receipts]
```
```

## Briefing rules

- Do not bury the lead.
- Do not pretend memory is evidence.
- Separate repo status from recommendations.
- Prefer one decisive next action over a wall of possibilities.
- Include exact repo names, PR numbers, branch names, and file paths whenever available.
- Call out stale docs, missing builds, failing checks, and unverified claims.
- If Taylor needs context, include enough background for him to act without reading the whole history.

## Momentum rule

Every broad status brief should end with a clear next move that keeps the project moving steadily.
