# @prismtek/buap-acp-agent

Local stdio Agent Client Protocol server for loading BUAP into Xcode or any ACP-compatible editor/client.

This package now implements the next ACP permissioned actions upgrade on top of the guarded Buddy runtime layer: ACP session lifecycle, BUAP loading, Buddy/Lil Buddy personalization, workspace-safe file reads, patch proposals, permission-gated editor-mediated writes, permission-gated terminal runs, read-only Git helpers, MCP context reporting, slash command advertisement after `session/new`, and an optional OpenAI-compatible model backend.

## What it supports

- newline-delimited JSON-RPC over stdio
- `initialize`
- `session/new` (emits `session/update` `available_commands_update` advertising every `/buap ...` command)
- `session/prompt`
- `session/cancel`
- `session/close`
- `buap/status` diagnostic method
- BUAP file loading
- BMO council profile loading
- first-run personalization for:
  - `user_display_name`
  - `buddy_display_name`
  - `lil_buddy_display_name`
  - `buddy_profile_id`
  - `lil_buddy_profile_id`
- guarded runtime commands:
  - `/buap help`
  - `/buap profiles`
  - `/buap personalize user="..." buddy="..." lil_buddy="..." buddy_profile=bmo lil_buddy_profile=finn`
  - `/buap read path=README.md`
  - `/buap patch path=README.md find="old" replace="new"`
  - `/buap apply path=README.md find="old" replace="new"` (permission-gated, editor-mediated `fs/write_text_file`)
  - `/buap ask prompt="..."`
  - `/buap run cmd="npm" args="test"` (permission-gated, ACP `terminal/create` + `terminal/wait_for_exit` + `terminal/output` + `terminal/release`)
  - `/buap git status`
  - `/buap git diff path=README.md`
  - `/buap mcp`
  - `/buap mcp invoke server="..." tool="..." payload="..."` (blocked planning response)

## ACP surfaces wired by the upgrade

- `session/update` `tool_call` / `tool_call_update` for `/buap apply` and `/buap run`.
- `session/request_permission` before every file write or terminal command.
- `fs/read_text_file` (when advertised by the client) for `/buap read` and `/buap patch`.
- `fs/write_text_file` (when advertised by the client) for `/buap apply`. Workspace file writes never use Node `fs.writeFile`.
- `terminal/create`, `terminal/wait_for_exit`, `terminal/output`, `terminal/release` (when advertised by the client) for `/buap run`. Uses `command` + `args[]`, never `sh -c`.
- `available_commands_update` broadcast right after every `session/new`.

## Capability handling

`/buap apply` refuses unless `clientCapabilities.fs.writeTextFile === true`. `/buap run` refuses unless `clientCapabilities.terminal === true`. Both still appear in `available_commands_update` so editors can advertise them, but the command handlers return a clearly worded blocked response when the capability is missing and point to `/buap patch` (for apply) or the current git/smoke commands (for run) as safe fallbacks.

## MCP policy

`/buap mcp invoke` does not call any MCP tool. The blocked Lil Buddy report lists:

- requested server, tool, and payload;
- available session MCP server config;
- reason it is blocked ("MCP-over-ACP transport and permission policy are not implemented in this agent.");
- next implementation requirement.

## Local setup

From this package folder:

```bash
npm install
npm run smoke
npm run build
```

Run the agent directly:

```bash
node dist/index.js
```

For development without building:

```bash
npm run dev
```

## Xcode / ACP local command

Until the package is published, point the ACP client at the built local command:

```bash
node /absolute/path/to/buddy-universal-agent-profile/packages/buap-acp-agent/dist/index.js
```

Optional environment:

```bash
BUAP_REPO_ROOT=/absolute/path/to/buddy-universal-agent-profile
BUAP_WORKSPACE_ROOT=/absolute/path/to/workspace
BUAP_PERSONALIZATION_FILE=/absolute/path/to/.buap/personalization.json
BUAP_MAX_READ_BYTES=20000
BUAP_GIT_TIMEOUT_MS=10000
BUAP_TERMINAL_OUTPUT_LIMIT=1048576
BUAP_CLIENT_REQUEST_TIMEOUT_MS=300000
```

`BUAP_REPO_ROOT` is useful when the command is launched from outside this repo. `BUAP_WORKSPACE_ROOT` provides a fallback workspace if the ACP session does not include `cwd`. `BUAP_PERSONALIZATION_FILE` enables local personalization persistence. Without it, personalization is held in memory for the current agent process. `BUAP_TERMINAL_OUTPUT_LIMIT` controls the byte cap passed to `terminal/create`.
`BUAP_CLIENT_REQUEST_TIMEOUT_MS` controls how long the agent waits for editor responses to ACP client requests such as `session/request_permission`, `fs/write_text_file`, and terminal calls.

## Optional model backend

The local runtime works without a model. To route `/buap ask` to an OpenAI-compatible `/chat/completions` endpoint, set:

```bash
BUAP_MODEL_BACKEND=openai-compatible
BUAP_MODEL_BASE_URL=https://api.openai.com/v1
BUAP_MODEL_NAME=gpt-4.1-mini
BUAP_MODEL_API_KEY=...
BUAP_MODEL_TEMPERATURE=0.2
```

The backend can also point at a local or private OpenAI-compatible gateway.

## First-run command

When the agent asks for setup, reply:

```text
/buap personalize user="Cody" buddy="Buddy" lil_buddy="Finn" buddy_profile=bmo lil_buddy_profile=finn
```

Use `/buap profiles` to list available BMO council profiles.

## Safety behavior

- File reads are workspace-confined and block path traversal.
- `/buap patch` generates a diff proposal only; it does not write to disk.
- `/buap apply` calls `session/request_permission` and writes only via `fs/write_text_file` after the user allows.
- `/buap run` calls `session/request_permission` and uses `command` + `args[]` through ACP `terminal/create` (no shell string interpolation).
- Git helpers are read-only `status` and `diff` commands.
- MCP server configs passed by the ACP client are reported; `/buap mcp invoke` returns a blocked planning response until ACP/MCP capability and permission handling is implemented.
