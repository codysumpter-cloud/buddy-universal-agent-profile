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

## Cloudflare R2 scoped storage — verified 2026-10-28

- Primary Cloudflare account now has **`prismtek-rea-private`**, a dedicated Standard-storage R2 bucket. Verified by readback.
- Managed `r2.dev` public access is **disabled** and no custom domain is attached. Keep the bucket private; it is not an executable hosting platform.
- Intended scoped key layout once a compute host is running: `jobs/<random-job-id>/inputs/`, `jobs/<random-job-id>/evidence/`, `jobs/<random-job-id>/reports/`. Restrict credentials to this bucket; do not reuse Azeroth, creative-assets, or website backup credentials.
- Add upload/download/sync support only after selecting the compute host and reviewing sensitive target retention, size limits, encryption, lifecycle and authorized content. Do not claim files are already synced.

### Hosting readiness/blockers

- Cloudflare Containers API returned **401: Workers Paid plan required**. R2 works, but native REA requires a real Node/container host and cannot execute inside an R2 bucket.
- The connected Render account is reachable but rejected creating a Free Node web service with **HTTP 402: payment information required**. No Render service was created. Do not create paid instances, subscriptions or Workers Paid upgrades without new explicit permission for charges.
- This GitHub PR provides the source, not a working remote MCP endpoint. A Cloudflare owner-only OAuth frontend, Render connection, native dependency compatibility checks, and end-to-end REA MCP tool probes remain outstanding.

## Hosted rollout evidence — 2026-10-28

- Render free web service **`prismtek-rea-cloud`**, ID `srv-dbh0i8cs728c73chbdgg` in Ohio, was created and deployment `dep-dbh0khu1egvs73eavptg` reported `live`. Its runtime log confirms REA HTTP MCP bound on internal loopback `127.0.0.1:8765/mcp` and the gateway on port 10000.
- Cloudflare Access MCP portal `prismtek-rea-portal` is attached to MCP server `prismtek-rea-cloud` at `https://rea-mcp.prismtek.dev/mcp`, DNS proxied CNAME to `gateway.agents.cloudflare.com`, with owner-email-only Allow policy. This is separate from PixelLab and Forge.
- Private ChatGPT plugin release `prismtek-rea-cloud@0.1.0` was created and read back at https://chatgpt.com/plugins/plugins_6ae20be297e08191ba26df5ecfa4966c (package has no credentials).
- **Unresolved:** Cloudflare upstream MCP server status is `error` because the bearer credential does not match Render's `REA_GATEWAY_TOKEN`; it has 0 discovered tools. Attempts to modify the upstream credential through the current Cloudflare connector returned safety blocks, so they were not considered successful. Use authenticated dashboard configuration to align that secret (do not send it in chat), then sync capabilities and perform a safe tool call before marking live ChatGPT tool access.
- Cloud R2 `prismtek-rea-private` bucket is provisioned and private, but no automatic artifact ingress/egress wiring is deployed yet.
- npm reported two high-severity dependency audit findings on build; investigate and address before treating runtime as hardened production.

## MCP connectivity repair and verified sync — 2026-10-28

- Rotated the gateway's bearer credential and aligned **Cloudflare MCP server** and **Render** environment values using scoped providers. The credential is not committed to this repository.
- REA free-instance cold startup can take around 30 seconds after Render starts the HTTP gateway. Immediately initiating Cloudflare sync during that interval yields `503 REA is starting`; retry only after the internal listener is up.
- Cloudflare MCP capability synchronization initially timed out after opening a GET SSE stream followed by concurrent capability POST requests. Safe protocol/status logs recorded 15-second aborted requests; no credentials, session identifiers, or request bodies were logged.
- Gateway now returns MCP-standard HTTP 405 for optional GET SSE requests, preserving authenticated POST/DELETE handling. See `gateway.mjs` and `gateway.test.mjs`.
- Render deployment `dep-dbh189142hec73e78d50` became **live**. Cloudflare MCP server **`prismtek-rea-cloud`** returned **`ready`**, successfully synchronized **229 tools and 6 prompts** at 2026-10-28 15:28:02 UTC, and reported no error.
- Verified portal `prismtek-rea-portal` includes the REA server with tools enabled, Managed OAuth DCR enabled, explicit One-Time PIN identity provider, ChatGPT callback allowlist, private owner-only Access policies on BOTH portal and server, and proxied `rea-mcp.prismtek.dev` CNAME to `gateway.agents.cloudflare.com`.
- **ChatGPT UI sign-in not directly tested**: user must retry/complete the ChatGPT OAuth redirect; Cloudflare Ready is evidence of upstream discovery, not a guaranteed in-app connection. Direct MCP URL: `https://rea-mcp.prismtek.dev/mcp`.
- Remaining hardening: review the dependency scanner's reported high-severity issues and assess Render Free cold-start latency. R2 artifact workflows are still not wired and should not be claimed active.
\n## Bounded owner preview REA MCP audits\n\nThe single-owner Render gateway adds protected routes separate from the MCP endpoint. POST /audit/preview requires the existing bearer token and JSON containing one of 21 explicitly allowlisted owner PixelLab project slugs; returns a job ID. GET /audit/jobs/{uuid} with the same token returns status, manifest SHA-256, source-file hashes and a bounded REA tool result.\n\nRender captures only a public https://{slug}.pixellab.run/ entry and up to six JavaScript bundles; 2 MiB/file, 5 MiB overall, no redirects, no arbitrary origins or filenames. It then executes REA analyze_javascript_application through a session-bound local MCP tools/call on these inert source files. The source files are never executed, and not returned in receipts.\n\nOne active scan, 12 receipts retained per Render process. Evidence is ephemeral on Render free hosting until an independent durable storage bridge exists. The owner Studio Worker must poll and persist bounded summaries. Network, cold-start, MCP and process-restart failures must be reported as failures; this does not guarantee reconstruction of 21 original repositories or pixel/animation parity. No public/no-auth fallback or paid plans.\n