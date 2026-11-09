/**
 * Trusted HOST-SIDE evaluator for the tiny Prismtek WeightLab v0.2 MLP format.
 * - No model-supplied JavaScript, Python, shell, or dynamic imports.
 * - Recomputes model SHA-256, applies and reverses each numeric edit, then
 *   independently runs deterministic physics episodes in JS.
 * - Physics generator deliberately uses a new seeded PRNG; scores are NOT a
 *   reproduction of the NumPy benchmark's seed-by-seed trajectories.
 * - This is synthetic game AI research, not a human-brain or Kinetix model.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateWeightLabReport } from './index.mjs';

const TENSORS = ['w1', 'b1', 'w2', 'b2'];
const PROTOCOL = 'prismtek-sparse-weight-patch-v1';
const MODEL_FORMAT = 'prismtek-weightlab-mlp-v1';
const SEED_NAMESPACES = Object.freeze({ train: 110001, heldout: 220001, stress: 330001 });
const fail = (why) => { throw new Error(`WeightLab local evaluator: ${why}`); };
const finite = x => typeof x === 'number' && Number.isFinite(x);
const integer = x => Number.isSafeInteger(x) && x >= 0;

function parseModel(model) {
  if (!model || model.format !== MODEL_FORMAT || model.activation !== 'tanh' ||
      JSON.stringify(model.inputs) !== JSON.stringify(['constant', 'reversed_enough', 'position_over_8', 'velocity_over_8']) ||
      JSON.stringify(model.actions) !== JSON.stringify(['reverse', 'forward'])) fail('unknown input/output semantics');
  const w = model.weights;
  if (!w || typeof w !== 'object' || Object.keys(w).sort().join(',') !== TENSORS.slice().sort().join(',')) fail('unexpected tensor keys');
  if (!Array.isArray(w.w1) || w.w1.length < 2 || w.w1.length > 4096 ||
      !w.w1.every(row => Array.isArray(row) && row.length === 4 && row.every(finite)) ||
      !Array.isArray(w.b1) || w.b1.length !== w.w1.length || !w.b1.every(finite) ||
      !Array.isArray(w.w2) || w.w2.length !== 2 ||
      !w.w2.every(row => Array.isArray(row) && row.length === w.w1.length && row.every(finite)) ||
      !Array.isArray(w.b2) || w.b2.length !== 2 || !w.b2.every(finite)) fail('invalid shapes or nonfinite weights');
  const digest = fingerprint(w);
  if (model.sha256 !== digest) fail('model fingerprint mismatch');
  return w;
}

/** Byte-for-byte equivalent to WeightLab's Python little-endian float64 hash. */
export function fingerprint(w) {
  const h = createHash('sha256');
  h.update(Buffer.from(MODEL_FORMAT + '\0'));
  for (const name of TENSORS) {
    const rows = name === 'w1' || name === 'w2';
    const shape = rows ? [w[name].length, w[name][0].length] : [w[name].length];
    h.update(Buffer.from(`${name}\0[${shape.join(', ')}]\0`));
    const entries = rows ? w[name].flat() : w[name];
    for (const val of entries) {
      if (!finite(val)) fail('nonfinite tensor');
      const bytes = Buffer.allocUnsafe(8);
      bytes.writeDoubleLE(val, 0);
      h.update(bytes);
    }
  }
  return h.digest('hex');
}

function copyWeights(w) { return Object.fromEntries(TENSORS.map(k => [k, structuredClone(w[k])])); }

export function applySparsePatch(model, patch, reverse = false) {
  const source = parseModel(model);
  if (!patch || patch.protocol !== PROTOCOL ||
      (reverse ? patch.target_sha256 : patch.source_sha256) !== model.sha256) fail('patch source mismatch');
  const total = source.w1.length * 4 + source.b1.length + source.w2[0].length * 2 + 2;
  if (patch.parameter_count !== total || !integer(patch.changed_count) || patch.changed_count < 1 ||
      !Array.isArray(patch.edits) || patch.edits.length !== patch.changed_count ||
      patch.changed_count > Math.floor(total * 0.1)) fail('bad patch shape/budget');
  const w = copyWeights(source), seen = new Set();
  for (const e of patch.edits) {
    if (!e || !TENSORS.includes(e.tensor) || !Array.isArray(e.index) ||
        e.index.length !== (['w1', 'w2'].includes(e.tensor) ? 2 : 1) ||
        !e.index.every(integer) || !finite(e.before) || !finite(e.after) || e.before === e.after) fail('bad patch entry');
    const address = `${e.tensor}:${e.index.join(':')}`;
    if (seen.has(address)) fail('duplicate patch entry');
    seen.add(address);
    const container = w[e.tensor];
    const arr = e.index.length === 2 ? container[e.index[0]] : container;
    const ix = e.index.at(-1);
    if (!arr || ix >= arr.length || arr[ix] !== (reverse ? e.after : e.before)) fail('patch precondition mismatch');
    arr[ix] = reverse ? e.before : e.after;
  }
  const expected = reverse ? patch.source_sha256 : patch.target_sha256;
  if (fingerprint(w) !== expected) fail('patch result hash mismatch');
  return {...model, sha256: expected, weights: w};
}

// A fixed, independent RNG. The same sample is fed to the baseline and patch.
function rng32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}
const uniform = (rng, a, b) => a + (b - a) * rng();
function draw(seed, split) {
  const r = rng32(SEED_NAMESPACES[split] + seed);
  const ranges = split === 'train' ? [[2.15,2.85],[3.65,4.5],[.9975,.999],[.045,.055],[-1.65,-.8]] :
    split === 'heldout' ? [[1.8,3.15],[3.9,5.05],[.996,.999],[.04,.065],[-2.35,-.45]] :
    [[1.65,3.35],[4.0,5.15],[.9955,.9993],[.035,.07],[-2.9,-.35]];
  return [...ranges.map(([lo, hi]) => uniform(r,lo,hi)), uniform(r,-.1,.1)];
}

function runNetwork(w, x, v) {
  const obs = [1, 0, x / 8, v / 8];
  let reverse = w.b2[0], forward = w.b2[1];
  for (let j = 0; j < w.b1.length; j++) {
    const row = w.w1[j];
    const z = Math.tanh(row[0]*obs[0] + row[1]*obs[1] + row[2]*obs[2] + row[3]*obs[3] + w.b1[j]);
    reverse += z * w.w2[0][j]; forward += z * w.w2[1][j];
  }
  return forward > reverse ? 1 : 0; // numpy.argmax ties favor index 0
}

function runEpisode(w, [accel,minSpeed,damping,dt,startX,startVelocity]) {
  let x=startX,v=startVelocity,collisions=0,won=false,steps=0;
  for (let step=0; step<600; step++) {
    const action=runNetwork(w,x,v);
    v=(v+accel*(action===1 ? 1 : -1)*dt)*damping;
    const nx=x+v*dt;
    if (x<0 && nx>=0 && v<minSpeed) { x=-.001;v=0;collisions++; }
    else x=nx;
    steps=step+1;
    if (x>=1.2) { won=true; break; }
    if (x<=-12) break;
  }
  return {success:won,collisions,steps};
}

function score(w, split, count) {
  let wins=0,collisions=0,successfulSteps=0;
  for(let i=0;i<count;i++) {
    const r=runEpisode(w,draw(i,split));
    wins+=r.success?1:0;
    collisions+=r.collisions;
    if(r.success) successfulSteps+=r.steps;
  }
  return {wins,collisions:collisions/count,steps:wins?successfulSteps/wins:null};
}

/** Evaluate models on fresh deterministic scenarios, and independently prove rollback. */
export function evaluateLocalWeightLabModels(before, after, patch, {episodes={train:64,heldout:256,stress:256}, policy={}}={}) {
  const wa=parseModel(before), wb=parseModel(after);
  if (before.sha256===after.sha256) fail('no change');
  if (patch.source_sha256!==before.sha256 || patch.target_sha256!==after.sha256) fail('patch references wrong models');
  const fwd=applySparsePatch(before,patch);
  const rev=applySparsePatch(after,patch,true);
  if (fingerprint(fwd.weights)!==after.sha256 ||
      fingerprint(rev.weights)!==before.sha256) fail('forward/rollback mismatch');
  const scores={};
  for(const split of ['train','heldout','stress']) {
    const count=episodes[split];
    if(!Number.isInteger(count)||count<1||count>2000) fail('invalid episode count');
    const a=score(wa,split,count), b=score(wb,split,count);
    scores[split]={
      baseline:{split,seeds:count,wins:a.wins,success_rate:a.wins/count,seed_namespace:SEED_NAMESPACES[split],model_sha256:before.sha256},
      patched:{split,seeds:count,wins:b.wins,success_rate:b.wins/count,seed_namespace:SEED_NAMESPACES[split],model_sha256:after.sha256}
    };
  }
  const report={
    evaluator:'prismtek-js-independent-physics-v1',source_sha256:before.sha256,
    target_sha256:after.sha256,changed_parameters:patch.changed_count,
    separate_seed_namespaces:true,scores
  };
  const gate=validateWeightLabReport(report,patch,policy);
  const artifact_sha256=createHash('sha256').update(JSON.stringify({before,after,patch,report})).digest('hex');
  return {report,gate,rollback_verified:true,model_hashes_verified:true,artifact_sha256};
}

/** Load only explicitly trusted paths supplied by the host; no arbitrary code. */
export function evaluateLocalWeightLabFiles({beforePath, afterPath, patchPath, ...options}) {
  if(![beforePath,afterPath,patchPath].every(p=>typeof p==='string'&&p.trim())) fail('missing file paths');
  const before=JSON.parse(readFileSync(beforePath,'utf8'));
  const after=JSON.parse(readFileSync(afterPath,'utf8'));
  const patch=JSON.parse(readFileSync(patchPath,'utf8'));
  return evaluateLocalWeightLabModels(before,after,patch,options);
}
