# Permissioned Actions Acceptance Checklist

Use this checklist before implementing or reviewing the ACP permissioned actions upgrade.

## `/buap apply`

- [ ] Does not call local `fs.writeFile` or `fs.writeFileSync` for workspace files.
- [ ] Requires `clientCapabilities.fs.writeTextFile === true` before attempting write.
- [ ] Emits a `tool_call` update with kind `edit` before requesting permission.
- [ ] Calls `session/request_permission` before `fs/write_text_file`.
- [ ] Handles `reject_once`, `reject_always`, and `cancelled` outcomes as blocked/failed.
- [ ] Emits `tool_call_update` with status `completed` only after client write succeeds.
- [ ] Emits diff content using ACP tool-call diff content fields.

## `/buap run`

- [ ] Requires `clientCapabilities.terminal === true`.
- [ ] Uses `command` and `args[]`; does not build shell strings.
- [ ] Calls `session/request_permission` before `terminal/create`.
- [ ] Embeds returned terminal ID in tool-call content.
- [ ] Calls `terminal/wait_for_exit`, `terminal/output`, and `terminal/release`.
- [ ] Marks non-zero exit as failed.

## Slash command advertisement

- [ ] Sends `available_commands_update` after `session/new`.
- [ ] Advertises `/buap apply` and `/buap run` only when the runtime supports the related client capability, or clearly handles unsupported capability in the command response.

## MCP

- [ ] `/buap mcp invoke` remains blocked until MCP-over-ACP transport and permission policy are implemented.
- [ ] The blocked response includes requested server/tool/payload and the available session MCP server config.
