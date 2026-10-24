# Prismtek Agent Fleet — portable BUAP profiles

18 specialist identities reside in [`examples/prismtek-agent-fleet-profiles.json`](../examples/prismtek-agent-fleet-profiles.json) and conform to `schemas/agent-profile.schema.json`. The first profile is a user-facing Buddy relationship role, not a forced proper name. Other display names are functional defaults that the owner may customize.

## Authority boundaries
- **BUAP** is authoritative for portable identity, mission, memory namespace, action rules, capability symbols, approval policy and handoff contract.
- **prismtek-site Supabase** `public.agent_workers` is the current verified private **operational roster**. Its 18 rows were seeded on 2026-10-23 and are all **standby**, inference call caps zero. It must not be mislabeled an executing agent host.
- **Cloudflare** hosts real deployed Buddy Messenger, Dispatcher, Gatekeeper, Social MCP, and `prismtek-api`. The existing five-minute Dispatcher can acknowledge audit events; it does **not** consume Supabase jobs yet. Deployed `prismtek-api` is currently only a status responder, not a working NVIDIA gateway.
- **Hermes** is a separate possible host. If real Hermes bridge checks fail, no agent may label Hermes subagents, tools, message sending, or inference alive based on a BUAP profile alone.
- **Work/LL Brown Cloudflare** is a separate organization context. Its configuration was consulted read-only to understand architecture; never transfer its customer data, private Workers, NVIDIA secret, or access permissions into Prismtek.

## One NVIDIA key, 18 identities
Each profile declares the symbolic `prismtek-inference-broker` optional capability. A verified host binds this to the **single** protected `prismtek-api` inference service using a Cloudflare service binding and a *separate* service-to-service auth credential. Only that service should retain the NVIDIA vendor key after reviewed migration. Agents never see it.

The `prismtek-site` draft [PR #804](https://github.com/codysumpter-cloud/prismtek-site/pull/804) contains website UI and the staged fail-closed gateway code, quota schema and rollout guardrails. A second draft [PR #803](https://github.com/codysumpter-cloud/prismtek-site/pull/803) adds authenticated owner-driven dry-run receipts. Neither is evidence of enabled paid model inference or of 18 autonomous workers.

Never claim two existing Cloudflare `NVIDIA_API_KEY` secret bindings contain identical values: secret content is intentionally unreadable. Do not remove an existing binding or copy a credential across accounts without appropriate authorization, rollout evidence, and recovery capability.

## Safeties and activation checklist
- Model inference starts disabled; daily cap zero. Explicitly approve a nonzero shared quota and select a currently available NVIDIA model before a provider request.
- Do not activate arbitrary background scheduling from a profile alone. Require a connected runtime that supports jobs, authentication, budgets, finite retries, secure logs, and persistent receipts.
- Keep personal outbound email, posts, DMs, paid campaigns, purchases, production changes and account/security operations approval-gated. Prompt text and third-party content remain untrusted.
- Verify portables against the profile schema and host capability checks, and verify private Supabase state against RLS and the actual job queue.
- Protect source-of-truth distinctions: a profile is an instruction contract, a roster is a database record, and a worker is active only when proven by an execution receipt.
