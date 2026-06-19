# Local BUAP Doctor and Bootstrap

Use this guide after cloning or pulling BUAP on a local Mac. It verifies the BUAP
repo, the ACP package, local tooling, optional model environment, and the default
personalization file used by Xcode/ACP launches.

## Pull latest main

```bash
mkdir -p ~/Prismtek
cd ~/Prismtek

if [ ! -d buddy-universal-agent-profile ]; then
  git clone https://github.com/codysumpter-cloud/buddy-universal-agent-profile.git
fi

cd buddy-universal-agent-profile
git checkout main
git pull --ff-only
```

## Run ACP package checks

```bash
cd ~/Prismtek/buddy-universal-agent-profile/packages/buap-acp-agent
npm install
npm run smoke
npm run build
npm run smoke:launch
```

## Run BUAP doctor

Fast checks:

```bash
cd ~/Prismtek/buddy-universal-agent-profile
node tools/buap-doctor.mjs
```

Full checks, including ACP package smoke/build/launch:

```bash
node tools/buap-doctor.mjs --full
```

The doctor reports optional environment variables as warnings, not failures. It
prints only whether `BUAP_MODEL_API_KEY` is set or missing; it never prints the
secret value.

## Codex plugin

BUAP also ships a local Codex plugin manifest at:

```text
plugins/buap/.codex-plugin/plugin.json
```

The plugin includes BUAP runbook skills, slash-command prompt files, Lil Buddy profile
assets, and Codex hook config at `plugins/buap/hooks.json`. Use the Codex plugin
installation flow for local plugins or a marketplace entry that points at
`plugins/buap/`.

## Run local bootstrap

```bash
node tools/buap-local-bootstrap.mjs
```

The bootstrap creates `~/.buap/` and writes
`~/.buap/personalization.json` only if the file is missing.

To overwrite the personalization file with defaults:

```bash
node tools/buap-local-bootstrap.mjs --force
```

The bootstrap prints environment exports and the ACP launch command. It does not
modify shell profiles automatically.

## Environment variables

Recommended local exports:

```bash
export BUAP_REPO_ROOT="$HOME/Prismtek/buddy-universal-agent-profile"
export BUAP_WORKSPACE_ROOT="$HOME/Prismtek/buddy-universal-agent-profile"
export BUAP_PERSONALIZATION_FILE="$HOME/.buap/personalization.json"
export BUAP_MAX_READ_BYTES=20000
export BUAP_GIT_TIMEOUT_MS=10000
export BUAP_TERMINAL_OUTPUT_LIMIT=1048576
export BUAP_CLIENT_REQUEST_TIMEOUT_MS=300000
```

Optional model backend for `/buap ask`:

```bash
export BUAP_MODEL_BACKEND=openai-compatible
export BUAP_MODEL_BASE_URL=https://api.openai.com/v1
export BUAP_MODEL_NAME=gpt-4.1-mini
export BUAP_MODEL_API_KEY="..."
export BUAP_MODEL_TEMPERATURE=0.2
```

## ACP launch command

After building the ACP package:

```bash
node /Users/prismtek/Prismtek/buddy-universal-agent-profile/packages/buap-acp-agent/dist/index.js
```

If the repo is cloned elsewhere, replace the path with your absolute checkout
path.

## Xcode/ACP capability troubleshooting

If `/buap apply` reports that file write is unavailable, the ACP client did not
advertise `clientCapabilities.fs.writeTextFile === true`. Use `/buap patch ...`
and apply the diff manually in the editor.

If `/buap run` reports that terminal is unavailable, the ACP client did not
advertise `clientCapabilities.terminal === true`. Run the command manually in a
terminal for now.

## Apple Notes & Reminders (macOS only)

`/buap notes`, `/buap add-note`, `/buap reminders`, and `/buap add-reminder` work
only on macOS — they drive Apple Notes/Reminders through `osascript`. On non-macOS
hosts they return a clear "macOS-only" message. The first call triggers a macOS
Automation permission prompt for the host app (Terminal/Xcode/ACP client); grant it
under System Settings → Privacy & Security → Automation. The create commands ask for
ACP permission before writing. Details: `docs/apple-notes-reminders.md`.
