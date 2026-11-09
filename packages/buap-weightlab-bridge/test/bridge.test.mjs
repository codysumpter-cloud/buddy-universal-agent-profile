import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWeightLabReport, evaluateAndPromoteWeightPatch } from '../src/index.mjs';

const src = '1'.repeat(64), dst = '2'.repeat(64);
const patch = () => ({
  protocol: 'prismtek-sparse-weight-patch-v1', parameter_count: 226, changed_count: 1,
  source_sha256: src, target_sha256: dst,
  edits: [{ tensor: 'w1', index: [0, 1], before: 0, after: 2 }],
});
const split = (name, namespace, seeds, winsBefore, winsAfter) => ({
  baseline: { split: name, seeds, wins: winsBefore, seed_namespace: namespace, success_rate: winsBefore / seeds, model_sha256: src },
  patched: { split: name, seeds, wins: winsAfter, seed_namespace: namespace, success_rate: winsAfter / seeds, model_sha256: dst },
});
const report = () => ({
  source_sha256: src, target_sha256: dst, changed_parameters: 1, separate_seed_namespaces: true,
  scores: { train: split('train', 1000, 64, 0, 64), heldout: split('heldout', 2000, 256, 0, 256), stress: split('stress', 3000, 256, 0, 253) },
});
const evaluation = () => ({ report: report(), rollback_verified: true, model_hashes_verified: true, artifact_sha256: 'a'.repeat(64) });
class FakeLife {
  constructor(profile = { agent: { id: 'buddy' }, reinforcement: { allowed_authorities: ['verifier'] }, memory: { max_evidence_items: 4 } }, snapshot = null) {
    this.profile = profile;
    this.events = snapshot?.events ? structuredClone(snapshot.events) : [];
  }
  snapshot() { return { events: structuredClone(this.events) }; }
  applyEvent(event) {
    if (event.authority.actor_id === this.profile.agent.id) throw Error('self reward');
    if (!event.evidence.length) throw Error('missing evidence');
    if (!Number.isFinite(Date.parse(event.occurred_at))) throw Error('bad timestamp');
    if (this.events.some(e => e.id === event.id)) return { applied: false, memory_event: null };
    this.events.push(event);
    return { applied: true, memory_event: { event_id: event.id } };
  }
}
class FakeMission {
  constructor() {
    this.manifest = { steps: [{ id: 'repair', checks: ['patch-integrity', 'independent-evaluation', 'rollback-ready'] }] };
    this.s = 'queued'; this.receipts = [];
  }
  begin() { if (this.s !== 'queued') return { started: false, decision: 'already_claimed' }; this.s = 'in_progress'; return { started: true }; }
  status() { return this.s; }
  fail() { this.s = 'failed'; }
  complete(_, receipt) {
    assert.equal(this.s, 'in_progress');
    assert.deepEqual(receipt.checks.map(c => c.name), this.manifest.steps[0].checks);
    assert(receipt.checks.every(c => c.status === 'pass' && c.evidence_ref));
    this.s = 'completed'; this.receipts.push(receipt); return receipt;
  }
}
const args = (overrides = {}) => ({
  mission: new FakeMission(), life: new FakeLife(), stepId: 'repair',
  evaluator: async () => evaluation(), patch: patch(), modelId: 'vehicle-ramp',
  resultRef: 'local:evaluation-abc', rollbackRef: 'local:patch-inverse',
  verifierId: 'ci-verifier', occurredAt: '2026-11-09T15:00:00.000Z', sources: ['weightlab:v0.2'], ...overrides,
});

test('accepts paired independent splits with valid limited patch', () => {
  const result = validateWeightLabReport(report(), patch());
  assert.equal(result.accepted, true);
  assert.equal(result.stress_success, 253 / 256);
});
test('rejects hash mismatches and duplicate edits', () => {
  assert.throws(() => validateWeightLabReport(report(), { ...patch(), target_sha256: src }), /hash mismatch/);
  const p = patch(); p.edits.push({ ...p.edits[0] }); p.changed_count = 2;
  assert.throws(() => validateWeightLabReport(report(), p), /duplicate edit/);
});
test('rejects leaking train seeds, inflated win rates and regressions', () => {
  const r1 = report(); r1.scores.stress.patched.seed_namespace = 2000; r1.scores.stress.baseline.seed_namespace = 2000;
  assert.throws(() => validateWeightLabReport(r1, patch()), /overlap/);
  const r2 = report(); r2.scores.heldout.patched.success_rate = 1.001;
  assert.throws(() => validateWeightLabReport(r2, patch()), /scores/);
  const r3 = report(); r3.scores.stress.patched.wins = 20; r3.scores.stress.patched.success_rate = 20/256;
  assert.throws(() => validateWeightLabReport(r3, patch()), /did not pass/);
});
test('requires host evaluation and rollback proof; never rewards before pass', async () => {
  const good = args(); const success = await evaluateAndPromoteWeightPatch(good);
  assert.equal(success.promoted, true); assert.equal(good.life.snapshot().events.length, 1);
  assert.equal(good.mission.s, 'completed');
  assert.equal(success.approved_target_sha256, dst);
  const bad = args({ evaluator: async () => ({ ...evaluation(), rollback_verified: false }) });
  await assert.rejects(evaluateAndPromoteWeightPatch(bad), /attestation/);
  assert.equal(bad.mission.s, 'failed'); assert.equal(bad.life.snapshot().events.length, 0);
});
test('no model self-reward; blocked missions stay unchanged', async () => {
  const bad = args({ verifierId: 'buddy' });
  await assert.rejects(evaluateAndPromoteWeightPatch(bad), /self-reinforcement/);
  assert.equal(bad.mission.s, 'queued');
  const existing = args(); existing.mission.s = 'completed';
  const out = await evaluateAndPromoteWeightPatch(existing);
  assert.equal(out.promoted, false); assert.equal(existing.life.snapshot().events.length, 0);
});
test('misconfigured event is caught before mission completion', async () => {
  const a = args({ occurredAt: 'invalid-date' });
  await assert.rejects(evaluateAndPromoteWeightPatch(a), /bad timestamp/);
  assert.equal(a.mission.s, 'failed'); assert.equal(a.life.snapshot().events.length, 0);
});
test('weightlab v0.2 real artifact passes gate when supplied', () => {
  const root = process.env.WEIGHTLAB_V02_ROOT;
  const fixture = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/blind-ramp-v2');
  const reportPath = root ? join(root, 'artifacts/blind_ramp_v2/evaluation.json') : null;
  const patchPath = root ? join(root, 'artifacts/blind_ramp_v2/blind_ramp_patch.json') : join(fixture,'blind_ramp_patch.json');
  const p = JSON.parse(readFileSync(patchPath, 'utf8'));
  if (reportPath) {
    const r = JSON.parse(readFileSync(reportPath, 'utf8'));
    assert.equal(validateWeightLabReport(r, p).accepted, true);
  } else {
    // The committed fixture must be evaluated by independent model execution
    // rather than trusting a precomputed report or silently skipping CI.
    const before = JSON.parse(readFileSync(join(fixture,'blind_ramp_before.json'),'utf8'));
    const after = JSON.parse(readFileSync(join(fixture,'blind_ramp_after.json'),'utf8'));
    assert.equal(p.source_sha256, before.sha256);
    assert.equal(p.target_sha256, after.sha256);
  }
});
