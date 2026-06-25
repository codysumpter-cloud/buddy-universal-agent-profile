# Buddy MCP Bridge Runbook

Use this runbook when Prismtek asks to connect Buddy, BUAP, Knowledge Vault, Codex, or Odysseus through the Buddy MCP bridge.

## Goal

Configure and verify a local Buddy stdio MCP server so MCP clients can call safe Buddy tools while preserving BUAP truthfulness, safety, and receipt rules.

## Source-backed inputs

Read first:

1. `integrations/buddy-mcp-server.md`
2. `adapters/codex-buddy-mcp.template.toml`
3. `adapters/odysseus-buddy-mcp.template.md`
4. `codysumpter-cloud/buddy-agent/docs/BUDDY_MCP_SERVER.md`
5. `integrations/knowledge-vault-runtime.md`

## Steps

### 1. Capability check

Check whether the environment can:

- read local files;
- access the Buddy Agent repo;
- access the Knowledge Vault path;
- edit MCP client config;
- run a local command;
- call MCP `initialize`, `tools/list`, and `buddy.self_test`.

If any of these are unavailable, mark that part Blocked and continue with a handoff.

### 2. Find or install the executable

Look for an executable at the configured command path, usually:

```text
/absolute/path/to/buddy-mcp-plugin/.venv/bin/buddy-mcp
```

Do not invent this path. The executable must exist locally or be installed from a reviewed package.

### 3. Configure the client

For Codex, adapt:

```text
adapters/codex-buddy-mcp.template.toml
```

For Odysseus, adapt:

```text
adapters/odysseus-buddy-mcp.template.md
```

Use an absolute `BUDDY_VAULT_PATH` that points to the user's Knowledge Vault.

### 4. Smoke test

Run or request the client-side equivalent of:

```text
MCP initialize
MCP tools/list
buddy.self_test
```

Required receipts:

- tool list shows Buddy tools;
- `buddy.self_test` succeeds;
- no secret/private paths are exposed in the response.

### 5. Optional delegation test

If safe, call `buddy.codex_delegate` with a tiny non-sensitive task and confirm it creates a local delegation brief under:

```text
.buddy/codex-delegations/
```

Do not launch Codex automatically unless a separate approved adapter exists.

## Claim labels

- **Source-backed:** PR #24 documents the MCP bridge and tool shape.
- **Blocked:** No executable package exists in the environment.
- **Locally verified:** The command exists and the MCP client can list/call Buddy tools.
- **Verified:** Current repo/tool receipts prove the configured bridge works in the target environment.

## Safety

The v1 MCP bridge must remain safe by default:

- no arbitrary shell execution;
- no automatic Codex launch;
- local delegation briefs only;
- vault search must stay inside the configured vault path;
- no secrets, tokens, credentials, raw prompts, private paths, browser state, camera/audio data, transcripts, or private repo details in MCP responses.

## Handoff template

```text
Goal: Verify Buddy MCP bridge for [Codex/Odysseus]
Repos: codysumpter-cloud/buddy-agent, codysumpter-cloud/buddy-universal-agent-profile, codysumpter-cloud/knowledge-vault
Read first:
- BUAP integrations/buddy-mcp-server.md
- BUAP adapters/codex-buddy-mcp.template.toml or adapters/odysseus-buddy-mcp.template.md
- buddy-agent/docs/BUDDY_MCP_SERVER.md
Current state: PR #24 documents the bridge; executable package must be locally present before claiming runtime success.
Do next:
1. Confirm the `buddy-mcp` executable path exists.
2. Configure MCP client with the template.
3. Run initialize/tools-list/buddy.self_test.
4. Capture receipts.
Validate with: buddy.self_test and tools/list showing Buddy tools.
Do not claim success unless: local MCP client returns successful Buddy tool responses.
```
