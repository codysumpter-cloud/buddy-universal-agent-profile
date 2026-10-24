# BUAP GitHub MCP — an actual installable GitHub plugin

A **dependency-free Node.js MCP stdio server** inside the public
[BUAP GitHub repository](https://github.com/codysumpter-cloud/buddy-universal-agent-profile).
Unlike a prompt-only plugin, this server implements an MCP JSON-RPC tool endpoint
that makes actual HTTPS requests to `api.github.com`.

The native plugin works out of the box with Node.js 20+ after cloning/installing
the GitHub-hosted Claude marketplace. It never runs a shell or accepts arbitrary
HTTP origins. Claude-format plugins automatically discover `plugins/buap/.mcp.json`.

## 1. Install from GitHub

Inside Claude Code:

```text
/plugin marketplace add codysumpter-cloud/buddy-universal-agent-profile
/plugin install buap@buap
```

Restart the client or reload plugins and inspect `/mcp`. The bundled
`buap-github` server will start, but **GitHub operations are deliberately
unconfigured** until the host owner supplies an explicit repository allowlist.

For Codex, use [the native MCP template](../../../../adapters/codex-buap-github-mcp.template.toml)
with the actual checkout path. For any stdio MCP client, launch
`node /path/to/buap/plugins/buap/mcp/github/server.mjs`. The host's connection
to an existing ChatGPT GitHub plugin **does not** silently pass OAuth credentials
to this separate local process.

## 2. Supply scoped host configuration (never commit)

Environment variables **on the trusted host**:

```sh
export BUAP_GITHUB_REPOS="example-org/example-repo"
export BUAP_GITHUB_TOKEN="<securely supplied fine-grained GitHub token>"
```

Use the host's credential manager, secrets store or a secure environment injection
mechanism instead of committing tokens in TOML, `.mcp.json`, plugin prompts or
repository files. For public repositories, an omitted token may allow unauthenticated
GitHub reads with strict rate limits; private repositories require appropriate auth.
The allowlist is **always** required, even for public repositories.

Suggested GitHub token permissions: **Metadata (read)**, **Contents (read)**,
**Pull requests (read)** and **Checks (read)** for the specific repositories.
For PR creation, add **Pull requests (write)** only to a suitably scoped
installation/token. Host approval is a separate requirement and must not be
inferred from the token's possession.

Probe in your MCP-enabled client: `buap_github_health` then
`buap_github_repo` with `example-org/example-repo`. Require a successful
`buap_github_repo` result before binding any BUAP `github` capability.

## 3. Real tool surface

| MCP tool | Real GitHub REST request | Default |
| --- | --- | --- |
| `buap_github_health` | Local settings only | Always |
| `buap_github_repo` | `GET /repos/{owner}/{repo}` | Read |
| `buap_github_file` | `GET /repos/{owner}/{repo}/contents/{path}` | Read |
| `buap_github_pull_requests` | `GET /repos/{owner}/{repo}/pulls` | Read |
| `buap_github_pull_request` | `GET /pulls/{n}` and `/pulls/{n}/files` | Read |
| `buap_github_checks` | `GET /commits/{sha}/check-runs` | Read |
| `buap_github_create_pr` | `POST /repos/{owner}/{repo}/pulls` | Disabled |

No endpoint can list **all** user repositories, merge PRs, force-push, delete,
release, deploy or edit files. GitHub never receives secrets through tools.

### Optional PR creation — explicitly approved

Write operations are **not available** unless the host provides:

- `BUAP_GITHUB_WRITE_ENABLED=1`
- `BUAP_GITHUB_APPROVAL_CODE` set via the private host credential/approval channel
- A valid per-call `approval_code`, deliberately supplied after human approval
- A specific allowlisted repository and credential with PR write permission
- The host's own interactive permission/approval rules

A matching approval code is an additional gate, **not** authentication or an
automatic substitute for host review. Do not publish the code in prompts or logs.
The host is responsible for rotating and scoping it. The API only creates a PR,
defaults to `draft=true`, and does not perform merge/deployment.

## 4. Test locally / in CI

```sh
node --test plugins/buap/mcp/github/test/*.test.mjs
```

The suite includes a real subprocess JSON-RPC handshake and mocked GitHub
REST API calls. It proves the protocol, validation, URL restrictions and consent
gates, **not** that a user's particular GitHub account has been connected.
The GitHub Actions workflow runs the same tests on PRs.

## Security notes

- No arbitrary network hosts or redirects; hardcoded `https://api.github.com`.
- An exact owner/repo allowlist is mandatory. File paths reject traversal.
- No tool exposes the token, authorization header, or raw upstream error text.
- Responses are bounded and file content is size-limited. Retrieved text is untrusted.
- Private source content may still appear in the **authorized agent's** response;
  it must not be pasted into public CI logs, screenshots or PRs.
- The source uses a minimal MCP 2025-06-18 stdio tool subset. Clients requiring
  newer mandatory MCP methods need a dedicated compatibility check before use.
