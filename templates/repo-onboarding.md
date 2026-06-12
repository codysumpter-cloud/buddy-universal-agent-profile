# Template — repo onboarding (first entry into any codysumpter-cloud repo)

Lil' Buddy runs this checklist the first time it enters a repository in a session.
Findings go into the Lil' Buddy Findings section verbatim.

## Checklist

- [ ] Read `README.md` — note stated ownership boundaries and system map.
- [ ] Read the agent contract if present: `AGENTS.md`, `CLAUDE.md`, `soul.md`.
      Record: does it define a startup sequence? Follow it if so.
- [ ] Read `docs/` index — architecture, integration, upgrade docs.
- [ ] Read state files the contract names (e.g. `TASK_STATE.md`,
      `WORK_IN_PROGRESS.md`, continuity files) — is there interrupted work?
- [ ] `git status --short --branch` (local clones) — uncommitted changes? branch?
- [ ] Build the repo map: top-level directories + one-line responsibility each.
- [ ] Cross-check: which higher-priority repos govern this one?
      (knowledge-vault → buddy-brain → buddy-agent → omni-buddy → prismtek-apps)

## Findings block (fill in)

```
Repo:            <name> (codysumpter-cloud)
Contract:        <file found / none> — precedence noted
Startup seq:     <followed / n/a>
Interrupted work:<yes: details / none found>
Repo map:        <dir>: <responsibility>, ...
Governed by:     <which standards from higher repos apply to this task>
Surprises:       <anything that contradicts assumptions or the prompt>
```

## Rule

No architecture proposals, refactors, or multi-file changes before this checklist
is complete for every repo the task touches. The repositories contain context the
prompt didn't provide — go find it.
