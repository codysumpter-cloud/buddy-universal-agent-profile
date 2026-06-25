# Buddy MCP Server Integration

## Purpose

Track the Buddy Agent MCP bridge defined in `codysumpter-cloud/buddy-agent#24` and explain how BUAP-aware agents should route MCP clients such as Odysseus and Codex through Buddy without forking Odysseus or duplicating Buddy Agent runtime code.

## Source and ownership

- **Source PR:** `codysumpter-cloud/buddy-agent#24`
- **Owning runtime repo:** `codysumpter-cloud/buddy-agent`
- **BUAP role:** document portable routing, adapter templates, safety expectations, and handoff behavior.
- **Not BUAP's role:** ship or claim the executable MCP server unless the package exists in an owning runtime repo or local verified install.

## Current source-backed shape

`buddy-agent#24` defines a local stdio MCP server so Odysseus, Codex, and other MCP clients can call Buddy tools without modifying Odysseus.

The documented v1 tool surface is:

| Tool | Purpose | Default risk |
| --- | --- | --- |
| `buddy.self_test` | Confirm the server is reachable. | Read-only |
| `buddy.status` | Show runtime status and paths. | Read-only |
| `buddy.project_context` | Read known project metadata files. | Read-only |
| `buddy.vault_search` | Search local Markdown vault notes. | Read-only |
| `buddy.repo_overview` | Inspect repo markers/branch without shell commands. | Read-only |
| `buddy.codex_delegate` | Write a Codex task brief under `.buddy/codex-delegations/`. | Scoped write |

Source flow:

```text
Odysseus / Codex / ChatGPT-assisted workflow
        ↓
Buddy MCP server
        ↓
BUAP, knowledge-vault, local repos, Codex delegation briefs
```

## Status boundaries

As of PR #24, the committed change in `buddy-agent` is documentation-only. The PR body says the standalone package was built and tested in a chat sandbox, but executable code was not committed because connector writes were blocked.

Therefore BUAP-compatible agents must use these labels:

- **Source-backed:** Buddy Agent documents the MCP bridge and v1 tool shape.
- **Unverified:** A local `buddy-mcp` executable exists, unless the current machine/repo proves it.
- **Blocked:** Fresh checkout cannot run `buddy-mcp` unless the standalone package is installed or committed elsewhere.
- **Verified / Locally verified:** Only after `buddy.self_test` or equivalent MCP client smoke test succeeds in the current environment.

Do not claim Odysseus, Codex, or ChatGPT can call Buddy MCP tools until the executable and client configuration are verified.

## Codex client template

Use `adapters/codex-buddy-mcp.template.toml`.

Expected shape:

```toml
[mcp_servers.buddy]
command = "/absolute/path/to/buddy-mcp-plugin/.venv/bin/buddy-mcp"
args = []
env = { BUDDY_VAULT_PATH = "/absolute/path/to/knowledge-vault" }
```

## Odysseus client template

Use `adapters/odysseus-buddy-mcp.template.md`.

Expected shape:

```text
Name: buddy
Command: /absolute/path/to/buddy-mcp-plugin/.venv/bin/buddy-mcp
Args: none
Smoke tool: buddy.self_test
```

## Safety defaults

- No arbitrary shell execution in v1.
- No automatic Codex launch in v1.
- `buddy.codex_delegate` writes a local delegation brief only.
- Vault search stays inside the configured vault path.
- The server is for private/local MCP clients.
- Do not expose tokens, account credentials, private browser state, raw prompts, private local paths, camera/audio data, or transcripts through MCP tool responses.

## BUAP behavior

When a user asks to use Odysseus, Codex, or another MCP client with Buddy:

1. Read this file and `buddy-agent/docs/BUDDY_MCP_SERVER.md`.
2. Check whether an executable `buddy-mcp` package exists locally or in an owning repo.
3. If missing, mark the executable path as Blocked and provide an install/apply handoff.
4. If present, configure the MCP client with the adapter template.
5. Smoke test with `buddy.self_test`.
6. Only after the smoke test passes, claim the MCP bridge is locally verified.

## Validation receipts

Acceptable receipts include:

- path to the installed `buddy-mcp` executable;
- Codex/Odysseus MCP config file path;
- `buddy.self_test` response;
- `tools/list` response showing Buddy tools;
- local file receipt for a `.buddy/codex-delegations/` brief created by `buddy.codex_delegate`;
- PR/commit that actually adds the executable package.
