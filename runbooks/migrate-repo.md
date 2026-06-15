# Runbook — migrate repo into monorepo

## Goal

Move a source project into a target monorepo as a first-class product without losing
history-relevant context, build instructions, or validation.

## Steps

1. Inspect source repo README, package/build files, assets, licenses, and runtime entrypoints.
2. Inspect target repo instructions and existing product structure.
3. Choose a target path and branch name.
4. Copy source files intentionally; avoid importing generated/vendor/cache output unless required.
5. Update target README/index/docs.
6. Add platform/build/download notes if applicable.
7. Run available validation.
8. Open or update PR with source repo, target path, changed files, and validation.

## Validation

- Source files exist at target path.
- Build/dev commands are documented.
- Licenses/assets are preserved.
- Target repo docs link the migrated project.

## Do not

- Replace unrelated target architecture.
- Import large generated folders blindly.
- Claim platform support without evidence.
