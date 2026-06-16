# BUAP v1.0.0 Release Notes

BUAP v1.0.0 is the first complete stable release of the Buddy Universal Agent Profile: a portable, tool-agnostic behavior standard for the Prismtek/Buddy ecosystem.

## Highlights

- Formal Buddy and Lil' Buddy orchestration loop.
- Runtime contract, capability declaration, and failure-mode recovery.
- Memory discipline for source-backed continuity.
- Multi-agent negotiation and universal agent fingerprint.
- Prismtek/Buddy ecosystem routing maps.
- Local-first runtime guidance.
- Conformance tests and receipt schema.
- Prompt tiers for Lite, Standard, and Full contexts.
- Adapters and overlays for repo-aware agents, low-context chats, ChatGPT Projects, and Symphony-style multi-agent setups.

## Added

- `standards/runtime-contract.md`
- `standards/failure-modes.md`
- `standards/memory-discipline.md`
- `standards/multi-agent-negotiation.md`
- `standards/universal-agent-fingerprint.md`
- `integrations/prismtek-ecosystem-map.md`
- `integrations/local-first-runtime.md`
- `tests/conformance/orchestration-loop.expected.md`
- `chatgpt-projects/buddy/knowledge/EXTERNAL_OVERLAYS.md`
- `BUAP_KERNEL.md`

## Changed

- Strengthened `AGENTS.md`, `BUDDY_PROFILE.md`, `LIL_BUDDY_PROFILE.md`, and `BUAP_FULL.md`.
- Updated Lite, Standard, and paste-anywhere prompt tiers.
- Added optional Ponytail and Caveman overlay guidance across core prompt surfaces and adapters.
- Clarified how BUAP uses real workers when available and emulates Lil' Buddy when not.

## Validation

This release is documentation/spec oriented. Validation is based on repository inspection, changed-file review, and conformance prompt coverage. Runtime-specific behavior should still be checked in the target tool using `tests/conformance/`.

## Compatibility

BUAP v1.0.0 remains a behavior/orchestration standard. It does not add a daemon, scheduler, shell, sub-agent process, or durable memory database by itself. Those capabilities must come from the active runtime or the owning Buddy ecosystem repos.