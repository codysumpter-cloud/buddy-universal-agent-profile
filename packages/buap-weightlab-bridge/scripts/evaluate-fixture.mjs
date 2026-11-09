import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateLocalWeightLabFiles } from '../src/local-evaluator.mjs';

const fixture = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/blind-ramp-v2');
const result = evaluateLocalWeightLabFiles({
  beforePath: join(fixture, 'blind_ramp_before.json'),
  afterPath: join(fixture, 'blind_ramp_after.json'),
  patchPath: join(fixture, 'blind_ramp_patch.json'),
});
console.log(JSON.stringify({
  experiment: 'Blind Ramp v2: independent JavaScript evaluation',
  source_sha256: result.report.source_sha256,
  target_sha256: result.report.target_sha256,
  proof_sha256: result.artifact_sha256,
  rollback_verified: result.rollback_verified,
  models_verified: result.model_hashes_verified,
  scores: Object.fromEntries(Object.entries(result.report.scores).map(([split, data]) => [split, {
    baseline_wins: data.baseline.wins, patched_wins: data.patched.wins, episodes: data.baseline.seeds,
  }])),
}, null, 2));
