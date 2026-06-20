---
name: buap-migrate-repo
description: >-
  Move a source project into a target monorepo as a first-class product without losing
  build instructions, licenses, assets, or validation. Use when asked to migrate, move,
  import, or fold one repo/project into another or into a monorepo. Follows the BUAP
  migrate-repo runbook and preserves history-relevant context.
---

# BUAP migrate repo

Move a source project into a target monorepo as a first-class product without losing
history-relevant context, build instructions, or validation. This is the BUAP
`runbooks/migrate-repo.md` procedure.

## Steps

1. Inspect the source repo: README, package/build files, assets, licenses, runtime
   entrypoints.
2. Inspect the target repo: its instructions and existing product structure.
3. Choose a target path and branch name.
4. Copy source files intentionally. Do not import generated / vendor / cache output
   unless it is genuinely required.
5. Update the target README / index / docs to reference the migrated project.
6. Add platform / build / download notes if applicable.
7. Run available validation in the target.
8. Open or update a PR naming the source repo, target path, changed files, and validation.

## Validation

- Source files exist at the target path.
- Build / dev commands are documented in the target.
- Licenses and assets are preserved.
- Target repo docs link the migrated project.

## Do not

- Replace unrelated target architecture.
- Import large generated folders blindly.
- Claim platform support without evidence.

This is a multi-file, multi-repo change — delegate the copy + wiring to the `lil-buddy`
subagent and review against this checklist before opening the PR.
