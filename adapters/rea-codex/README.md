# REA for the persistent Prismtek Codex host

**Status:** installer staged, **not installed on the remote server**. This is a scoped bootstrap, not a background task or a claim of REA availability in ChatGPT.

## Target

The intended host is the owner-protected Prismtek Studio/Odysseus Linux machine, reachable through the existing Cloudflare Access apps at `ssh.prismtek.dev` and `odysseus.prismtek.dev`. These endpoints being healthy **does not** grant shell execution to a separate ChatGPT session. Never replace the Access policies or expose a public SSH/API executor.

The owner must open an authenticated shell as the **same OS user that runs Codex** (an interactive remote browser shell or a Work/browser session that truly has terminal control). First verify `hostname`, `whoami`, `node -v`, `codex --version`, and `$HOME` match that account. Do not run setup in a temporary ChatGPT, PixelLab, or Vercel sandbox.

## Execute

Read `adapters/rea-codex/install-rea-codex.sh` from this repository before executing:

```bash
bash adapters/rea-codex/install-rea-codex.sh --dry-run
bash adapters/rea-codex/install-rea-codex.sh --apply
bash adapters/rea-codex/install-rea-codex.sh --verify
```

The host must already have `codex`, npm and compatible Node.js (22.19+, 24.11+, or 26+). The script intentionally does not upgrade Node, install Codex, modify unrelated clients, or install Hopper.

- `--dry-run` executes `npx -y rea-agents@latest setup --client codex --dry-run --json` and writes a private plan to `~/.local/state/prismtek/rea-codex` (or `$XDG_STATE_HOME`).
- `--apply` reruns the same plan, then invokes `setup --client codex --yes --json`. REA owns the backup, conflict checking, version-pinned MCP registration and matching skill deployment.
- `--verify` runs `doctor --client codex --skill --json` and `codex mcp list`.

The script's diagnostics alone do **not** demonstrate that the existing ChatGPT session gained an MCP connection. Restart/reconnect the target Codex process and ask it to enumerate the REA tools it actually sees. For an end-to-end JavaScript analysis test, give REA an intentionally non-sensitive JavaScript application directory and ask it to report modules and import edges with file evidence. Do not use personal/proprietary binaries without permission.

## Completion gates

1. Verify execution **on the actual persistent host**, not an isolated test runner.
2. Read the dry-run plan for exact existing configuration paths, detected REA skill target and the precise npm package version; resolve any conflicts without deleting unrelated MCP entries.
3. Confirm actual setup output reports successful Codex registration and skill installation, and no Hopper installation.
4. Confirm `doctor` reports the Codex client and skill as healthy, and `codex mcp list` includes REA.
5. Restart Codex and confirm live REA tools are discoverable in that new process.
6. Record host identity (not credentials), installed version, health output, and date in the task receipt.

**Existing blockers (as of October 27, 2026):** ChatGPT's connected Codex Tasks registry returned no environments; the persistent host's Safari SSH session was not accessible to the ChatGPT connector; Cloudflare Tunnel API is a management API, not SSH execution. A connected browser control session or a properly registered remote Codex host is required for this installer to be run remotely. Do not infer success from a healthy tunnel.

Vendor setup documentation: https://github.com/morluto/rea/blob/main/docs/installation.md
