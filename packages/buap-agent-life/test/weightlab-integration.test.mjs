import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentLifeRuntime } from '../src/index.mjs';
import { AgentProfileRuntime } from '../../buap-agent-profile/src/index.mjs';
import { MissionControl } from '../../buap-mission-control/src/index.mjs';
import { evaluateAndPromoteWeightPatch } from '../../buap-weightlab-bridge/src/index.mjs';
import { evaluateLocalWeightLabFiles } from '../../buap-weightlab-bridge/src/local-evaluator.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

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
const fixture = join(dirname(fileURLToPath(import.meta.url)), '../../buap-weightlab-bridge/fixtures/blind-ramp-v2');
const beforePath = join(fixture, 'blind_ramp_before.json');
const afterPath = join(fixture, 'blind_ramp_after.json');
const patchPath = join(fixture, 'blind_ramp_patch.json');
const patch = JSON.parse(readFileSync(patchPath, 'utf8'));
const trustedEvaluator = () => evaluateLocalWeightLabFiles({ beforePath, afterPath, patchPath });
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
  evaluator: trustedEvaluator,
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
  assert.equal(result.gate.heldout_success, 1);
  assert.equal(result.gate.stress_success, 254/256);
  assert.equal(result.approved_target_sha256, patch.target_sha256);
});

test('unconnected capability blocks evaluation and learning', async () => {
  const state = make();
  const result = await evaluateAndPromoteWeightPatch(args(state));
  assert.equal(result.promoted, false);
  assert.equal(result.decision, 'missing_capabilities');
  assert.equal(state.life.snapshot().applied_event_ids.length, 0);
});

test('tampered source model fails and does not reward Agent Life', async () => {
  const state = make();
  state.agent.bindCapability('github', { evidence_ref: 'test:capability-probed' });
  const evaluator = async () => {
    const before = JSON.parse(readFileSync(beforePath, 'utf8'));
    const after = JSON.parse(readFileSync(afterPath, 'utf8'));
    before.weights.b1[0] = 99; // SHA no longer matches
    const { evaluateLocalWeightLabModels } = await import('../../buap-weightlab-bridge/src/local-evaluator.mjs');
    return evaluateLocalWeightLabModels(before, after, patch);
  };
  await assert.rejects(evaluateAndPromoteWeightPatch({...args(state), evaluator}), /fingerprint/);
  assert.equal(state.mission.status('repair'), 'failed');
  assert.equal(state.life.snapshot().applied_event_ids.length, 0);
});
