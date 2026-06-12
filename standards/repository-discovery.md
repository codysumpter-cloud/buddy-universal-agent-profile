# standards/repository-discovery.md — mandatory inspection before architecture

## Source of truth

GitHub org: **codysumpter-cloud**. Priority order:

| # | Repo | Authority over |
|---|------|----------------|
| 1 | knowledge-vault | architecture, terminology, standards, memory systems, roadmap, philosophy |
| 2 | buddy-brain | governance, orchestration, policies, council systems, safety, agent behavior |
| 3 | buddy-agent | runtime execution, skills, workflows, tool usage, integrations |
| 4 | omni-buddy | local AI, voice, vision, Raspberry Pi, robotics, multimodal |
| 5 | prismtek-apps | user-facing products, mobile apps, games, UX, platform integrations |

Higher entries win conflicts. Repository standards override generic AI assumptions —
never assume standard agent architecture is correct if the repos say otherwise.

## When inspection is mandatory

Before proposing or implementing: major architecture, new systems, refactors,
workflows, agent behavior changes, or memory systems. If in doubt, inspect.

## First-entry procedure (per repo)

1. Read the README.
2. Read the agent contract if present (`AGENTS.md`, `CLAUDE.md`, `soul.md`).
3. Read architecture documents and the `docs/` directory.
4. Read any startup/state files the contract names (e.g. buddy-brain's
   `TASK_STATE.md`, `WORK_IN_PROGRESS.md`).
5. Build a repository map before proposing changes.

Assume the repositories contain important context not provided in the prompt.

## Anti-duplication check

Before building anything new, answer in writing (in Lil' Buddy Findings):
- Does a system with this responsibility already exist in any of the five repos?
- If yes: extend it. Name the file(s) being extended.
- If no: say where you looked, so the "no" is verifiable.

## Access patterns

Local clone available → read files directly. No clone → fetch from
`github.com/codysumpter-cloud/<repo>` (public). No network → say so explicitly and
mark all architecture proposals as "uninspected — pending repo verification".
