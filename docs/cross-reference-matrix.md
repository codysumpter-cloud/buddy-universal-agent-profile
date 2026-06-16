# BUAP Cross-reference Matrix

This matrix maps the major BUAP surfaces so adopters can find the right file for a runtime, prompt tier, adapter, or validation need.

## Standards to prompt tiers

| Standard | Lite | Standard | Full | System prompt |
|---|---:|---:|---:|---:|
| `standards/orchestration.md` | Summary | Summary | Required | Required |
| `standards/capability-detection.md` | Summary | Summary | Required | Required |
| `standards/runtime-contract.md` | Implied | Summary | Required | Summary |
| `standards/failure-modes.md` | Implied | Summary | Required | Summary |
| `standards/memory-discipline.md` | No | Implied | Required | Summary |
| `standards/multi-agent-negotiation.md` | No | Implied | Required | Implied |
| `standards/universal-agent-fingerprint.md` | Related | Related | Optional | Related |
| `standards/validation.md` | Summary | Summary | Required | Required |

## Standards to adapters

| Adapter | Primary BUAP file | Overlay posture |
|---|---|---|
| `adapters/AGENTS.template.md` | `AGENTS.md` | Optional Ponytail/Caveman after BUAP and repo-local rules |
| `adapters/CLAUDE.template.md` | `CLAUDE.md` | Optional overlays after Claude/repo-local guidance |
| `adapters/CODEX.template.md` | `CODEX.md` and `AGENTS.md` | Optional overlays after Codex/repo-local guidance |
| `adapters/custom-gpt-instructions.template.md` | `BUAP_STANDARD.md` | Lightweight overlay sentence when space allows |
| `adapters/chatgpt-project-instructions.template.md` | `chatgpt-projects/buddy/00_PROJECT_INSTRUCTIONS_PASTE.md` | Uses project knowledge file for overlays |
| `adapters/windsurf-rules.template.md` | `AGENTS.md` | Optional overlays after BUAP/repo-local rules |

## Standards to tests

| Standard area | Conformance coverage |
|---|---|
| Orchestration and re-brief loop | `tests/conformance/orchestration-loop.expected.md` |
| Verification and receipts | `tests/conformance/README.md`, evaluator rubric when present |
| Blocked-mode handoff | `tests/conformance/README.md` required behaviors |
| Runtime capability selection | `tests/conformance/orchestration-loop.expected.md` |

## Integrations

| Need | File |
|---|---|
| Cross-repo owner routing | `integrations/prismtek-ecosystem-map.md` |
| Runtime ownership | `integrations/buddy-ecosystem-runtime-map.md` |
| Unified routing | `integrations/ecosystem-routing-spec.md` |
| Local/offline/partial connectivity | `integrations/local-first-runtime.md` |
| ChatGPT Project overlays | `chatgpt-projects/buddy/knowledge/EXTERNAL_OVERLAYS.md` |
| Symphony multi-agent roles | `openai-symphony-agent-pack/SYMPHONY_AGENT_PACK.md` |

## Maintenance rule

When a new standard, adapter, or integration is added, update this matrix in the same PR.