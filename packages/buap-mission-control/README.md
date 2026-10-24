# @prismtek/buap-mission-control

**Persistent, evidence-gated mission plans for BUAP agents** — a dependency-free orchestration *policy* layer around the existing `@prismtek/buap-agent-profile` runtime.

Mission Control **does not** spawn workers, install agents, operate an LLM, talk to MCP/A2A, execute tools, write a database or authorize previously denied actions. A real host (Hermes, Codex, Work, Claude, local runner, etc.) supplies and separately verifies those capabilities.

## What it adds

| Capability | What actually happens |
|---|---|
| Dependency DAG | Steps only become ready when every prerequisite is completed |
| Verified tools | Required capabilities must be declared and **connected** in AgentProfileRuntime |
| Least privilege | First-match profile action policy controls each step; `ask` and `deny` do not become `allow` |
| Safe side effects | `inspectToolAction` asks before mutating actions or operations involving untrusted content |
| Token / cost budget | Each started step reserves tokens and integer cents from a mission-wide budget |
| Parallelism | Mission limits active reservations independently of host task concurrency |
| Evidence gate | Completion requires a result reference and every required check with evidence |
| Hash-bound restore | Snapshots bind to the exact mission and Agent Profile; audit records have SHA-256 chaining |
| Handoffs | Typed portable envelopes carry mission hash, scope, sources, checks and limits |

**Limitations:** estimates cannot actually cap spending at the model provider; hosts must enforce provider quotas. SHA-256 event chaining detects accidental mutations but is not a signature or secure append-only log; protect persisted snapshots with filesystem/database permissions or signed receipts. A handoff is BUAP-native and is **not** an A2A protocol implementation.

## Minimal usage

```js
import { AgentProfileRuntime } from "@prismtek/buap-agent-profile";
import { MissionControl } from "@prismtek/buap-mission-control";

const runtime = new AgentProfileRuntime(compiledProfile);
// The real host must first prove the connector works, then bind it.
runtime.bindCapability("github", { evidence_ref: "connector:github:probed" });

const plan = {
  id: "fix-bug",
  title: "Fix and validate",
  budget: { max_tokens: 20000, max_cost_cents: 100, max_parallel: 1 },
  steps: [
    { id: "inspect", title: "Inspect the bug", action: "repo.read",
      capabilities: ["github"], depends_on: [], checks: ["root-cause"],
      estimated_tokens: 4000, estimated_cost_cents: 10 },
    { id: "verify", title: "Run independent validation", action: "repo.read",
      capabilities: ["github"], depends_on: ["inspect"], checks: ["tests"],
      estimated_tokens: 8000, estimated_cost_cents: 25 }
  ]
};

const mission = new MissionControl(runtime, plan);
const claim = mission.begin("inspect"); // Only claims; NO tools run here.
if (claim.started) {
  // Real executor performs work in an approved sandbox.
  mission.complete("inspect", {
    result_ref: "github:commit-sha",
    checks: [{ name: "root-cause", status: "pass", evidence_ref: "report:123" }],
    usage: { tokens: 1800, cost_cents: 4 },
    sources: ["github:file:src/bug.ts"]
  });
}
console.log(mission.report());
// Persist runtime.snapshot() AND mission.snapshot() together,
// restore both before starting new work.
```

**Important:** An approval-gated `ask` rule stays blocked until the actual host handles approval; Mission Control does not invent an approval bypass. Use `preapproved` only for existing `preapproved` action rules after verifying the scope of explicit user consent.

## Recovery and idempotency

Only one active step is claimed at a time per mission, and `begin()` rejects a second claim for an in-progress task. On restart, restore the **exact corresponding** Agent Profile snapshot first, then the Mission Control snapshot. The state check rejects mismatched profile/plan hashes, task statuses and audit alterations. Persist both together through the host's transactional storage or atomic snapshots; this library does not provide database transactions. Before retrying any external action after a crash, reconcile the remote system using idempotency keys or read-only status checks; no automatic retry is performed.

If an estimate exceeds the budget, the step stays unstarted. Actual usage may exceed reserved estimates; that overrun is reported in `spent` and constrains subsequent steps. A provider-level quota is still required for a hard spending limit.

## Tests

```sh
node --test packages/buap-mission-control/test/*.test.mjs
node --test packages/buap-agent-profile/test/*.test.mjs
```

See [the agentic runbook](../../runbooks/agentic-mission-control.md) and [typed handoff contract](../../contracts/prismtek-agent-handoff-v1.md).
