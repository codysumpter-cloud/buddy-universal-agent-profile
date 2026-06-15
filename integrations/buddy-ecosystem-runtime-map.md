# Buddy Ecosystem Runtime Map

## Purpose

Give BUAP-compatible agents a concrete routing map for the Buddy ecosystem.

BUAP is the portable behavior profile. It should not become the runtime owner. Instead,
it routes to the repo that owns the relevant truth or execution surface.

## Runtime ownership map

| Need | Owning repo | BUAP action |
|---|---|---|
| Durable graph memory, public-safe knowledge, searchable decisions/tasks | `knowledge-vault` | Read Vegapunk Brain context; prepare public-safe events/handoffs. |
| Governance, policy, council, operator runbooks, skills registry | `buddy-brain` | Load operator rules; defer policy/council decisions. |
| Guarded execution, action/session validation, risk policy, receipts | `buddy-agent` | Route executable work through Orchestrator/Worker contracts. |
| Device voice/vision/local model/transport runtime | `omni-buddy` | Route hardware/runtime claims to Omni validation and receipts. |
| User-facing products, apps, games, downloads | `prismtek-apps` | Verify product behavior in product repo, not profile docs. |
| Portable install prompts, conformance tests, adapters | `buddy-universal-agent-profile` | Provide behavior and routing standard only. |

## External instruction overlays

| Need | Owning repo | BUAP action |
|---|---|---|
| Minimal-code implementation discipline, YAGNI pressure, stdlib/native-first coding, over-engineering review | `DietrichGebert/ponytail` | Load as an optional external overlay after BUAP and repo-local instructions; do not treat it as Prismtek runtime ownership. |
| Terse technical communication, output-token compression, compact reviews and commit-message work | `JuliusBrussee/caveman` | Load as an optional external overlay after BUAP and repo-local instructions; do not treat it as Prismtek runtime ownership. |

Ponytail can reduce code size and dependency bloat, but BUAP still owns
capability detection, safety, validation, response format, and source-of-truth
routing. Ponytail never removes required checks for trust boundaries, data loss,
security, accessibility, or real hardware calibration.

Caveman can reduce response length and output-token use, but BUAP still owns
clarity for safety warnings, irreversible-action confirmations, validation
evidence, source-backed labels, blockers, and ordered instructions.

## Default cross-repo task flow

1. **Capability check** — determine what repos/tools are accessible.
2. **Knowledge Vault read** — search durable graph/index context when available.
3. **Buddy Brain policy check** — load governance/council/runbook context for decisions.
4. **Owning repo inspection** — inspect the implementation repo for current truth.
5. **Buddy Agent execution** — route executable actions through guarded runtime when available.
6. **Omni validation** — use Omni only for local/device runtime claims.
7. **Receipt capture** — record validation, blockers, and source paths.
8. **Knowledge Vault event** — prepare or emit a public-safe graph event after meaningful work.

## Status labels

- **Source-backed:** supported by repo docs/source files.
- **Runtime-verified:** checked by owning runtime command/tool.
- **Device-verified:** checked on actual target device/hardware.
- **Blocked:** missing repo access, tool, runtime, device, or credential.
- **Handoff-ready:** BUAP produced a complete next-agent/human handoff.

## Anti-duplication rule

If a feature belongs to Knowledge Vault, Buddy Brain, Buddy Agent, Omni Buddy, or
Prismtek Apps, BUAP must link to that owner and route work there. BUAP may define
portable behavior, install prompts, test prompts, and handoffs, but it should not fork
or duplicate runtime logic.
