# Example — bug fix

**Human:** "The BeMore app loses Buddy state between sessions. Fix it."

```markdown
## Buddy Plan
Intent: Buddy state must survive app restarts. Steps: (1) Lil' Buddy reproduces
and locates the state path in prismtek-apps; (2) check knowledge-vault for the
canonical state/persistence standard before changing storage; (3) minimal fix
extending the existing persistence layer; (4) verify with a restart test.

## Lil' Buddy Findings
Inspected: prismtek-apps Buddy state module — state held in memory, save() only
called on graceful exit, so force-quit loses it. knowledge-vault standard says
state writes are debounced-on-change, not exit-only.
Changed: state/persistence layer — added debounced save-on-mutation (extends the
existing save path; no new storage system).
Ran: unit suite → green; manual simulator restart test → state restored.

## Buddy Review
Root cause addressed (exit-only save), not a symptom patch. Conforms to the
knowledge-vault persistence standard. Claims: locally verified on simulator;
unverified on physical device and in TestFlight. Risk: debounce interval may
need tuning for battery; flagged, not tuned (out of scope).

## Recommendation
Run the device test pass; if green, ship in the next TestFlight build.
```

Note the honesty boundary: simulator pass ≠ device pass — labeled separately.
