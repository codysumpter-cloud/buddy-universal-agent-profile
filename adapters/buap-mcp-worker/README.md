# BUAP Remote MCP — Cloudflare Workers

Canonical source: `codysumpter-cloud/buddy-universal-agent-profile`.

This is one production read-only HTTP MCP adapter that **imports** the existing
`plugins/buap/mcp/github/server.mjs` and its API, rather than reimplementing
GitHub access. It does not spawn subagents, execute shell commands, perform
deployments or replace REA, Hermes, Codex or Mac MCP.

## Tools

The remote BUAP server exposes **11 read-only tools**:

- `buap_manifest`, `buap_capabilities`, `buap_self_test`: portable profile
  contract pointers and configuration-only diagnostics (not a live probe).
- `buap_github_probe`: performs a real GitHub GET for an allowlisted repository,
  returning timestamped connectivity evidence, visibility and archive status.
- `buap_pr_gate`: obtains PR metadata and commit check runs from GitHub,
  reports passing/pending/failing checks and blockers. **Always returns
  release_authorized=false**; passing CI never bypasses branch protection,
  review, security, licensing or owner approval.
- Six canonical read-only GitHub tools: health, repository, file, PR list, PR
  detail, commit checks. Optional PR creation is forcibly disabled remotely.

The **separate Cloudflare MCP portal** may also expose approved Mac MCP tools.
These are host-owned and not implemented or called by this BUAP Worker.
Portal configuration, permissions, and ChatGPT OAuth must be independently
verified. No fake cross-provider orchestration claims.

## Tests

Run from this directory:

```sh
npm test
npm run build
```

The tests cover authenticated MCP protocol, safe tool discovery,
GitHub allowlisting, real request routing with mocked HTTP responses,
CI readiness and denial cases, unauthorized writes, and oversized
streamed Unicode requests. Mocked GitHub tests do not establish a
particular private repository is connected.

## Security and operating constraints

- `BUAP_MCP_TOKEN` must be a secret binding, minimum-privilege owner-managed.
  Missing token returns 503; bad bearer returns 401; no token in source or logs.
- Cloudflare Access at the owner-only portal
  `https://buap-mcp.prismtek.dev/mcp` provides OAuth.
  **Access portal visibility is not direct-upstream security.** The Worker
  requires its independent bearer token even on `workers.dev`.
- `BUAP_GITHUB_REPOS` is an exact comma-separated repository allowlist.
  Public BUAP metadata can be fetched unauthenticated (subject to GitHub limits).
  `codysumpter-cloud/prismtek-site` is private: listing it in the allowlist
  does **not** provide credentials. A separate scoped `BUAP_GITHUB_TOKEN` secret
  and a successful probe are required before declaring private access working.
- PR gate returns checked PR/CI evidence only; it explicitly records unverified
  review, security and release gates and never merges or deploys.
- Incoming JSON request streams are byte-bounded before buffering, including
  when Content-Length is absent. HTTP errors do not echo credentials or
  upstream response bodies.
- Do not enable Git-connected Worker auto-builds, extra PR previews, Worker
  version-preview URLs, a new Render instance, or unapproved cloud charges.
  `workers_dev=true` is required only because Cloudflare's bearer-authenticated
  MCP registry uses the production Worker as its upstream.
- Preserve the `BUAP_MCP_TOKEN` binding on every deployment. Cloudflare
  multipart uploads should inherit secrets, not reset them. Check portal
  registry Ready state, enabled tool allowlist, and OAuth policy after rollout.

## Current state

The Worker is an **HTTP transport and guarded read-only diagnostic endpoint**,
not a durable Agent Profile process. BUAP Mission Control and AgentProfileRuntime
remain the authority for plans, approvals, evidence and scheduling; the host
must persist state and execute each approved action with a real tool.

Use `buap_github_probe` to establish live GitHub access and `buap_pr_gate`
to assess a PR before any independently approved merge. An upstream registry
showing tools as Ready does not itself prove that an authenticated ChatGPT
session completed a tool call.
