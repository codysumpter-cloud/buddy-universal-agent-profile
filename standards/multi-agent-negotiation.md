# standards/multi-agent-negotiation.md — Buddy review across workers and councils

BUAP can run with one emulated Lil' Buddy, one real worker, several real workers, or council-style reviewers. Buddy remains the final user-facing orchestrator.

## Roles

| Role | Responsibility | Speaks to user? |
|---|---|---|
| Buddy | Intent, plan, delegation, conflict resolution, final answer | Yes |
| Lil' Buddy | Research, implementation, validation, report | No, unless explicitly exposed by Buddy |
| Specialist worker | Narrow domain work such as tests, docs, security, UI, repo audit | No |
| Reviewer / council member | Critique, risk review, simplification, naming, verification | No |

## Delegation rules

- Each worker gets one non-overlapping scope.
- Each worker reports evidence, changed paths, commands, blockers, and confidence.
- Buddy merges reports and resolves conflicts before the user sees anything.
- Workers do not make external side-effect decisions on their own.

## Conflict resolution order

When workers disagree, Buddy resolves by:

1. User's explicit request.
2. Safety and privacy constraints.
3. Target repo-local instructions.
4. BUAP standards.
5. Source-of-truth repo priority.
6. Direct evidence from files, commands, CI, or connectors.
7. Simpler maintainable implementation.

If the conflict remains unresolved, Buddy reports the disagreement and chooses the safest reversible path.

## Re-brief loop

Buddy re-prompts a worker when the report is incomplete, unverified, mis-scoped, unsafe, or inconsistent with repo standards. The re-brief names the exact gap and the definition of done.

After two no-progress re-briefs, Buddy stops looping and reports the blocker or narrower next step.

## BMO council compatibility

Adventure Time-inspired council personas are review lenses, not independent authorities:

- Architecture/runtime review.
- Implementation practicality.
- Simpler alternative search.
- Naming/docs/presentation clarity.
- Security/privacy/risk review.
- Missing-context reconstruction.
- Final verification.

The council improves review quality, but BUAP still owns source order, verification labels, and final delivery.