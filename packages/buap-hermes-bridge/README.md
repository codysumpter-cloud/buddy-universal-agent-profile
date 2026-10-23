# @prismtek/buap-hermes-bridge

**BUAP identity + Hermes execution.** This adapter allows the BUAP ACP host to talk to an already running, authenticated Hermes API Server. It **does not vendor Hermes or magically implement its 60+ tools**. Browser, terminal, memory, skills, subagents, cron, messaging, TTS and MCP are still configured and operated by Hermes itself. No ChatGPT Codex calls are made by this library; inference costs depend on your Hermes provider.

## Configure the local Hermes host

In the Hermes host configuration, enable the official API server, bind loopback and set your own strong key (details: https://hermes-agent.nousresearch.com/docs/reference/environment-variables):

```sh
API_SERVER_ENABLED=true
API_SERVER_HOST=127.0.0.1
API_SERVER_PORT=8642
API_SERVER_KEY=<your-secret>
```

Then set these in the **BUAP ACP process** environment (not in Git):

```sh
BUAP_HERMES_BASE_URL=http://127.0.0.1:8642/v1
BUAP_HERMES_API_KEY=<same-secret>
BUAP_HERMES_MODEL_NAME=hermes-agent
BUAP_MODEL_BACKEND=hermes
```

In the BUAP ACP prompt:

- `/buap hermes status` — local configuration and capability inventory; never prints the key
- `/buap hermes probe` — read-only authenticated `GET /v1/models`; verifies connectivity, **not** tool availability
- `/buap ask prompt="..." ` — delegates the turn to Hermes `POST /v1/chat/completions`

No Hermes instance is installed, launched, reconfigured or activated by this package. To operate from a different machine, use a separately authenticated HTTPS endpoint plus `BUAP_HERMES_ALLOW_REMOTE=1` and the exact hostname in `BUAP_HERMES_ALLOWED_HOSTS`. Bare HTTP remote endpoints, embedded credentials, URL query strings and redirects are refused.

## What is actually supported?

The bridge invokes the official OpenAI-compatible `/v1/models` and `/v1/chat/completions` endpoints, and carries BUAP's identity into the agent turn. It can access whatever Hermes skills and tools the *server* legitimately exposes to that session. The API bridge does **not** directly manage cron jobs, messaging accounts, bot processes, voice calls, plugins, toolsets, model pools, or device privileges. Set those up through Hermes's own interfaces, and verify each in its actual host.

All tool execution and approval policy is under the Hermes host's control; use its safe-mode, command approvals, platform allowlists and constrained toolsets for sensitive work. **Treat `/buap ask` with a tool-enabled Hermes host as capable of side effects.** Do not grant unsupervised publishing, purchases, account mutations or destructive tools.

## Tests

`cd packages/buap-hermes-bridge && npm test` exercises loopback/remote policy, authentication redaction, connection probes, chat request shape, no implicit retries and malformed responses without starting Hermes or contacting public services.

## ACP conversation context

BUAP ACP keeps a bounded in-memory conversation history per session and sends prior user/assistant turns to Hermes with the next request. The history is **not durable**, and is cleared on ACP session close; Hermes may separately retain its own server-side records. Never claim that this bridge syncs conversations across messaging apps or reinstates crashed processes. Request timeouts cannot guarantee cancellation of work already accepted by Hermes; do not blindly retry side-effecting requests.

## Direct local Hermes CLI fallback

A running Hermes API server is **not required** on the same host if the official `hermes` command is installed and authenticated. Use `BUAP_MODEL_BACKEND=hermes-cli`. BUAP ACP then delegates with `hermes chat --oneshot --query-file - --quiet`; input is sent through **stdin**, never shell-interpreted or embedded in the process arguments. The Hermes gateway, skill registry, tools, permissions, memory, models, cron and messaging remain Hermes-managed.

Check the binary with `/buap hermes cli-probe` (local version only). An ACP client must explicitly grant `session/request_permission` **for each CLI agent turn** because a Hermes host may have side-effecting tools. The CLI helper does not automatically install Hermes, configure a gateway, change the Hermes permission policy or retry timed-out tasks. It launches a finite one-shot Hermes turn, not a persistent streaming session; Hermes maintains any durable memory on its side. A local CLI model/provider and Hermes gateway must be configured for real results.
