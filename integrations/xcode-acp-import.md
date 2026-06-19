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

## BUAP files to load

A BUAP ACP agent should load these in order:

1. `XCODE_ACP_BUAP.md`
2. `BUAP_FULL.md` or `BUAP_STANDARD.md`
3. `personalization/PERSONALIZATION_HANDSHAKE.md`
4. `personalization/BUDDY_LIL_BUDDY_PROFILE_SELECTION.md`
5. `personalization/bmo-council-personality-profiles.json`
6. `schemas/buap-personalization.schema.json`

## Registry metadata

Start from:

```text
adapters/xcode-acp-agent.template.json
```

Before publishing/importing, replace the placeholder package name with a real ACP server package that exposes the BUAP agent over the transport expected by the client.

## Safety contract

Xcode/editor permissions are the hard boundary. Lil Buddy can act inside granted capabilities only. Buddy still owns the final answer and must ask before risky changes.
