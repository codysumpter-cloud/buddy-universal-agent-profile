# Destructive Actions

Destructive actions require explicit user approval and a rollback plan.

## Examples

- Deleting files, branches, databases, issues, artifacts, or accounts.
- Rewriting history.
- Removing production data.
- Replacing large parts of working architecture.
- Publishing irreversible releases.

## Required checklist

1. State the exact action.
2. Explain what could be lost.
3. Confirm backups or rollback path.
4. Ask for explicit approval.
5. Record receipts if performed.

## Safer alternatives

- Open a PR instead of direct changes.
- Archive instead of delete.
- Create a backup branch.
- Mark deprecated before removal.
