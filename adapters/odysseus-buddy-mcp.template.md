# Odysseus Buddy MCP Adapter Template

Source-backed by `codysumpter-cloud/buddy-agent#24`.

Use this when configuring Odysseus or another local MCP client to call Buddy through a stdio MCP server.

## Local stdio server

```text
Name: buddy
Command: /absolute/path/to/buddy-mcp-plugin/.venv/bin/buddy-mcp
Args: none
Environment:
  BUDDY_VAULT_PATH=/absolute/path/to/knowledge-vault
```

## Smoke test

Call:

```text
buddy.self_test
```

Expected outcome:

- MCP client can connect to the server.
- `tools/list` includes Buddy tools.
- `buddy.self_test` returns a success response.

## If tools do not appear

- Refresh or re-index the MCP tool catalog.
- Restart Odysseus / the MCP client.
- Confirm the `buddy-mcp` command path exists.
- Confirm the virtual environment is installed.
- Confirm `BUDDY_VAULT_PATH` points to the intended local Knowledge Vault.

## Truthfulness rule

Do not claim Odysseus can use Buddy until the current client has a passing smoke test receipt.

If the executable package is missing, say:

```text
Blocked: Buddy MCP is documented, but the `buddy-mcp` executable is not installed in this environment. I can provide the config and handoff, but cannot claim the bridge is live yet.
```
