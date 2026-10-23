# BUAP + Hermes capability compatibility and execution contract

**Owner goal (2026-10-23): BUAP should be able to do everything Hermes Agent can do.** The architecture is **BUAP = portable identity/agent profiles/policy + Hermes = real host engine**. Do not revive the archived `codysumpter-cloud/hermes-agent` fork or `prismtek-apps`. Current upstream reference: https://hermes-agent.nousresearch.com/docs/user-guide/features/overview

## Scope and evidence

BUAP's native ACP adapter can run guarded file operations, commands, agent personalization and model calls, but did not include a Hermes gateway, terminal/browser sandbox, independent cron daemon or messaging adapters. This change adds an authenticated client to the official Hermes API Server, not a fork. It is **not standalone 100% functional parity** without an installed Hermes server and configured host toolsets.

| Hermes capability | BUAP handling after this change | Validation needed to call it working |
| --- | --- | --- |
| Agent inference, reasoning/model tool turns | **Implemented adapter**: API `/v1/chat/completions` with BUAP persona and bounded ACP conversation context | Live Hermes server + authenticated probe/ask with model/provider |
| Model providers, routing/fallback and credential pools | **Hermes-managed**, not BUAP native | Live Hermes model/fallback config and observed failover |
| Terminal/process/file edit and checkpoint/rollback | **Hermes-managed** with Hermes-specific approvals, plus separate ACP guarded read/write/terminal tools | Tool-enabled Hermes server, permission challenge, test edit + rollback |
| Web search, extraction, X search | **Hermes-managed** | Configured toolset/provider and test search |
| Browser automation/vision | **Hermes-managed** | Browser backend, scoped session and verified browser interaction |
| Image gen, vision, audio transcription, TTS, wake word | **Hermes-managed** | Explicit media provider setup, permissions, real mic/camera/audio test |
| Skills self-learning, memory nudges, skill hub and on-demand loading | **Hermes-managed**; BUAP prompts/personas and portable skills remain source files | Skill creation + retrieval verified inside Hermes |
| Long-term memory and session search/compaction | **Hermes-managed**; BUAP ACP only holds bounded non-durable history | Verify Hermes state/session reuse and connected memory provider |
| Scheduled cron jobs, recurring delivery, event hooks | **Hermes-managed**, no BUAP scheduler installed by bridge | List/add/pause scheduled job inside authenticated Hermes with explicit approval |
| True parallel isolated subagents | **Hermes-managed** via delegate_task; BUAP Lil' Buddy emulates if unavailable | Spawn real child and inspect receipts/resource limits |
| MCP tools and plugins | **Hermes-managed**; BUAP ACP has separate client tool declaration | Verify installed plugin/tool and one authorized call |
| Messaging gateway (Telegram/Discord/Slack/WhatsApp/etc.) | **Hermes-managed**, no messaging accounts connected by bridge | Gateway service, user allowlist and inbound/outbound test |
| Bot Mode team agents, personas, per-bot memory | **Hermes-managed** with BUAP agent profiles as intent layer | Bot-mode configuration and routed session test |
| CLI/TUI/Desktop/native multi-platform app | **Not replaced by BUAP**; use Hermes interfaces alongside BUAP | Native host installation and UI smoke |
| Batch trajectories, code-execution RPC, training | **Hermes-managed** | Host capability check and sample finite run |
| OpenAI-compatible API server | **Implemented client integration**, disabled by default | `/buap hermes probe` and live completion |
| ACP editor protocol, BUAP identity and guardrails | **BUAP native** | ACP build, smoke, permission-handling tests |
| Automatic full feature detection | **Not implemented**: `/models` handshake proves API reachability only | Actual tool registry and runtime policy must be verified inside Hermes |

## Opt-in setup

Install and configure Hermes using its official documentation, **not** the archived Prismtek Hermes fork:

- https://hermes-agent.nousresearch.com/docs/reference/environment-variables
- https://hermes-agent.nousresearch.com/docs/user-guide/features/tools
- https://hermes-agent.nousresearch.com/docs/user-guide/features/overview

Configure **Hermes server** to bind its authenticated API Server locally with `API_SERVER_ENABLED=true`, `API_SERVER_HOST=127.0.0.1`, `API_SERVER_PORT=8642` and a private `API_SERVER_KEY`. Configure **BUAP ACP** using:

```sh
BUAP_MODEL_BACKEND=hermes
BUAP_HERMES_BASE_URL=http://127.0.0.1:8642/v1
BUAP_HERMES_API_KEY=<same private server key>
BUAP_HERMES_MODEL_NAME=hermes-agent
```

For remote hosts only: TLS endpoint, explicit `BUAP_HERMES_ALLOW_REMOTE=1` **and** exact `BUAP_HERMES_ALLOWED_HOSTS` hostname. Do not expose loopback server to the internet or check in any key.

After local setup in ACP: `/buap hermes status` (offline safe), `/buap hermes probe` (read-only), `/buap ask prompt="Summarize this project"` or normal chat (after profile personalization) when backend is Hermes. The bridge does not start a daemon, install models, spend inference tokens on its own, or activate a Hermes account.

**Security:** A tool-enabled Hermes API can perform external actions. Configure Hermes safe mode, toolsets, approvals, sandbox isolation, credential scopes, gateway user allowlists and privacy boundaries **before** permitting unsupervised execution. Requests do not automatically retry after errors/timeouts because the first attempt may have executed. A timed-out client request does not guarantee that Hermes cancelled the task. Avoid enabling unrestricted purchases, publishing, external DMs, destructive repo writes, credentials or financial actions.

## Validation and priorities

1. The mocked Hermes HTTP compatibility/security tests and BUAP conformance must pass CI.
2. ACP must compile and smoke-check using Node 22, accounting for its macOS-only Apple Notes dependency. These are source compatibility checks, not a live Mac acceptance test.
3. Use a test Hermes gateway with no production credentials, enable API, configure only safe toolsets; prove authenticated chat, memory and one approved file action.
4. Enable dedicated host features **one at a time**: browser, skills, MCP, delegation, cron, voice, bot/messaging. Document a command/output receipt for each rather than claiming instant parity.
5. Keep BUAP agent profiles as the portable standards and `prismtek-site` as the website UI; move no work into archived repos.

## Status

**Implemented in BUAP source:** authenticated API transport, hardened endpoint policy, model handshake, model turn delegation, bounded non-durable ACP context, safe configuration report, mocked tests.

**Not verified here:** a reachable installed Hermes instance, configured providers or credentials, actual terminal/browser/cron/delegation/messaging workflows, cross-platform apps. Those still depend on host setup and real integration tests.
