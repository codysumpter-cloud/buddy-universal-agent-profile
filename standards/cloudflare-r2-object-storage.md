# Cloudflare R2 object-storage policy — Prismtek & work accounts

**Owner directive (October 23, 2026):** R2 is not a general-purpose warehouse. Use it only when a real object-storage workload warrants it; temporary transfer data **must be removed after verified delivery**. Keep the personal Prismtek and LL Brown/work accounts isolated.

## Verified setup (October 23, 2026, America/Indiana/Indianapolis)

| Account boundary | Private temporary bucket | Public access | Automatic deletion | Multipart abort |
| --- | --- | --- | --- | --- |
| Prismtek personal Cloudflare | `prismtek-transfer-staging` | Disabled; no custom domain | All objects at age 72 hours | Incomplete uploads at age 24 hours |
| LL Brown work Cloudflare | `llbrown-transfer-staging` | Disabled; no custom domain | All objects at age 72 hours | Incomplete uploads at age 24 hours |

Both buckets were **empty at last verification**. No existing production Workers or Pages projects were attached to them. Re-check account state through live Cloudflare APIs before claims or changes; this snapshot is not an inventory service.

## Storage ownership

- **GitHub** (in the appropriate active repo) is the durable source of truth for source code, authored game assets, build manifests, release metadata, and project history. Use Git LFS / GitHub Releases or another deliberately selected durable artifact provider for large release binaries. Do **not** park whole game builds in R2 just because it is convenient.
- **R2** is appropriate for deliberately deployed, large binary objects that must be served as objects, or for **bounded temporary staging** during transfer. Do not create persistent R2 buckets or bind production Workers just to use available quota.
- **D1 / project database** owns relational and structured application records, leads, agent metadata and job state. **KV** is for small configuration / key-value lookup or caching where suitable. **Secrets** belong in secret stores, never a bucket or public asset.
- Work-account data stays with the work account; Prismtek personal data stays with Prismtek. No cross-account copies without explicit authorization, classification review, and verified destination. Honor existing access restrictions and record retention requirements.

## Mandatory transfer contract

1. Confirm that the destination is authorized, durable, and appropriate for this material; determine the transfer's source and destination accounts and whether the payload contains secrets/private customer data. Prefer direct-to-destination transfers when viable; R2 staging is optional, never required.
2. If R2 staging is needed, use the matching account's private `*-transfer-staging` bucket and a unique transfer-scoped prefix. Restrict access to an explicitly authorized transfer principal with least-privilege object permissions. Do not enable `r2.dev`, public custom domains, permissive browser CORS, or general-purpose Worker bindings.
3. Upload, then verify uploaded size and SHA-256 when available. Transfer to the authorized durable destination. Verify that **destination** bytes, checksum and/or provider-reported integrity match the source and that the destination is readable before deleting staged data.
4. **Delete all staged objects for that transfer immediately after successful destination verification.** Check deletion using R2 HEAD/list or object metadata read-back; log transfer ID, destination reference, checksum/size, deletion outcome and any residual keys without logging contents or secrets. Do not claim cleanup if confirmation fails.
5. On failed transfers, do not delete the only copy, but do alert and retry or preserve a separately authorized durable source. R2 lifecycle expiry after 72 hours is a hard safety backstop, **not** a guarantee that a destination copy exists. A transfer process must complete and verify well before expiration. Abort incomplete uploads after 24 hours.
6. Periodically inspect bucket object count, age, total bytes, lifecycle rules, public-domain state, CORS and Worker/Page bindings. Empty buckets are desirable. Any unexpected object or binding should trigger investigation, not automatic deletion without confirming its identity.

## Forbidden defaults

- No model weights, customer records, credentials, logs, analytics databases, repository mirrors, application memory, or production build archives placed in transfer buckets by default.
- No automatic cross-account mirroring.
- No retention beyond the short transfer window, no default public URLs, and no blanket permissions for the Buddy agent fleet.
- Do not turn on Infrequent Access storage for 72-hour objects: retrieval fees/minimum duration are a poor fit for short-lived transfers.

## Change control and evidence

Before altering live R2 lifecycle rules, inspect the existing rules and preserve unrelated ones. Record Cloudflare API success **and then GET read-back**; a write response alone is not proof of applied policy. Never confuse R2 activation/subscription with bucket creation, stored objects, a live upload pipeline, or a configured Worker binding.

See also Cloudflare's [R2 object lifecycle documentation](https://developers.cloudflare.com/r2/buckets/object-lifecycles/) and [Workers R2 API reference](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
