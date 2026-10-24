import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { transferStagedObject, TransferVerificationError } from '../scripts/r2-verified-transfer.mjs';

const bytes = new TextEncoder().encode('Private transfer fixture: original, checksum-tested bytes.');
const sha = createHash('sha256').update(bytes).digest('hex');
const split = async function* (data) { yield data.subarray(0, 8); yield data.subarray(8); };
const baseKey = 'transfers/validated01/fixture.bin';
function fixture(options = {}) {
  const staged = new Map([[baseKey, bytes]]);
  const durable = new Map();
  let deletes = 0;
  const stage = {
    head: async k => staged.has(k) ? { size: staged.get(k).length } : null,
    open: async k => staged.has(k) ? { body: split(staged.get(k)) } : null,
    delete: async k => { deletes++; if(options.deleteThrows) throw new Error('Delete transport failed'); if(!options.deleteNoop) staged.delete(k); },
  };
  const destination = {
    write: async (k, stream) => {
      if (options.writerDoesNotConsume) return;
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      durable.set(k, options.corruptDestination ? new Uint8Array([9, 8, 7]) : Buffer.concat(chunks));
    },
    open: async k => durable.has(k) ? { body: split(durable.get(k)) } : null,
  };
  const args = { transferId: 'validated01', stageKey: baseKey, destinationId: 'github-release://artifact-123', authorized: true, expectedSha256: sha, expectedBytes: bytes.length, stage, destination };
  return { stage, destination, staged, durable, args, get deletes() { return deletes; } };
}

test('happy path verifies full destination bytes, then deletes and confirms empty stage', async () => {
  const f = fixture();
  const result = await transferStagedObject(f.args);
  assert.equal(result.sha256, sha);
  assert.equal(result.stagingDeletionConfirmed, true);
  assert.equal(result.destinationVerified, true);
  assert.equal(f.deletes, 1);
  assert.equal(f.staged.has(baseKey), false);
  assert.deepEqual(f.durable.get(f.args.destinationId), Buffer.from(bytes));
});
test('no deletion if source checksum mismatches manifest', async () => {
  const f = fixture();
  await assert.rejects(transferStagedObject({ ...f.args, expectedSha256: 'a'.repeat(64) }), e => e instanceof TransferVerificationError && e.phase === 'write-destination' && e.destinationVerified === false);
  assert.equal(f.deletes, 0);
});
test('no deletion if destination bytes do not match', async () => {
  const f = fixture({ corruptDestination: true });
  await assert.rejects(transferStagedObject(f.args), e => e.phase === 'verify-destination' && !e.destinationVerified);
  assert.equal(f.deletes, 0);
});
test('no deletion if the destination writer returns before consuming the stream', async () => {
  const f = fixture({ writerDoesNotConsume: true });
  await assert.rejects(transferStagedObject(f.args), e => e.phase === 'write-destination');
  assert.equal(f.deletes, 0);
});
test('failed delete surfaces explicit cleanup incomplete after destination integrity verified', async () => {
  const f = fixture({ deleteThrows: true });
  await assert.rejects(transferStagedObject(f.args), e => e.phase === 'delete-stage' && e.destinationVerified && !e.stagingDeletionConfirmed);
  assert.equal(f.deletes, 1);
  assert.equal(f.staged.has(baseKey), true);
});
test('silent delete no-op detected via HEAD verification', async () => {
  const f = fixture({ deleteNoop: true });
  await assert.rejects(transferStagedObject(f.args), e => e.phase === 'confirm-stage-deletion' && e.destinationVerified);
  assert.equal(f.staged.has(baseKey), true);
});
test('requires deliberate authorized account boundary and safe transfer-scoped key', async () => {
  const f = fixture();
  for (const overrides of [{ authorized: false },{ stageKey: 'backups/user/fixture.bin' },{ stageKey: 'transfers/validated01/../file.bin' },{ expectedSha256: 'etag-1234' },{ expectedBytes: -1 },{ destinationId: '' }]) {
    await assert.rejects(transferStagedObject({ ...f.args, ...overrides }), TypeError);
  }
  assert.equal(f.deletes, 0);
});
test('missing source never calls delete', async () => {
  const f = fixture(); f.staged.clear();
  await assert.rejects(transferStagedObject(f.args), e => e.phase === 'read-source');
  assert.equal(f.deletes, 0);
});
test('zero-byte authorized transfer still validates and cleans up', async () => {
  const f = fixture(); const empty = new Uint8Array(); f.staged.set(baseKey, empty);
  const digest = createHash('sha256').update(empty).digest('hex');
  const receipt = await transferStagedObject({ ...f.args, expectedBytes: 0, expectedSha256: digest });
  assert.equal(receipt.bytes, 0);
  assert.equal(f.deletes, 1);
});
