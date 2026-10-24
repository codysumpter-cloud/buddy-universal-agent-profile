# Runbook — Verified R2 transfer and immediate cleanup

Use this when a file must move through one of the **private** R2 transfer buckets to a durable destination. Prefer moving directly to GitHub Releases, an approved file store or final service whenever R2 staging is unnecessary.

## Implementation

The tested Node.js helper is [`scripts/r2-verified-transfer.mjs`](../scripts/r2-verified-transfer.mjs). Its regression tests are [`tests/r2-verified-transfer.test.mjs`](../tests/r2-verified-transfer.test.mjs).

It **does not deploy an API, grant Cloudflare permissions or automatically connect a bucket**. A runtime must explicitly supply two narrowly scoped adapters:

- `stage`: `open(stageKey)` returns `{body: AsyncIterable<Uint8Array>}`, `head(stageKey)` returns metadata or `null`, and `delete(stageKey)` removes an object from the **private, matching-account staging bucket**.
- `destination`: `write(destinationId, byteStream)` consumes and uploads the *entire* stream, and `open(destinationId)` independently streams back the stored **final** object for verification.

The adapter can wrap official storage SDKs or authenticated provider APIs as appropriate. It must not expose arbitrary object deletion or private account credentials to public sites or untrusted clients. Never use R2 ETags as a substitute for SHA-256.

## Invocation

```js
import { transferStagedObject } from "./scripts/r2-verified-transfer.mjs";

// Supply adapters for the specific approved account and destination; no
// credentials, tokens, or production bindings are embedded in this module.
const receipt = await transferStagedObject({
  transferId: "releaseabc123",
  stageKey: "transfers/releaseabc123/build.zip",
  destinationId: "github-release://owner/repo/v1.0/build.zip",
  expectedBytes: manifest.size,
  expectedSha256: manifest.sha256, // known-good ORIGINAL bytes
  authorized: true, // only after human/policy authorization of destination
  stage: authorizedPrivateR2Adapter,
  destination: verifiedGitHubReleaseAdapter,
});

if (!receipt.stagingDeletionConfirmed) throw new Error("Needs cleanup");
// Record the non-sensitive receipt; do NOT upload the payload or secrets to logs.
```

The call refuses unscoped keys, malformed hashes and missing authorization. It hashes every source byte during upload, hashes the destination on a separate readback, checks length and digest against the *original manifest*, deletes the staged object only after verification, then confirms HEAD returns no object.

## Failure behavior

- **Source missing or mismatched:** fail; do not delete the staged object.
- **Uploader errors, truncates, or does not fully consume the stream:** fail; do not delete.
- **Destination missing or checksum mismatch:** fail; do not delete staging. Investigate any partially uploaded destination copy.
- **Stage deletion throws or HEAD still finds the object:** throw `TransferVerificationError` with `destinationVerified: true`, `stagingDeletionConfirmed: false`. Investigate and repair cleanup, but do not claim success.
- **Transfer TTL:** the 72-hour R2 lifecycle is a backstop, not a durable-retention promise. If a transfer will not finish before expiry, it must restart from the durable source, not rely on R2.

## Validation and integration gates

Run `node --test tests/r2-verified-transfer.test.mjs`. Before enabling a real transfer destination, test a synthetic harmless file end-to-end against that provider: upload, read back the SHA-256, delete stage, confirm empty, and confirm the target remains readable. Require explicit account/secret scopes and sensible object-size and rate limits. No production object transfers or live deletion were performed when this helper was added.

Storage policy: [`standards/cloudflare-r2-object-storage.md`](../standards/cloudflare-r2-object-storage.md).
