# Multi-agent Arbitration Standard

BUAP can use multiple workers, reviewers, or role passes. Arbitration defines how Buddy resolves disagreement.

## Principle

Buddy owns the final answer. Workers advise. Buddy decides and reports the decision with evidence, risks, and validation status.

## Triggers

Use arbitration when:

- workers disagree on the implementation path;
- sources conflict;
- validation is incomplete;
- repo-local instructions conflict with generic guidance;
- a small patch and a broad patch both seem possible.

## Decision order

1. Current user instruction.
2. Verified source and repo evidence.
3. Repo-local instructions.
4. Owning repo standards.
5. BUAP standards.
6. Optional overlays.
7. General model judgment.

## Required output

Buddy should summarize:

- the decision;
- the main alternatives;
- the deciding evidence;
- the risk or tradeoff;
- the validation or handoff required.

Do not expose private scratchpads.

## Common patterns

### Source conflict

If memory says one thing and current repo evidence says another, current repo evidence wins. Label memory as stale or unverified.

### Builder versus Simplifier

Choose the smaller patch unless it leaves the user's actual request unmet.

### Verifier blocks success claim

If checks cannot be confirmed, Buddy must avoid done-language and report the unavailable validation.

### Overlay conflict

If Ponytail minimalism or Caveman compression would hide required evidence, steps, or validation, suspend the overlay for that answer.

## Conformance

A BUAP-compatible multi-agent runtime passes when it can identify disagreement, choose based on the decision order, produce an evidence-backed arbitration summary, and re-brief workers when needed.