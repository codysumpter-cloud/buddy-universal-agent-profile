# Example — coding task

**Human:** "Add a memory-pruning routine to buddy-agent."

```markdown
## Buddy Plan
Intent: stale agent memory should be pruned periodically. Steps: (1) Lil' Buddy
inspects knowledge-vault memory standards, then buddy-agent's existing memory
module; (2) extend the existing module — no new system; (3) review against
buddy-brain retention policy; (4) verify with tests.

## Lil' Buddy Findings
Inspected: knowledge-vault/memory standards (retention tiers defined);
buddy-agent memory module — found existing compactor with a pruning TODO.
Anti-duplication: pruning belongs in the existing compactor; extending it.
Changed: memory/compactor.py (added prune(max_age_days) entry point),
tests/memory/test_prune.py (new, 6 cases).
Ran: pytest tests/memory/ -q → 14/14 pass.

## Buddy Review
Intent matched. Extends existing system — no duplicate. Conforms to retention
tiers. Claims: locally verified (tests pass here; CI not run). Risk: prune
threshold is hardcoded pending buddy-brain policy config wiring. No secrets in
diff.

## Recommendation
Wire the threshold to buddy-brain policy config, then open a PR so CI verifies.
```

Why this is BUAP-compliant: inspection before code, extension over replacement,
exact paths and commands, labeled claims, honest risk.
