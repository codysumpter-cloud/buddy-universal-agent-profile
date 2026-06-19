# BUAP ACP Agent Local Install and Xcode Smoke Guide

This guide is for turning the merged BUAP ACP agent package into something you can run locally from a fresh Mac, then point an ACP-compatible editor such as Xcode at it.

## 1. Pull BUAP

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

## 2. Install the ACP package

```bash
cd ~/Prismtek/buddy-universal-agent-profile/packages/buap-acp-agent
npm install
npm run smoke
npm run build
```

Expected result:

```text
BUAP ACP smoke check passed
```

## 3. Recommended environment

Use absolute paths so the editor can launch the agent from any working directory.

```bash
export BUAP_REPO_ROOT="$HOME/Prismtek/buddy-universal-agent-profile"
export BUAP_WORKSPACE_ROOT="$HOME/Prismtek/buddy-universal-agent-profile"
export BUAP_PERSONALIZATION_FILE="$HOME/.buap/personalization.json"
export BUAP_MAX_READ_BYTES=20000
export BUAP_GIT_TIMEOUT_MS=10000
export BUAP_TERMINAL_OUTPUT_LIMIT=1048576
export BUAP_CLIENT_REQUEST_TIMEOUT_MS=300000
```

Optional model backend:

```bash
export BUAP_MODEL_BACKEND=openai-compatible
export BUAP_MODEL_BASE_URL=https://api.openai.com/v1
export BUAP_MODEL_NAME=gpt-4.1-mini
export BUAP_MODEL_API_KEY="..."
export BUAP_MODEL_TEMPERATURE=0.2
```

## 4. Local command for Xcode / ACP clients

Use this command as the local agent entrypoint:

```bash
node /Users/prismtek/Prismtek/buddy-universal-agent-profile/packages/buap-acp-agent/dist/index.js
```

If your checkout is somewhere else, replace `/Users/prismtek/Prismtek/buddy-universal-agent-profile` with the absolute path to the repo.

## 5. First-run personalization

When the agent starts and asks for setup, reply:

```text
/buap personalize user="Cody" buddy="Buddy" lil_buddy="Lil Buddy" buddy_profile=bmo lil_buddy_profile=finn
```

Then run:

```text
/buap help
```

## 6. Safe smoke commands inside the ACP chat

These should be safe to run first:

```text
/buap profiles
/buap read path=README.md
/buap patch path=README.md find="Buddy Universal Agent Profile" replace="Buddy Universal Agent Profile"
/buap git status
/buap mcp
```

## 7. Permissioned smoke commands

These require client capabilities and permission prompts.

File apply no-op:

```text
/buap apply path=README.md find="Buddy Universal Agent Profile" replace="Buddy Universal Agent Profile"
```

Terminal check:

```text
/buap run cmd="npm" args="run smoke"
```

The apply command should only write through the ACP client `fs/write_text_file` surface after permission. The run command should only run through ACP terminal methods after permission.

## 8. Troubleshooting

### Agent launches but cannot find BUAP files

Set:

```bash
export BUAP_REPO_ROOT="$HOME/Prismtek/buddy-universal-agent-profile"
```

### `/buap apply` says file write is unavailable

The ACP client did not advertise `clientCapabilities.fs.writeTextFile === true`. Use `/buap patch ...` and apply through the editor manually.

### `/buap run` says terminal is unavailable

The ACP client did not advertise `clientCapabilities.terminal === true`. Run the command manually in a terminal for now.

### `/buap ask` says the model backend is not configured

Set the `BUAP_MODEL_*` environment variables above, or continue using the local command-only mode.

## 9. Local verification outside the editor

Run:

```bash
cd ~/Prismtek/buddy-universal-agent-profile/packages/buap-acp-agent
npm run smoke
npm run build

cd ~/Prismtek/buddy-universal-agent-profile
node scripts/buap-conformance-check.mjs
```

All three checks should pass before calling the package ready for local editor use.
