# Xcode ACP Import Notes

Use this note when adapting BUAP for Xcode custom-agent import through Agent Client Protocol.

## What ACP provides

ACP is the editor/IDE transport layer. It lets an ACP client connect to an ACP-compatible coding agent without every editor and agent needing a custom one-off integration.

For BUAP, ACP should carry:

- workspace/session context
- user prompts
- agent progress updates
- file/tool/terminal capability boundaries
- editor permission requests
- Markdown user-facing responses
- patch/diff-oriented coding outputs

## Local runnable package

This branch includes the first BUAP ACP agent package:

```text
packages/buap-acp-agent/
```

From that folder:

```bash
npm install
npm run smoke
npm run build
node dist/index.js
```

For local Xcode/ACP import before publishing, point the client command at:

```bash
node /absolute/path/to/buddy-universal-agent-profile/packages/buap-acp-agent/dist/index.js
```

Optional environment:

```bash
BUAP_REPO_ROOT=/absolute/path/to/buddy-universal-agent-profile
BUAP_PERSONALIZATION_FILE=/absolute/path/to/.buap/personalization.json
```

## BUAP files loaded by the package

The ACP agent loads these in order:

1. `XCODE_ACP_BUAP.md`
2. `BUAP_FULL.md`
3. `personalization/PERSONALIZATION_HANDSHAKE.md`
4. `personalization/BUDDY_LIL_BUDDY_PROFILE_SELECTION.md`
5. `personalization/bmo-council-personality-profiles.json`
6. `schemas/buap-personalization.schema.json`

## Registry metadata

Start from:

```text
adapters/xcode-acp-agent.template.json
```

The template now points at `@prismtek/buap-acp-agent@0.1.0`. Keep using the local command above until the package is published or made available through your preferred private package registry.

## Safety contract

Xcode/editor permissions are the hard boundary. Lil Buddy can act inside granted capabilities only. Buddy still owns the final answer and must ask before risky changes.
