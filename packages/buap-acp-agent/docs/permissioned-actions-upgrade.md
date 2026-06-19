# BUAP ACP Permissioned Actions Upgrade

This document describes the ACP permissioned-actions upgrade implemented on top of
the guarded runtime command layer.

The package can read workspace files, propose patches, route model prompts, inspect
read-only Git status/diff, report MCP session context, ask for ACP permissions,
write through the client filesystem, run checks through the client terminal, and
advertise supported slash commands.

## ACP surfaces to use

Use these ACP v1 protocol surfaces, not ad-hoc prompts:

- `session/update` with `tool_call` and `tool_call_update` for visible action progress.
- `session/request_permission` before any file write, terminal command, MCP action, or source-control mutation.
- `fs/read_text_file` when `clientCapabilities.fs.readTextFile === true`.
- `fs/write_text_file` when `clientCapabilities.fs.writeTextFile === true`.
- `terminal/create`, `terminal/output`, `terminal/wait_for_exit`, and `terminal/release` when `clientCapabilities.terminal === true`.
- `available_commands_update` after `session/new` so clients can expose slash commands.

## Implemented commands

### `/buap apply`

Purpose: apply a previously proposed text replacement through the ACP client filesystem.

Input:

```text
/buap apply path=README.md find="old text" replace="new text"
```

Required behavior:

1. Resolve `path` inside the session workspace only.
2. Prefer `fs/read_text_file` to read current editor state when the client supports it.
3. Fall back to local read only for diff construction, not for writing.
4. Refuse to proceed if `clientCapabilities.fs.writeTextFile` is not true.
5. Emit `session/update` `tool_call` with kind `edit` and pending status.
6. Call `session/request_permission` with allow-once/reject-once options.
7. If rejected, mark the tool call failed and return a blocked report.
8. If allowed, call `fs/write_text_file` with the full updated file content.
9. Mark the tool call completed and return a Lil Buddy report with evidence.

Safety rule: never write directly with Node `fs.writeFile` for workspace files. The editor/client owns writes.

### `/buap run`

Purpose: run a check/build/test command through the ACP terminal after permission.

Input:

```text
/buap run cmd="npm" args="test"
```

Required behavior:

1. Refuse if `clientCapabilities.terminal` is not true.
2. Emit `session/update` `tool_call` with kind `execute` and pending status.
3. Call `session/request_permission` with allow-once/reject-once options.
4. If allowed, call `terminal/create` with `cwd` set to the session workspace.
5. Add the returned terminal ID to the tool-call content so the client can show live output.
6. Call `terminal/wait_for_exit`, then `terminal/output`, then `terminal/release`.
7. Mark completed for exit code 0 and failed otherwise.

Safety rule: no shell interpolation. Use `command` plus `args[]`, not `sh -c`.

### `/buap mcp invoke`

Purpose: prepare a future MCP-over-ACP call path.

Input:

```text
/buap mcp invoke server="github" tool="search" payload="{}"
```

Required behavior for now:

1. Report the requested server/tool/payload.
2. Show available session MCP server config.
3. Return `blocked` until MCP-over-ACP transport and permission policy are wired.

Safety rule: MCP calls can affect external systems; do not invoke tools until explicit ACP/MCP permission handling is implemented.

## Command advertisement

After every `session/new`, send:

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "...",
    "update": {
      "sessionUpdate": "available_commands_update",
      "availableCommands": [
        { "name": "buap help", "description": "Show BUAP ACP commands." },
        { "name": "buap read", "description": "Read a workspace file safely.", "input": { "hint": "path=README.md" } },
        { "name": "buap patch", "description": "Prepare a diff proposal.", "input": { "hint": "path=README.md find=old replace=new" } },
        { "name": "buap apply", "description": "Ask permission and write through ACP fs.", "input": { "hint": "path=README.md find=old replace=new" } },
        { "name": "buap run", "description": "Ask permission and run through ACP terminal.", "input": { "hint": "cmd=npm args=test" } }
      ]
    }
  }
}
```

## Acceptance checks

The package smoke test verifies these markers exist in source and compiled output:

- `session/request_permission`
- `fs/write_text_file`
- `terminal/create`
- `terminal/release`
- `available_commands_update`
- `/buap apply`
- `/buap run`

## Non-goals for this upgrade

- No direct local workspace writes.
- No shell-string execution.
- No direct MCP tool invocation.
- No source-control mutation such as commit, push, reset, checkout, or merge.

## Recommended implementation files

- `packages/buap-acp-agent/src/runtime.ts`
- `packages/buap-acp-agent/src/index.ts`
- `packages/buap-acp-agent/scripts/smoke.mjs`
- `packages/buap-acp-agent/README.md`
- `integrations/xcode-acp-import.md`
