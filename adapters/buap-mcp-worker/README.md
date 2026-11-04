# BUAP Remote MCP (Cloudflare Workers)

**Source of truth:** `codysumpter-cloud/buddy-universal-agent-profile`.

This single, read-only remote MCP adapter imports the existing
`plugins/buap/mcp/github/server.mjs` and API. It adds a canonical
`buap_manifest`, `buap_capabilities`, and `buap_self_test` tool.
It **does not** replace REA, Hermes, Mac, or the native stdio plugin.

## Build and test

From this directory: `npm test` and `npm run build`.
Wrangler (when available) can bundle `index.mjs` and imports using the
`wrangler.json` config. The Cloudflare API also accepts multipart
modules when the 3 source modules are supplied in their original paths.

## Security and deployment gates

- **Fail closed:** no MCP requests are served unless a private
  `BUAP_MCP_TOKEN` Worker secret has been provisioned.
- **Use Cloudflare Access**, restricted to the owner, for the hostname
  and/or owner-only Cloudflare MCP portal. A portal policy by itself
  does not secure a direct upstream URL.
- Cloudflare MCP portal connects via an independently stored copy of
  the bearer secret. Never put it in GitHub, frontend code or chat.
- `BUAP_GITHUB_REPOS` must be an exact comma-separated allowlist.
  Public BUAP source can be inspected without a GitHub token.
  Private repos require a **separate scoped credential** and must
  never inherit the ChatGPT GitHub connector token.
- The remote Worker forcibly disables the optional GitHub write tool,
  regardless of any host configuration. It does not expose shell,
  deploy, merge or arbitrary URL tools.
- **Do not enable Worker auto-build, GitHub PR previews or Worker
  version preview URLs.** One production Worker suffices.
- Use `GET /healthz` for no-secret readiness and the protected
  `POST /mcp` initialize, tools/list, buap_self_test and one
  approved read call for full validation.

## Scope

This is **not** a persisted BUAP Agent Profile server. The portable
profile and permission policy remain canonical in BUAP's contracts;
real workers, memory, schedules, REA, local Mac and Hermes execution
must be bound and verified by each host, rather than invented by MCP
advertisements.

For remote clients, prefer the owner-only Cloudflare MCP portal and
its managed OAuth authentication.
