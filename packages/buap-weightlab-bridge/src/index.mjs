const HASH = /^[a-f0-9]{64}$/;
const CHECKS = ['patch-integrity', 'independent-evaluation', 'rollback-ready'];
const fail = (reason) => { throw new Error(`WeightLab gate: ${reason}`); };
const validHash = (value) => typeof value === 'string' && HASH.test(value);
const count = (value) => Number.isSafeInteger(value) && value >= 0;

/** Strictly checks data from a host-run benchmark, never executes proposed code. */
export function validateWeightLabReport(report, patch, { minHeldout = 0.95, minStress = 0.95, minEpisodes = 64, maxEdits = 12 } = {}) {
  if (!report || !patch || typeof report !== 'object' || typeof patch !== 'object') fail('missing report or patch');
  if (!validHash(report.source_sha256) || !validHash(report.target_sha256) || report.source_sha256 === report.target_sha256) fail('invalid model fingerprints');
  if (patch.source_sha256 !== report.source_sha256 || patch.target_sha256 !== report.target_sha256) fail('model hash mismatch');
  if (patch.protocol !== 'prismtek-sparse-weight-patch-v1') fail('unsupported patch protocol');
  if (!count(patch.parameter_count) || patch.parameter_count === 0 || !count(patch.changed_count) ||
      patch.changed_count < 1 || patch.changed_count > maxEdits || !Array.isArray(patch.edits) || patch.edits.length !== patch.changed_count) fail('invalid edit budget');
  const keys = new Set();
  for (const e of patch.edits) {
    if (!e || typeof e.tensor !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(e.tensor) ||
        !Array.isArray(e.index) || e.index.length < 1 || e.index.length > 4 ||
        !e.index.every(count) || !Number.isFinite(e.before) || !Number.isFinite(e.after) ||
        Object.is(e.before, e.after)) fail('invalid numeric edit');
    const key = `${e.tensor}:${e.index.join(',')}`;
    if (keys.has(key)) fail('duplicate edit');
    keys.add(key);
  }
  if (report.changed_parameters !== patch.changed_count || report.separate_seed_namespaces !== true) fail('patch count or independent split mismatch');
  const scores = report.scores;
  if (!scores || typeof scores !== 'object') fail('missing score splits');
  const namespaces = new Set();
  for (const split of ['train', 'heldout', 'stress']) {
    const s = scores[split];
    if (!s?.baseline || !s.patched) fail(`missing ${split} baseline/patch`);
    const a = s.baseline, b = s.patched;
    for (const v of [a, b]) {
      if (!count(v.seeds) || v.seeds < (split === 'train' ? 1 : minEpisodes) || !count(v.wins) || v.wins > v.seeds ||
          typeof v.success_rate !== 'number' || !Number.isFinite(v.success_rate) ||
          Math.abs(v.success_rate - v.wins / v.seeds) > 1e-10 || v.split !== split ||
          !Number.isSafeInteger(v.seed_namespace) || !validHash(v.model_sha256)) fail(`invalid ${split} scores`);
    }
    if (a.seeds !== b.seeds || a.seed_namespace !== b.seed_namespace ||
        a.model_sha256 !== report.source_sha256 || b.model_sha256 !== report.target_sha256) fail(`${split} comparison is not paired`);
    if (namespaces.has(a.seed_namespace)) fail('train/held-out/stress seeds overlap');
    namespaces.add(a.seed_namespace);
  }
  const heldout = scores.heldout, stress = scores.stress;
  if (!(heldout.patched.success_rate >= minHeldout && stress.patched.success_rate >= minStress &&
        heldout.patched.success_rate > heldout.baseline.success_rate &&
        stress.patched.success_rate > stress.baseline.success_rate)) fail('held-out/stress improvement did not pass');
  return Object.freeze({
    accepted: true, source_sha256: report.source_sha256, target_sha256: report.target_sha256,
    changed_parameters: patch.changed_count, heldout_success: heldout.patched.success_rate,
    stress_success: stress.patched.success_rate,
    improvement: heldout.patched.success_rate - heldout.baseline.success_rate,
  });
}

/**
 * Bridges existing MissionControl + AgentLifeRuntime. A trusted host MUST run
 * evaluator (not the model proposing weights). This adapter does not deploy a
 * model, grant capabilities, run the simulator, or persist snapshots.
 */
export async function evaluateAndPromoteWeightPatch({
  mission, life, stepId, evaluator, patch, modelId, resultRef, rollbackRef,
  verifierId, occurredAt, sources = [], policy = {}, usage = { tokens: 0, cost_cents: 0 },
}) {
  if (!mission?.begin || !mission?.complete || !mission?.fail || !life?.applyEvent || !life?.snapshot) fail('real BUAP runtime interfaces required');
  if (typeof evaluator !== 'function') fail('trusted evaluator callback required');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stepId || '')) fail('invalid mission step');
  if (![modelId, resultRef, rollbackRef, verifierId].every(s => typeof s === 'string' && s.trim().length > 0 && s.length < 1024)) fail('missing provenance');
  if (verifierId === String(life.profile?.agent?.id)) fail('self-reinforcement is forbidden');
  if (!life.profile?.reinforcement?.allowed_authorities?.includes('verifier')) fail('agent profile does not authorize verifier events');
  if (life.profile?.memory?.max_evidence_items < 2) fail('agent life evidence capacity too small');
  if (!Array.isArray(sources) || sources.some(s => typeof s !== 'string' || !s.trim()) || sources.length > 32) fail('invalid sources');
  if (!count(usage.tokens) || !count(usage.cost_cents)) fail('invalid usage');
  const claim = mission.begin(stepId);
  if (!claim.started) return { promoted: false, decision: claim.decision, receipt: null };
  try {
    // The callback must execute an independent benchmark and verify exported
    // source/target model hashes and exact reverse patch before returning.
    const evaluation = await evaluator();
    if (!evaluation || evaluation.rollback_verified !== true || evaluation.model_hashes_verified !== true ||
        typeof evaluation.artifact_sha256 !== 'string' || !validHash(evaluation.artifact_sha256)) fail('independent hash/rollback attestation required');
    const gate = validateWeightLabReport(evaluation.report, patch, policy);
    const wanted = mission.manifest?.steps?.find(s => s.id === stepId)?.checks;
    if (!Array.isArray(wanted) || wanted.length !== CHECKS.length || !CHECKS.every(c => wanted.includes(c))) fail('mission must declare required neural checks');
    // Probe event validation against a cloned AgentLifeRuntime to avoid
    // completing a mission whose Agent Life event is malformed.
    const pendingEvent = {
      id: `weightlab-${stepId}-${gate.target_sha256.slice(0,24)}`,
      kind: 'task_succeeded', occurred_at: occurredAt ?? new Date().toISOString(),
      subject: { type: 'controller', id: modelId },
      reward: Math.min(1, Math.max(0, gate.improvement)), confidence: 1,
      authority: { kind: 'verifier', actor_id: verifierId },
      evidence: [ { type: 'receipt', ref: resultRef }, { type: 'rollback', ref: rollbackRef } ],
    };
    const probe = new life.constructor(life.profile, life.snapshot());
    probe.applyEvent(pendingEvent);
    const receipt = mission.complete(stepId, {
      result_ref: resultRef, usage, sources,
      checks: CHECKS.map(name => ({ name, status: 'pass', evidence_ref: `${resultRef}#${name}:${evaluation.artifact_sha256}` })),
    });
    const learning = life.applyEvent(pendingEvent);
    return { promoted: true, gate, receipt, memory_event: learning.memory_event,
      approved_target_sha256: gate.target_sha256, model_id: modelId,
      persistence: 'host_must_save_agent_mission_and_model_atomically' };
  } catch (error) {
    // Do not modify Agent Life on any evaluation failure.
    if (mission.status?.(stepId) === 'in_progress') mission.fail(stepId, { reason: 'weightlab_gate_failed' });
    throw error;
  }
}

export const WeightLabBridgeChecks = Object.freeze([...CHECKS]);