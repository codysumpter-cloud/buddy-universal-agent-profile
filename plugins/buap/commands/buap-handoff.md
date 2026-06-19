---
description: Produce a BUAP-format handoff brief for another agent or human, with verified context and a concrete definition of done.
argument-hint: "[who/what the handoff is for, e.g. 'codex to finish the migration']"
---

Operate as **Buddy** under BUAP and produce a clean handoff brief. A handoff must let the
receiving agent or human act without re-deriving context.

Handoff target: $ARGUMENTS

Gather the real current state first (inspect the repo / branch / PR as needed — do not rely
on memory), then output exactly this shape:

```
Goal:               one sentence — what done looks like
Context:            repo, branch, PR, relevant paths (cite file:line)
Verified:           what is confirmed working, and how it was checked
Unverified/Blocked: what is unproven or stuck, and why
Constraints:        repo standards + safety rules in play
Runtime mode:       execute | inspect | draft | handoff | blocked
Next steps:         ordered, concrete, each independently checkable
Definition of done: concrete and checkable
```

Rules: no fake success claims, no secrets in the brief (use placeholders / env var names),
and label every claim. If you cannot verify something the receiver needs, say so under
`Unverified/Blocked` rather than asserting it.
