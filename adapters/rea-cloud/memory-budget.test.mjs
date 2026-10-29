import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_HEAVY_BOOT_BYTES,
  parseCgroupMemoryLimit,
  detectCgroupMemoryLimit,
  canRunHeavyBootAudits,
} from './memory-budget.mjs';

test('parse cgroup v2 and v1 memory limits without inventing an unlimited value', () => {
  assert.equal(parseCgroupMemoryLimit('536870912\n'), 512 * 1024 * 1024);
  assert.equal(parseCgroupMemoryLimit('max\n'), null);
  assert.equal(parseCgroupMemoryLimit('9223372036854771712'), null);
  assert.equal(parseCgroupMemoryLimit('not-a-number'), null);
});

test('detect memory v2, then v1, and fail closed when neither is available', () => {
  assert.equal(detectCgroupMemoryLimit(filename => {
    if (filename.endsWith('memory.max')) return '536870912';
    throw Error('not reached');
  }), 512 * 1024 * 1024);
  assert.equal(detectCgroupMemoryLimit(filename => {
    if (filename.endsWith('memory.max')) throw Error('missing');
    return '2147483648';
  }), 2 * 1024 * 1024 * 1024);
  assert.equal(detectCgroupMemoryLimit(() => { throw Error('no cgroup'); }), null);
});

test('never restart boot audits on free-tier 512 MiB even if override flag is set', () => {
  assert.equal(canRunHeavyBootAudits({explicitEnabled: true, memoryLimitBytes: 512 * 1024 ** 2}), false);
  assert.equal(canRunHeavyBootAudits({explicitEnabled: true, memoryLimitBytes: null}), false);
  assert.equal(canRunHeavyBootAudits({explicitEnabled: false, memoryLimitBytes: MIN_HEAVY_BOOT_BYTES}), false);
  assert.equal(canRunHeavyBootAudits({explicitEnabled: true, memoryLimitBytes: MIN_HEAVY_BOOT_BYTES}), true);
});
