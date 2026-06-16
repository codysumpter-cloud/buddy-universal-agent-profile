# BUAP Cross-reference Matrix

This matrix maps the major BUAP surfaces so adopters can find the right file for a runtime, prompt tier, adapter, or validation need.

## Standards to prompt tiers

| Standard | Kernel | Lite | Standard | Full | System prompt |
|---|---:|---:|---:|---:|---:|
| `standards/orchestration.md` | Summary | Summary | Summary | Required | Required |
| `standards/capability-detection.md` | Summary | Summary | Summary | Required | Required |
| `standards/capability-negotiation.md` | Summary | Related | Summary | Required | Summary |
| `standards/runtime-contract.md` | Related | Implied | Summary | Required | Summary |
| `standards/failure-modes.md` | Implied | Implied | Summary | Required | Summary |
| `standards/memory-discipline.md` | No | No | Implied | Required | Summary |
| `standards/multi-agent-negotiation.md` | No | No | Implied | Required | Implied |
| `standards/multi-agent-arbitration.md` | No | No | Summary | Required | Implied |
| `standards/universal-agent-fingerprint.md` | Related | Related | Related | Optional | Related |
| `standards/validation.md` | Summary | Summary | Summary | Required | Required |

## Standards to adapters

| Adapter | Primary BUAP file | Overlay posture |
|---|---|---|
| `adapters/AGENTS.template.md` | `AGENTS.md` | Optional Ponytail/Caveman after BUAP and repo-local rules |
| `adapters/CLAUDE.template.md` | `CLAUDE.md` | Optional overlays after Claude/repo-local guidance |
| `adapters/CODEX.template.md` | `CODEX.md` and `AGENTS.md` | Optional overlays after Codex/repo-local guidance |
| `adapters/custom-gpt-instructions.template.md` | `BUAP_STANDARD.md` | Lightweight overlay sentence when space allows |
| `adapters/chatgpt-project-instructions.template.md` | `chatgpt-projects/buddy/00_PROJECT_INSTRUCTIONS_PASTE.md` | Uses project knowledge file for overlays |
| `adapters/windsurf-rules.template.md` | `AGENTS.md` | Optional overlays after BUAP/repo-local rules |
| `GROK_BUAP.md` | `BUAP_STANDARD.md` + Grok/xAI identity overlay | Keeps Grok as the named runtime while preserving BUAP roles, claim labels, capability negotiation, and safety rules |

## Standards to tests

| Standard area | Conformance coverage |
|---|---|
| Orchestration and re-brief loop | `tests/conformance/orchestration-loop.expected.md` |
| Capability negotiation | `tests/conformance/capability-negotiation.expected.md` |
| Multi-agent arbitration | `tests/conformance/multi-agent-arbitration.expected.md` |
| Verification and receipts | `tests/conformance/README.md`, evaluator rubric when present |
| Blocked-mode handoff | `tests/conformance/README.md` required behaviors |
| Runtime capability selection | `tests/conformance/orchestration-loop.expected.md`, `tests/conformance/capability-negotiation.expected.md` |

## Schemas

| Need | File |
|---|---|
| Success/evidence receipts | `schemas/receipt.schema.json` |
| Runtime/tool capability declarations | `schemas/capability-declaration.schema.json` |

## Automation

| Need | File |
|---|---|
| Local docs/spec check | `scripts/buap-conformance-check.mjs` |
| GitHub Actions check | `.github/workflows/buap-conformance.yml` |

## Integrations

| Need | File |
|---|---|
| Canonical cross-repo routing | `integrations/ecosystem-routing-spec.md` |
| Cross-repo owner overview | `integrations/prismtek-ecosystem-map.md` |
| Runtime ownership details | `integrations/buddy-ecosystem-runtime-map.md` |
| Local/offline/partial connectivity | `integrations/local-first-runtime.md` |
| ChatGPT Project overlays | `chatgpt-projects/buddy/knowledge/EXTERNAL_OVERLAYS.md` |
| Symphony multi-agent roles | `openai-symphony-agent-pack/SYMPHONY_AGENT_PACK.md` |
| Grok/xAI copy-paste profile | `GROK_BUAP.md` |

## Maintenance rule

When a new standard, adapter, schema, automation surface, or integration is added, update this matrix in the same PR.
