# Xcode ACP Import Notes

Use this note when adapting BUAP for Xcode custom-agent import through Agent Client Protocol.

## What ACP provides

ACP is the editor/IDE transport layer. It lets an ACP client connect to an ACP-compatible coding agent without every editor and agent needing a custom one-off integration.

For BUAP, ACP should carry:

- workspace/session context
- user prompts
- agent progress updates
- file/tool/terminal capability boundaries
- editor permission requests
- Markdown user-facing responses
- patch/diff-oriented coding outputs

## Local runnable package

This branch includes the BUAP ACP agent package:

```text
packages/buap-acp-agent/
```

From that folder:

```bash
npm install
npm run smoke
npm run build
node dist/index.js
```

For local Xcode/ACP import before publishing, point the client command at:

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
```

For `/buap ask`, optionally configure an OpenAI-compatible model backend:

```bash
BUAP_MODEL_BACKEND=openai-compatible
BUAP_MODEL_BASE_URL=https://api.openai.com/v1
BUAP_MODEL_NAME=gpt-4.1-mini
BUAP_MODEL_API_KEY=...
```

## Runtime commands

After first-run personalization, the ACP agent supports these slash commands. The full set is also broadcast via `session/update` `available_commands_update` immediately after every `session/new`:

```text
/buap help
/buap profiles
/buap personalize user="Cody" buddy="Buddy" lil_buddy="Finn" buddy_profile=bmo lil_buddy_profile=finn
/buap read path=README.md
/buap patch path=README.md find="old" replace="new"
/buap apply path=README.md find="old" replace="new"     # permission-gated, fs/write_text_file
/buap ask prompt="summarize this workspace"
/buap run cmd="npm" args="test"                          # permission-gated, terminal/create
/buap git status
/buap git diff path=README.md
/buap mcp
/buap mcp invoke server="github" tool="search" payload="{}"   # blocked planning response
```

## ACP surfaces used by the upgrade

- `session/update` `tool_call` / `tool_call_update` for `/buap apply` and `/buap run`.
- `session/request_permission` before any file write or terminal command.
- `fs/read_text_file` (when `clientCapabilities.fs.readTextFile === true`) for `/buap read` and `/buap patch`.
- `fs/write_text_file` (when `clientCapabilities.fs.writeTextFile === true`) for `/buap apply`. Workspace writes never use Node `fs.writeFile`.
- `terminal/create`, `terminal/wait_for_exit`, `terminal/output`, `terminal/release` (when `clientCapabilities.terminal === true`) for `/buap run`. Uses `command` + `args[]` only, never `sh -c`.
- `available_commands_update` broadcast right after every `session/new`.

## BUAP files loaded by the package

The ACP agent loads these in order:

1. `XCODE_ACP_BUAP.md`
2. `BUAP_FULL.md`
3. `personalization/PERSONALIZATION_HANDSHAKE.md`
4. `personalization/BUDDY_LIL_BUDDY_PROFILE_SELECTION.md`
5. `personalization/bmo-council-personality-profiles.json`
6. `schemas/buap-personalization.schema.json`

## Registry metadata

Start from:

```text
adapters/xcode-acp-agent.template.json
```

The template now points at `@prismtek/buap-acp-agent@0.2.0`. Keep using the local command above until the package is published or made available through your preferred private package registry.

## Safety contract

Xcode/editor permissions are the hard boundary. Lil Buddy acts only inside capabilities the editor actually granted. `clientCapabilities.fs.writeTextFile` and `clientCapabilities.terminal` are checked at runtime; when a capability is missing, the command returns a clearly worded blocked response that points at the safe fallback (for example `/buap patch` instead of `/buap apply`). MCP server configs passed by the ACP client are reported; `/buap mcp invoke` remains a blocked planning response until MCP-over-ACP transport and explicit ACP/MCP permission handling are implemented.
