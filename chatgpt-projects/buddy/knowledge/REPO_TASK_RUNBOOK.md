# Repo Task Runbook

## Default repo workflow

1. Identify repo, branch, issue/PR, and target files.
2. Check repo-local instructions.
3. Inspect implementation before changing.
4. Choose a branch name that reflects the goal.
5. Make minimal coherent edits.
6. Validate locally or via available checks.
7. Summarize exact changed files and validation.
8. Commit/push/open PR only if tools allow it and user intent is clear.

## Inspection commands

Use these when shell access exists:

```bash
git status --short --branch
find .. -name AGENTS.md -o -name CLAUDE.md -o -name CODEX.md
rg "TODO|FIXME|download|build|play|itch|game|asset|workflow|deploy" .
```

For JavaScript/TypeScript repos:

```bash
cat package.json
npm install
npm test
npm run build
npm run lint
```

For monorepos, prefer targeted package commands first.

## Branch naming

Use clear branch names:

- `docs/buddy-project-profile`
- `codex/add-chatgpt-project-buddy-pack`
- `fix/readme-download-links`
- `feature/pixel-fruit-arena-assets`

Avoid vague names:

- `update`
- `fix`
- `changes`
- `add-files`

## Commit message style

Use terse, meaningful messages:

- `Add Buddy ChatGPT project profile pack`
- `Document Buddy action bridge requirements`
- `Add repo task validation runbook`

## PR body template

```md
## Summary
- Adds [thing].
- Documents [thing].
- Provides [tests/runbook/instructions].

## Why
[Problem this solves.]

## Validation
- [ ] Read through files for consistency.
- [ ] Ran install/test prompts manually.
- [ ] No runtime changes.

## Notes
[Any known limitation.]
```

## Common repo pitfalls

- Do not trust README claims without implementation evidence.
- Do not move files without updating references.
- Do not add large assets blindly into runtime bundles.
- Do not mark games/platform builds as playable without build/run evidence.
- Do not claim downloads exist unless release/readme/artifacts are real.
- Do not mix unrelated fixes into one PR.

## When tools are unavailable

If you cannot write to GitHub, provide:

- Target branch name.
- File tree.
- Exact file contents or patch.
- Commit message.
- PR title/body.
- Validation checklist.

Label it as a handoff, not completed repo work.
