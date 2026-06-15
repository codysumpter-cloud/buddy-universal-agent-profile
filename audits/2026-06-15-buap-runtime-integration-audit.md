# BUAP Runtime Integration Audit — 2026-06-15

## Scope

Audit BUAP against the current Buddy ecosystem repos and ensure the profile knows how
to route through Knowledge Vault, Buddy Brain, Buddy Agent, and Omni Buddy.

Audited repos:

- `codysumpter-cloud/buddy-universal-agent-profile`
- `codysumpter-cloud/knowledge-vault`
- `codysumpter-cloud/buddy-brain`
- `codysumpter-cloud/buddy-agent`
- `codysumpter-cloud/omni-buddy`

## Executive finding

BUAP already names the correct source-of-truth order and ecosystem repos, but before
this audit it did not provide enough operational detail for an arbitrary AI agent to
use Knowledge Vault's Vegapunk Brain runtime correctly.

This pass adds explicit linked-repo metadata and runtime integration docs so BUAP can
route work across the ecosystem without treating repo names as decorative references.

## Verified ecosystem facts

### Knowledge Vault / Vegapunk Brain

Verified from `knowledge-vault`:

- Vegapunk Brain is designed as an event-sourced shared-memory platform.
- Ecosystem repos emit immutable events into the Vegapunk Brain inbox.
- Vegapunk Brain routes events, compiles graph records, generates indexes/search, and
  supports future sessions.
- Durable runtime layers include event schema, emitter examples, inbox, processed
  events, compiler, rebuilder, outbox graph records, indexes, health, and export.
- Recovery rebuilds from `graph/seed.graph.jsonl`, `inbox/processed/**`, and emitter
  examples when processed events do not exist.
- Current limitation: satellite repositories still need native event emitters wired
  into their task/session/release flows.

### Buddy Agent

Verified from `buddy-agent`:

- Buddy Agent is the guarded execution boundary for Buddy actions.
- It defines an Orchestrator/Worker loop with typed sessions, delegations, worker
  reports, risk classification, approvals, and sanitized receipts.
- Public-alpha behavior allows read-only and draft-only actions by default, confirms
  write/external/repo mutation actions, and denies credential/money/identity/destructive
  classes by default.
- Buddy Agent parity docs treat Buddy Brain, Omni Buddy, and Knowledge Vault as owned
  external surfaces with their own validation commands and boundaries.

### Buddy Brain

Verified from `buddy-brain`:

- Buddy Brain is the operator-side source of truth for Buddy / BeMore.
- It owns durable context, policy, council roles, operator runbooks, runtime posture,
  skills registry, sync helpers, and coordination contracts.
- Product/runtime repos should consume Buddy Brain contracts instead of inventing a
  second source of truth.
- Its system boundary table explicitly maps `buddy-agent`, `prismtek-apps`,
  `omni-buddy`, and `knowledge-vault` roles.

### Omni Buddy

Verified from `omni-buddy`:

- Omni Buddy is a Raspberry Pi / local multimodal voice, vision, local model, and
  device runtime path.
- It supports Ollama, Whisper.cpp, OpenWakeWord, Piper TTS, camera vision via Moondream,
  Omni endpoint routing, local fallback, transport modes, runtime profile presets,
  latency profile presets, doctor scripts, and validation matrix checks.

## BUAP gaps before this pass

- No linked-repo manifest existed for machine-readable ecosystem repo routing.
- No Knowledge Vault runtime usage contract existed inside BUAP.
- No explicit rule told agents when to read Vegapunk Brain indexes versus when to emit
  a public-safe event/summary.
- No BUAP-facing map tied Buddy Brain governance, Buddy Agent execution, Omni Buddy
  device runtime, and Knowledge Vault memory runtime into one operating model.
- BUAP source order was correct but under-specified for real task routing.

## Changes made in this pass

- Added `linked-repos/buddy-ecosystem.repos.json`.
- Added `integrations/knowledge-vault-runtime.md`.
- Added `integrations/buddy-ecosystem-runtime-map.md`.
- Added `integrations/buddy-brain.md`.
- Added `integrations/buddy-agent.md`.
- Added `integrations/omni-buddy.md`.
- Added `runbooks/knowledge-vault-runtime-consumption.md`.
- Updated README, AGENTS, SYSTEM prompt, and BUAP_FULL references.

## Recommendation

Keep BUAP as the portable profile, not the runtime owner. BUAP should link to and route
through the owning repos:

- Knowledge Vault owns durable graph memory and Vegapunk Brain runtime.
- Buddy Brain owns governance, policy, council, and operator context.
- Buddy Agent owns guarded execution, approvals, action risk, and receipts.
- Omni Buddy owns local device/voice/vision/transport runtime.

Do not vendor these repos into BUAP. Link them through a manifest and integration docs
so BUAP stays universal and lightweight.
