# Prismtek REA Cloud — single-owner MCP runtime adapter

This adapter runs the upstream [REA: Reverse Engineer Anything](https://github.com/morluto/rea) npm package on cloud Node.js. GitHub owns the source and Render runs it. It does **not** depend on Hermes, Odysseus, a personal PC, Mac, SSH, or a personal Cloudflare Tunnel.

## Architecture

ChatGPT OAuth MCP plugin → protected Cloudflare OAuth gateway → Render HTTPS service (bearer token) → 127.0.0.1:8765 REA MCP.

The code here implements only the **inner authenticated gateway**. ChatGPT's OAuth connection still requires a separately reviewed Cloudflare OAuth adapter (or an intentional extension of Prismtek's existing owner OAuth portal). **Never register the Render hostname as a no-auth ChatGPT plugin.**

## Render deploy

Source repository: `codysumpter-cloud/buddy-universal-agent-profile`; Blueprint: root `render.yaml`.
- Runtime: Node.js `24.22.1`.
- Service root: `adapters/rea-cloud`.
- Build: `npm install --omit=dev`.
- Start: `npm start`.
- Render free plan is appropriate for testing, **not always-on**: it sleeps after 15 minutes without traffic, and ephemeral REA state is lost on restart. Do not upgrade without approval.
- Required secret: `REA_GATEWAY_TOKEN`, 32+ random characters. Put it in Render secrets and, once ready, in the trusted Cloudflare OAuth gateway—**never in GitHub or a browser**.
- Render supplies `PORT` and the gateway binds publicly there. REA itself binds only to loopback `127.0.0.1:8765`.
- Health check: `GET https://<service>.onrender.com/healthz`.
- Protected upstream MCP: `https://<service>.onrender.com/mcp`, requires `Authorization: Bearer <REA_GATEWAY_TOKEN>`.

This is **single-owner, single-REA-session**, not multi-tenant. REA can perform stateful and host-affecting operations; restrict targets to ones you own or have permission to inspect. Native Ghidra/Hopper/IDA, Android and firmware engines are **not included**. The cloud REA process reads files on its own cloud filesystem, not files stored automatically in GitHub or your personal computer. A separately authorized upload or checkout workflow is needed to supply target artifacts.

## Test and connection verification

`node --test gateway.test.mjs` verifies the proxy's bearer token behavior and that credentials/cookies are not forwarded to REA. This does not test the published REA process or external OAuth.

Before considering deployment complete, prove:
1. Render build succeeded and `/healthz` reports ready.
2. Owner-only OAuth token exchange works from ChatGPT.
3. MCP `initialize`, `tools/list` and one consented safe test tool call work end to end.
4. The cloud target file is present and readable by the REA runtime.

Do not publish the Render service endpoint alone as an unauthenticated production MCP.
