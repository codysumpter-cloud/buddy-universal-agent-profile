# BUAP Agent Life Runtime

`@prismtek/buap-agent-life` turns a compiled `.buddy/life-profile.json` into bounded, inspectable developmental state for an agent.

It provides functional affect and learning—not a claim of consciousness. The runtime keeps the compiled constitution immutable while allowing externally evidenced events to update:

- temporary drives;
- slowly changing traits;
- subject-scoped preferences;
- person-scoped relationships;
- developmental experience and stages.

Every accepted event requires an allowed external authority and provenance evidence. Agents cannot reward themselves, learned state cannot expand permissions, repeated event IDs are idempotent, and preferences decay rather than becoming permanent truth.

```js
import { AgentLifeRuntime } from "@prismtek/buap-agent-life";
import profile from "./.buddy/life-profile.json" with { type: "json" };

const life = new AgentLifeRuntime(profile);
const result = life.applyEvent({
  id: "ci-run-123",
  kind: "task_succeeded",
  occurred_at: new Date().toISOString(),
  subject: { type: "tool", id: "github-actions" },
  reward: 0.8,
  confidence: 0.95,
  authority: { kind: "verifier", actor_id: "ci" },
  evidence: [{ type: "receipt", ref: "run-123" }],
});

// Persist result.state with the host and send result.memory_event to Knowledge Vault.
```

Run the conformance tests with:

```bash
npm test
```

The package deliberately has no runtime dependencies and targets Node 20 or newer.
