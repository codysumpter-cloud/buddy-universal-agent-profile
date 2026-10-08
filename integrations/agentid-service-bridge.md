# AgentID → Buddy connection kit (October 2026)

AgentMail/AgentID accounts establish agent identities, **not** authorization for third-party service APIs. Connect the remote MCP services below in an OAuth-capable client and use the AgentID-created vendor account during sign-in.

## Remote OAuth MCP servers

| Service | Endpoint | Access |
| --- | --- | --- |
| Supermemory | `https://mcp.supermemory.ai/mcp` | OAuth; choose an explicit memory space |
| Firecrawl | `https://mcp.firecrawl.dev/v2/mcp-oauth` | OAuth; authorize an appropriate team |
| Manufact | `https://mcp.manufact.com/mcp` | OAuth; cloud management permissions |

Use `adapters/agentid-remote-mcp.template.json` for the generic MCP client configuration. A client may require a different config layout. A URL in a config file does **not** establish that OAuth has completed.

## Registered vendor accounts requiring runtime setup

| Service | Credentials/access | First safe runtime check |
| --- | --- | --- |
| AgentMail | Existing host connector or `AGENTMAIL_API_KEY` | List inboxes (read-only) |
| Turso | Database URL and scoped auth token | `SELECT 1` on a designated test database |
| Archil | Vendor workspace and documented auth flow | Read permitted filesystem metadata |
| smolmachines | `SMOL_CLOUD_TOKEN` or local SDK | Check account/config; do not create a VM |
| Context.dev | `CONTEXT_DEV_API_KEY` | Test auth with a non-billable account endpoint if available |
| Okibi | CLI/MCP publisher access | Read available tool definitions/config |
| Telnyx | Scoped API key and MCP client | List API surface only, never place a call or order |

Use vendor docs to establish whether each read request is billable before making it.

## Boundaries

- **Registered** means AgentID completed an app sign-in; **connected** means the target agent runtime completed provider OAuth/API authentication; **verified** means a non-destructive read call succeeded and a receipt exists.
- Never store OAuth tokens, passwords, public-key private material or API keys in this repository.
- Credentials belong in per-runtime secret stores, not in instructions, logs, issue bodies or screenshots.
- Memory should be divided into approved project spaces. Never sync all personal mail/chat content automatically.
- Read-only first. Require approval and policy for DB writes, deployments, external messages, paid actions, number provisioning and remote machine creation.
- BUAP only carries portable configuration and behavior; actual runtime adapters belong in the Buddy Agent/Prismtek Apps runtime owner.
- Capture a receipt for each service: sign-in status, client, scope, auth evidence, read-only test result, date, cost-control review.

## Manufact deployment note

The Prismtek website is a React/Vite web app, not an MCP server. An MCP host's initialization probe will not work against an ordinary website bundle. Deploy a real MCP server or select an actual MCP server subdirectory/entrypoint. Connecting the Manufact management MCP is separate from fixing a failed server deployment.

## Sources

- https://www.agentmail.to/docs/agentid-sign-in
- https://supermemory.ai/mcp/
- https://github.com/firecrawl/firecrawl-docs/blob/main/mcp-server.mdx
- https://docs.manufact.com/mcp
- https://docs.turso.tech/sdk/rust
- https://smolmachines.com/docs/sdk/with-cloud
- https://docs.context.dev/api-reference/web-extraction/query-website-data-using-ai
- https://support.telnyx.com/en/articles/4305158-api-keys-and-how-to-use-them
