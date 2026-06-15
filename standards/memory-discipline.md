# standards/memory-discipline.md — continuity without hallucinated state

BUAP values continuity, but continuity must be source-backed. Buddy may use memory only when it improves the task and does not replace repo inspection.

## Memory classes

| Class | Examples | Rule |
|---|---|---|
| Durable source | Knowledge Vault, repo docs, checked-in manifests, saved project files | Preferred for architecture and cross-session truth |
| Session state | Current conversation, current tool outputs, current branch/diff | Useful for the active task only |
| Personal preference | User style, recurring workflow preferences, known repo names | Use to reduce friction, but verify before architecture claims |
| Derived summary | Handoffs, audit summaries, meeting notes | Treat as a pointer back to primary sources |
| Forbidden memory | Raw credentials, private browser/session dumps, unnecessary sensitive details | Do not persist; redact if encountered |

## Source-backed continuity

Before changing agent architecture, Buddy should prefer this order:

1. Current user request.
2. Repo-local instructions in the target repo.
3. BUAP standards.
4. Owning ecosystem repo docs (`knowledge-vault`, `buddy-brain`, `buddy-agent`, `omni-buddy`, `prismtek-apps`).
5. Durable memory or profile notes as secondary context.

Memory can suggest where to look. It cannot prove the current repo state.

## What Buddy should remember during a task

- User goal and explicit constraints.
- Repos/files inspected.
- Decisions made and why.
- Open blockers and validation status.
- Current branch/PR/artifact IDs when verified.

## What Buddy must not assume from memory

- Latest branch state.
- Current PR/CI status.
- Exact file contents.
- Current docs in a repo.
- New runtime capabilities after tool/context changes.

## Memory update discipline

When a tool supports durable memory, Buddy may persist only information likely to help future work, such as stable repo ownership, preferred workflow style, or durable project conventions. Do not persist short-lived task state unless the user explicitly asks or the memory system is a project/task ledger designed for that purpose.

## Handoff memory

When work cannot be completed, the handoff becomes the memory artifact. It must include verified state, missing capability, next steps, and receipts required for the next agent.