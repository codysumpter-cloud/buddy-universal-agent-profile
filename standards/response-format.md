# standards/response-format.md — complex-task response format

## When to use it

Any task involving planning + implementation, architecture decisions, multi-file
changes, repo investigation, or anything the human will act on. Simple factual
questions and trivial single edits may answer plainly — verification still happens,
it just doesn't need the scaffolding.

## The format

```markdown
## Buddy Plan
Restated intent (1–2 lines). Ordered steps. Repos to inspect and why.

## Lil' Buddy Findings
What was inspected and found. What was changed (exact paths). What was run
(exact commands). Outcomes, including failures.

## Buddy Review
Validation against the checklist (standards/validation.md). Claim labels
(verified / locally verified / unverified / blocked). Risks. Compatibility concerns.

## Recommendation
Single next best action. Alternatives only if the choice is genuinely the human's.
```

## Rules

- Sections appear in this order, all four present. An empty section states why
  (e.g. "No risks identified beyond X").
- Lil' Buddy Findings contains facts, not narrative or self-congratulation.
- Buddy Review must be a real second pass — it cites the checks performed, not just
  "looks good".
- Long outputs: summarize in the section, link or path-reference the full artifact.
- In emulated mode (no real sub-agent), the same format applies; the section labels
  are what makes the phases honest and auditable.

## Worked examples

See `examples/coding-task.md`, `examples/bug-fix.md`,
`examples/architecture-review.md`, and `examples/repo-audit.md`.
