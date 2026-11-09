import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { fingerprint, applySparsePatch, evaluateLocalWeightLabModels, evaluateLocalWeightLabFiles } from '../src/local-evaluator.mjs';
const dataPath = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/blind-ramp-v2');
const load = f => JSON.parse(readFileSync(join(dataPath, f),'utf8'));
const before = load('blind_ramp_before.json'), after = load('blind_ramp_after.json'), patch = load('blind_ramp_patch.json');

// Run a single full independent benchmark once, then reuse computed report.
const independent = evaluateLocalWeightLabModels(before,after,patch);
test('matches NumPy SHA-256 model fingerprints and verifies precise rollback',()=>{
  assert.equal(fingerprint(before.weights),before.sha256);
  assert.equal(fingerprint(after.weights),after.sha256);
  assert.deepEqual(applySparsePatch(before,patch).weights,after.weights);
  assert.deepEqual(applySparsePatch(after,patch,true).weights,before.weights);
});
test('evaluates actual model inference against fresh train/held-out/stress seeds',()=>{
  assert.equal(independent.gate.accepted,true);
  assert.equal(independent.report.evaluator,'prismtek-js-independent-physics-v1');
  assert.equal(independent.report.scores.heldout.baseline.wins,0);
  assert.equal(independent.report.scores.heldout.patched.seeds,256);
  assert.ok(independent.report.scores.heldout.patched.wins >= 244);
  assert.ok(independent.report.scores.stress.patched.wins >= 244);
});
test('real file-based trusted evaluator returns checksum-bound evidence',()=>{
  const data = evaluateLocalWeightLabFiles({beforePath:join(dataPath,'blind_ramp_before.json'),
    afterPath:join(dataPath,'blind_ramp_after.json'),patchPath:join(dataPath,'blind_ramp_patch.json')});
  assert.deepEqual(data,independent);
  assert.match(data.artifact_sha256,/^[a-f0-9]{64}$/);
});
test('rejects forged hash/weights and arbitrary output semantics',()=>{
  const a=structuredClone(after);a.weights.b1[0]+=1;
  assert.throws(()=>evaluateLocalWeightLabModels(before,a,patch),/fingerprint/);
  const b=structuredClone(after);b.actions=['forward','reverse'];
  assert.throws(()=>evaluateLocalWeightLabModels(before,b,patch),/semantics/);
});
test('rejects numeric patch tampering, duplicate edits, wrong model references',()=>{
  const a=structuredClone(patch);a.edits[0].after=5;
  assert.throws(()=>evaluateLocalWeightLabModels(before,after,a),/hash mismatch/);
  const b=structuredClone(patch);b.edits.push({...b.edits[0]});b.changed_count++;
  assert.throws(()=>evaluateLocalWeightLabModels(before,after,b),/duplicate/);
  const c=structuredClone(patch);c.source_sha256='f'.repeat(64);
  assert.throws(()=>evaluateLocalWeightLabModels(before,after,c),/wrong models/);
});
test('enforces independent benchmark thresholds and has no automatic deploy capability',()=>{
  assert.throws(()=>evaluateLocalWeightLabModels(before,after,patch,{policy:{minHeldout:1.01}}),/did not pass/);
  assert.throws(()=>evaluateLocalWeightLabModels(before,after,patch,{episodes:{train:64,heldout:1,stress:256}}),/invalid heldout scores/);
  assert.equal(Object.hasOwn(independent,'deployed'),false);
});
