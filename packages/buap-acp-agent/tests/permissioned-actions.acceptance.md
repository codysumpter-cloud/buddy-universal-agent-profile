# Permissioned Actions Acceptance Checklist

Use this checklist before implementing or reviewing the ACP permissioned actions upgrade.
All markers referenced here are verified by `packages/buap-acp-agent/scripts/smoke.mjs`.

## `/buap apply`

- [x] Does not call local `fs.writeFile` or `fs.writeFileSync` for workspace files.
- [x] Requires `clientCapabilities.fs.writeTextFile === true` before attempting write.
- [x] Emits a `tool_call` update with kind `edit` before requesting permission.
- [x] Calls `session/request_permission` before `fs/write_text_file`.
- [x] Handles `reject_once`, `reject_always`, and `cancelled` outcomes as blocked/failed.
- [x] Emits `tool_call_update` with status `completed` only after client write succeeds.
- [x] Emits diff content using ACP tool-call diff content fields.
- [x] Sends real JSON-RPC client requests and waits for the matching permission/write response.
- [x] On capability absence, returns a clearly worded blocked response that points at `/buap patch` as the safe fallback.

## `/buap run`

- [x] Requires `clientCapabilities.terminal === true`.
- [x] Uses `command` and `args[]`; does not build shell strings.
- [x] Calls `session/request_permission` before `terminal/create`.
- [x] Embeds returned terminal ID in tool-call content.
- [x] Calls `terminal/wait_for_exit`, `terminal/output`, and `terminal/release`.
- [x] Releases the ACP terminal even if wait/output handling fails after terminal creation.
- [x] Marks non-zero exit as failed.
- [x] On capability absence, returns a clearly worded blocked response.

## Slash command advertisement

- [x] Sends `available_commands_update` immediately after `session/new`.
- [x] `initialize._meta.buap.advertisedCommands` reflects the same command set.
- [x] Advertises `/buap apply` and `/buap run` only when the runtime supports the related client capability, or clearly handles unsupported capability in the command response.

## MCP

- [x] `/buap mcp invoke` remains blocked until MCP-over-ACP transport and permission policy are implemented.
- [x] The blocked response includes the requested server/tool/payload, the available session MCP server config, the reason it is blocked, and the next implementation requirement.

## Smoke-checked source markers

The package smoke test (`npm run smoke`) verifies these markers exist in `src/runtime.ts`, `src/index.ts`, and the compiled `dist/`:

- `session/request_permission`
- `fs/write_text_file`
- `terminal/create`
- `terminal/wait_for_exit`
- `terminal/output`
- `terminal/release`
- `available_commands_update`
- `/buap apply`
- `/buap run`
- `/buap mcp invoke`
- `BUAP_MODEL_BACKEND=openai-compatible` (still preserved for the optional model backend)
