# @prismtek/buap-acp-agent

Local stdio Agent Client Protocol server for loading BUAP into Xcode or any ACP-compatible editor/client.

This is the first runnable BUAP ACP package. It intentionally starts conservative: it handles ACP session lifecycle, loads BUAP files, performs the Buddy/Lil Buddy personalization handshake, and reports capability boundaries. It does not yet wire a production LLM backend or mutate files on its own.

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
BUAP_PERSONALIZATION_FILE=/absolute/path/to/.buap/personalization.json
```

`BUAP_REPO_ROOT` is useful when the command is launched from outside this repo. `BUAP_PERSONALIZATION_FILE` enables local personalization persistence. Without it, personalization is held in memory for the current agent process.

## First-run command

When the agent asks for setup, reply:

```text
/buap personalize user="Cody" buddy="Buddy" lil_buddy="Finn" buddy_profile=bmo lil_buddy_profile=finn
```

Use `/buap profiles` to list available BMO council profiles.

## Current limitations

- No production LLM backend is wired yet.
- No file writes, terminal execution, MCP calls, Git commits, or source-control operations are performed directly.
- Tool execution should be added through ACP client capabilities, never by bypassing editor permissions.

## Next implementation step

Wire this package to the actual Buddy runtime/model backend and add ACP-safe adapters for file reads, patch proposals, terminal commands, MCP servers, and source-control actions.
