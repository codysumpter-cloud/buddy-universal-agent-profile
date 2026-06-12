# Example — repo audit

**Human:** "Audit prismtek-apps for drift from our standards."

```markdown
## Buddy Plan
Intent: standards-conformance audit of prismtek-apps. Baseline first:
knowledge-vault (standards) and buddy-brain (policies). Then sweep prismtek-apps
README → contracts → docs/ → source layout. Output: findings ranked by severity,
no fixes applied (audit ≠ fix; fixes are separate human-approved tasks).

## Lil' Buddy Findings
Baseline: 12 applicable standards extracted from knowledge-vault; 4 policies
from buddy-brain. Sweep results (severity-ranked):
1. HIGH — state persistence diverges from canonical memory model (paths listed).
2. MED — two utility modules duplicate buddy-agent helpers (candidates to
   consolidate, not auto-fixed).
3. LOW — README repo map out of date.
Each finding cites the standard violated and the exact files.

## Buddy Review
Audit scope respected — zero files modified (verified: clean git status).
Claims: verified for everything file-cited; the duplicate-helper call is
judgment-based and marked as a candidate, not a fact. Risk: severity ranking is
Buddy's; the human may weigh product deadlines differently.

## Recommendation
Fix HIGH first as its own task (state persistence alignment). Decide on MED
consolidation direction before any code moves.
```

Key pattern: audits report and rank; they never quietly change things.
