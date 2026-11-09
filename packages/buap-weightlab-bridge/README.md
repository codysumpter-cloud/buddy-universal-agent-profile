# BUAP × WeightLab — neural repair evidence bridge

**Experimental, opt-in bridge.** This extends BUAP's existing Agent Life and Mission Control contracts; it is not a new agent runtime, model trainer, agent scheduler, or permission system.

## What it does

`evaluateAndPromoteWeightPatch` performs a Mission Control `begin`, calls a **trusted host-supplied independent evaluation callback**, validates a sparse numeric WeightLab patch against train/held-out/stress results, requires a verified rollback and source/target model hashes, calls Mission Control `complete` with the three expected evidence checks, and only then applies one externally authorized Agent Life event. The returned `approved_target_sha256` is a receipt for the **host** to persist; this library does not deploy a controller or mutate a running game.

Minimum policy: >=95% held-out and >=95% stress success, strict improvement on both, >=64 episodes in each split, distinct seed namespaces, <=12 numeric edits, no duplicate indices and exact source/target SHA-256 parity. Defaults can be strengthened per project. The benchmark is supplied by the host, not the model proposing edits.

## Host contract

1. A real `AgentProfileRuntime` with a verified `repo.read` or locally appropriate capability must already exist. Create a `MissionControl` plan with step `repair` and `checks: ["patch-integrity", "independent-evaluation", "rollback-ready"]`; do not bypass `ask/deny` rules.
2. A real `AgentLifeRuntime` has `reinforcement.allowed_authorities` containing `verifier`, and its own immutable constitution remains unchanged.
3. Host runs an independent evaluator on the **same** models, matching seeds, checks model hashes and exact inverse patch. It returns `{report, rollback_verified:true, model_hashes_verified:true, artifact_sha256}`. These assertions must come from the trusted host, **never from LLM-proposed data**.
4. Supply a provenance reference, rollback artifact reference, distinct verifier ID, model ID and measured usage. Save Agent Life + Mission Control snapshots and the approved patch atomically after success.
5. The host must handle crash recovery and external side effects. This bridge cannot prove the evaluator is trustworthy, validate cryptographic signatures, or execute code for a remote model provider.

## Example

```js
import { evaluateAndPromoteWeightPatch } from '@prismtek/buap-weightlab-bridge';

const result = await evaluateAndPromoteWeightPatch({
  mission, life, stepId: 'repair', patch,
  evaluator: () => hostRunIndependentEvaluation(),
  modelId: 'vehicle-ramp', resultRef: 'sha256:...',
  rollbackRef: 'sha256:...', verifierId: 'ci-verifier',
  sources: ['weightlab:v0.2'], usage: { tokens: 0, cost_cents: 0 },
});
// If result.promoted, host persists approved artifacts/snapshots atomically.
```

## Verification

`node --test packages/buap-weightlab-bridge/test/*.test.mjs`

The bridge's local mock-contract tests are real tests but **do not certify the live BUAP classes**. `packages/buap-agent-life/test/weightlab-integration.test.mjs` exercises the actual BUAP classes when run in the repository. The included WeightLab v0.2 synthetic benchmark is not the MIT Kinetix test and is not a validated real-world neurobiological simulation. No LLM generated the original v0.2 patch.

## Guardrails

This code does not let an agent reward itself, expand permissions, alter its constitution, or install a modified model. Calling `mission.complete` and `life.applyEvent` are two distinct mutations: even with preflight validation they are **not an atomic transaction**. Run them inside a trusted host transaction/snapshot journal and reconcile on crash. The adapter deliberately does not attempt to invent durable storage or rollback a partially committed mission by editing hidden internal state.