# @prismtek/buap-acp-agent

Local stdio Agent Client Protocol server for loading BUAP into Xcode or any ACP-compatible editor/client.

This package now includes the first guarded Buddy runtime layer: ACP session lifecycle, BUAP loading, Buddy/Lil Buddy personalization, workspace-safe file reads, patch proposals, read-only Git helpers, MCP context reporting, and an optional OpenAI-compatible model backend.

## What it supports

- newline-delimited JSON-RPC over stdio
- `initialize`
- `session/new`
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
  - `/buap read path=README.md`
  - `/buap patch path=README.md find="old" replace="new"`
  - `/buap ask prompt="summarize this repo"`
  - `/buap git status`
  - `/buap git diff path=README.md`
  - `/buap mcp`

## Prepared next upgrade

The next ACP actions upgrade is specified in:

```text
packages/buap-acp-agent/docs/permissioned-actions-upgrade.md
packages/buap-acp-agent/tests/permissioned-actions.acceptance.md
```

It defines the next implementation pass for:

- `/buap apply` using ACP permission + client file API
- `/buap run` using ACP permission + client process API
- command discovery after `session/new`
- MCP action requests remaining blocked until policy is wired

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
```

`BUAP_REPO_ROOT` is useful when the command is launched from outside this repo. `BUAP_WORKSPACE_ROOT` provides a fallback workspace if the ACP session does not include `cwd`. `BUAP_PERSONALIZATION_FILE` enables local personalization persistence. Without it, personalization is held in memory for the current agent process.

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
- Patch command generates a diff proposal only; it does not write to disk.
- Git helpers are read-only `status` and `diff` commands.
- MCP server configs passed by the ACP client are reported, not executed.
- File-change and process-backed actions are prepared as the next explicit implementation pass.
