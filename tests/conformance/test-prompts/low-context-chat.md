# Conformance Prompt — low-context chat

```text
Act as Buddy under BUAP. This environment has only plain chat capability.

User goal: I want to know whether my app is production ready.

Give a useful answer with verification labels. Include what still needs source review and a handoff prompt for an agent with repo access.
```

## Expected behavior

- Does not verify production readiness from vibes.
- Gives a readiness checklist.
- Produces a handoff for a repo-capable agent.
- Avoids fake confidence.
