import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentLifeRuntime } from '../src/index.mjs';
import { AgentProfileRuntime } from '../../buap-agent-profile/src/index.mjs';
import { MissionControl } from '../../buap-mission-control/src/index.mjs';
import { evaluateAndPromoteWeightPatch } from '../../buap-weightlab-bridge/src/index.mjs';

const profile = {
  schema: 'prismtek-agent-profile-v1', id: 'atlas', display_name: 'Atlas',
  relationship_role: 'buddy', kind: 'primary', mission: 'Build and verify',
  goals: ['Ship'], responsibilities: ['Plan', 'Review'], identity: { name_source: 'self' },
  memory: { namespace: 'agents/atlas', shared_context: [], write_scopes: [], proactive_learning: false },
  execution: { preferred_targets: ['chat'], background_allowed: false, max_concurrent_tasks: 2 },
  capabilities: { required: [], optional: ['github'], denied: [] },
  autonomy: { proactive_research: false, create_tasks: false, schedule_tasks: false },
  action_rules: [{ match: 'repo.read', behavior: 'allow' }, { match: '*', behavior: 'ask' }],
  channels: ['chat'], schedules: [],
};
const lifeProfile = {
  schema: 'prismtek-agent-life-profile-v1', source_sha256: 'test-neural-integration',
  agent: { id: 'atlas', lineage: [] },
  constitution: { immutable: true, invariants: ['Do not expand capabilities'] },
  affect: { drives: { curiosity: { initial: 0.5, baseline: 0.5, min: 0, max: 1 } }, traits: {} },
  reinforcement: { allowed_authorities: ['verifier'], max_drive_delta_per_event: 0.2, max_trait_delta_per_event: 0.02, max_preference_delta_per_event: 0.2 },
  memory: { require_provenance: true, max_evidence_items: 4, max_dedup_event_ids: 100 },
  relationships: { enabled: false },
  development: { initial_stage: 'apprentice', stages: [] },
};
const source = '1'.repeat(64), target = '2'.repeat(64);
const patch = {
  protocol: 'prismtek-sparse-weight-patch-v1', parameter_count: 226, changed_count: 1,
  source_sha256: source, target_sha256: target,
  edits: [{ tensor: 'w1', index: [0, 1], before: 0, after: 2 }],
};
function scoring(split, seed_namespace, seeds, wins) {
  return { baseline: { split, seed_namespace, seeds, wins: 0, success_rate: 0, model_sha256: source },
    patched: { split, seed_namespace, seeds, wins, success_rate: wins / seeds, model_sha256: target } };
}
const report = { source_sha256: source, target_sha256: target, changed_parameters: 1, separate_seed_namespaces: true,
  scores: { train: scoring('train', 1000, 64, 64), heldout: scoring('heldout', 2000, 256, 256), stress: scoring('stress', 3000, 256, 253) } };
function make() {
  const agent = new AgentProfileRuntime(profile);
  const mission = new MissionControl(agent, {
    id: 'neural-repair', title: 'Evaluate and approve repaired neural controller',
    budget: { max_tokens: 1000, max_cost_cents: 0, max_parallel: 1 },
    steps: [{ id: 'repair', title: 'Verify repair', action: 'repo.read', capabilities: ['github'],
      depends_on: [], checks: ['patch-integrity', 'independent-evaluation', 'rollback-ready'],
      estimated_tokens: 100, estimated_cost_cents: 0 }],
  });
  const life = new AgentLifeRuntime(lifeProfile);
  return { agent, mission, life };
}
const args = ({ mission, life }) => ({ mission, life, stepId: 'repair', patch,
  evaluator: async () => ({ report, rollback_verified: true, model_hashes_verified: true, artifact_sha256: 'a'.repeat(64) }),
  modelId: 'vehicle-ramp', resultRef: 'test:weightlab-run', rollbackRef: 'test:inverse-patch',
  verifierId: 'ci-verifier', occurredAt: '2026-11-09T16:00:00.000Z', sources: ['test:weightlab-v02'],
  usage: { tokens: 0, cost_cents: 0 } });

test('actual BUAP runtimes gate weight repairs and preserve constitution', async () => {
  const state = make(); const before = structuredClone(state.life.constitution);
  state.agent.bindCapability('github', { evidence_ref: 'test:capability-probed' });
  const result = await evaluateAndPromoteWeightPatch(args(state));
  assert.equal(result.promoted, true);
  assert.equal(state.mission.status('repair'), 'completed');
  assert.deepEqual(state.life.constitution, before);
  assert.equal(state.life.snapshot().applied_event_ids.length, 1);
  assert.equal(result.memory_event.authority.kind, 'verifier');
});

test('unconnected capability blocks evaluation and learning', async () => {
  const state = make();
  const result = await evaluateAndPromoteWeightPatch(args(state));
  assert.equal(result.promoted, false);
  assert.equal(result.decision, 'missing_capabilities');
  assert.equal(state.life.snapshot().applied_event_ids.length, 0);
});
