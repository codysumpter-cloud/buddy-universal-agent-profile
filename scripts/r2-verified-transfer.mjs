/**
 * BUAP: fail-closed transfer/cleanup orchestration for a *private* R2 staging
 * object and a separately authorized durable destination.
 *
 * Adapter contract (no credentials or bucket bindings are created here):
 * stage.open(key) -> {body: AsyncIterable<Uint8Array>}
 * stage.head(key) -> metadata or null
 * stage.delete(key) -> Promise<void>
 * destination.write(id, AsyncIterable<Uint8Array>) -> Promise<void>
 * destination.open(id) -> {body: AsyncIterable<Uint8Array>}
 *
 * A caller must pre-authorize the source, destination and account boundary.
 * No R2 object is deleted until byte-for-byte SHA-256 integrity is proven by
 * independently re-reading the destination. R2 ETags are NEVER SHA-256 proof.
 */
import { createHash } from 'node:crypto';

export class TransferVerificationError extends Error {
  constructor(message, phase, destinationVerified = false, cause) {
    super(message, { cause });
    this.name = 'TransferVerificationError';
    this.phase = phase;
    this.destinationVerified = destinationVerified;
    this.stagingDeletionConfirmed = false;
  }
}

const TRANSFER_ID = /^[a-zA-Z0-9_-]{8,64}$/;
const SHA256 = /^[a-fA-F0-9]{64}$/;
const MAX_SAFE_SIZE = Number.MAX_SAFE_INTEGER;

function validate(args) {
  if (!args || typeof args !== 'object') throw new TypeError('Transfer options required');
  const { transferId, stageKey, destinationId, expectedSha256, expectedBytes, stage, destination, authorized } = args;
  if (authorized !== true) throw new TypeError('Destination/account authorization required');
  if (typeof transferId !== 'string' || !TRANSFER_ID.test(transferId)) throw new TypeError('Invalid transfer ID');
  if (typeof stageKey !== 'string' || !stageKey.startsWith(\`transfers/\${transferId}/\`) || stageKey.endsWith('/')) throw new TypeError('Stage key must be scoped to this transfer');
  const tail = stageKey.slice(\`transfers/\${transferId}/\`.length);
  if (!tail || tail.includes('\\') || tail.split('/').some(s => !s || s === '.' || s === '..') || !/^[a-zA-Z0-9._/-]+$/.test(tail)) throw new TypeError('Invalid stage object path');
  if (typeof destinationId !== 'string' || destinationId.trim().length < 3) throw new TypeError('Durable destination ID required');
  if (typeof expectedSha256 !== 'string' || !SHA256.test(expectedSha256)) throw new TypeError('Expected SHA-256 required, not ETag');
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0 || expectedBytes > MAX_SAFE_SIZE) throw new TypeError('Expected byte size required');
  for (const [owner, methods] of [[stage, ['open', 'head', 'delete']], [destination, ['write', 'open']]]) {
    for (const method of methods) if (typeof owner?.[method] !== 'function') throw new TypeError(\`Storage adapter missing \${method}\`);
  }
}

async function contentOf(provider, key) {
  const obj = await provider.open(key);
  if (!obj?.body || typeof obj.body[Symbol.asyncIterator] !== 'function') throw new Error('Readable object stream required');
  return obj.body;
}

function digestStream(stream, state) {
  return (async function* () {
    for await (const chunk of stream) {
      if (!(chunk instanceof Uint8Array)) throw new Error('Non-byte content in object stream');
      state.bytes += chunk.byteLength;
      if (!Number.isSafeInteger(state.bytes) || state.bytes > state.expectedBytes) throw new Error('Object exceeds expected length');
      state.hash.update(chunk);
      yield chunk;
    }
    state.complete = true;
  })();
}

async function computeDigest(stream, expectedBytes) {
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of stream) {
    if (!(chunk instanceof Uint8Array)) throw new Error('Non-byte content in destination stream');
    size += chunk.byteLength;
    if (!Number.isSafeInteger(size) || size > expectedBytes) throw new Error('Destination exceeds expected length');
    hash.update(chunk);
  }
  return { bytes: size, sha256: hash.digest('hex') };
}

/**
 * Transfers one object, verifies the destination by independently reading its
 * bytes, and then deletes the stage object with HEAD readback.
 *
 * The caller MUST supply the known-good original SHA-256 and size. If any
 * step fails, the stage object is retained (except when delete was already
 * attempted); caller should inspect error.phase and reconcile manually.
 */
export async function transferStagedObject(args) {
  validate(args);
  const { transferId, stageKey, destinationId, expectedSha256, expectedBytes, stage, destination } = args;
  const sha = expectedSha256.toLowerCase();
  let phase = 'read-source';
  let verified = false;
  try {
    if (!(await stage.head(stageKey))) throw new Error('Staging object missing');
    const state = { hash: createHash('sha256'), bytes: 0, expectedBytes, complete: false };
    const sourceStream = await contentOf(stage, stageKey);
    phase = 'write-destination';
    await destination.write(destinationId, digestStream(sourceStream, state));
    if (!state.complete) throw new Error('Destination writer did not fully consume source');
    if (state.bytes !== expectedBytes || state.hash.digest('hex') !== sha) throw new Error('Staged source does not match the expected original');
    phase = 'verify-destination';
    const destinationStream = await contentOf(destination, destinationId);
    const check = await computeDigest(destinationStream, expectedBytes);
    if (check.bytes !== expectedBytes || check.sha256 !== sha) throw new Error('Destination checksum or size mismatch');
    verified = true;
    phase = 'delete-stage';
    await stage.delete(stageKey);
    phase = 'confirm-stage-deletion';
    if (await stage.head(stageKey)) throw new Error('Staged object still exists after delete');
    return { ok: true, transferId, destinationId, bytes: expectedBytes, sha256: sha, destinationVerified: true, stagingDeletionConfirmed: true };
  } catch (error) {
    throw new TransferVerificationError(\`Transfer failed at \${phase}: \${error.message}\`, phase, verified, error);
  }
}
