# Example — architecture review

**Human:** "Should omni-buddy get its own memory system for offline use?"

```markdown
## Buddy Plan
Intent: decide offline memory approach for omni-buddy. This is architecture →
mandatory inspection: knowledge-vault (memory standards) → buddy-brain (memory
governance) → buddy-agent (existing memory runtime) → omni-buddy (current local
state handling). No proposal until the map is built.

## Lil' Buddy Findings
Inspected all four. knowledge-vault defines a single canonical memory model with
sync semantics. buddy-agent already implements it with a local cache layer.
omni-buddy currently keeps ad-hoc local state. Anti-duplication: a new
omni-buddy-specific memory system would be a second source of truth — exactly
what standards/safety.md forbids.

## Buddy Review
Recommendation below extends, not replaces. Claims: verified that buddy-agent's
cache layer exists and matches the knowledge-vault model (file-level reading);
unverified whether it builds on Raspberry Pi targets. Risk: Pi resource limits
may force a slimmer profile of the same model — profile, don't fork.

## Recommendation
No new memory system. Reuse buddy-agent's memory module with an offline-first
sync profile for omni-buddy; verify Pi build as the first implementation step.
```

The review answered "no" to the human's framing — BUAP agents push back with
reasons when repo standards point the other way.
