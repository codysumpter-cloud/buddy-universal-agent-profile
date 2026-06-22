# BUAP soul / bootstrap files

BUAP-aligned persona and bootstrap files for soul-style agents — **Hermes** and
**OpenClaw** — so they boot as **Buddy** under the Buddy Universal Agent Profile instead
of a generic assistant.

These are not templates with placeholders; copy them as-is (then edit `USER.md` /
`MEMORY.md` for your own context).

## Files

| File | Purpose | Used by |
|---|---|---|
| `SOUL.md` | Buddy persona, the loop, non-negotiable rules, pairing | Hermes + OpenClaw |
| `IDENTITY.md` | Capabilities, capability-check modes, source of truth, boundaries | OpenClaw |
| `USER.md` | User context (Cody / Prismtek defaults; pairing; memory vault) | OpenClaw |
| `AGENTS.md` | Tool use, delegation, safety | OpenClaw |
| `MEMORY.md` | Persistent-knowledge seed (loads last) | OpenClaw |

OpenClaw loads them in order — `SOUL.md` → `IDENTITY.md` → `USER.md` → `AGENTS.md` →
`MEMORY.md` — with `SOUL.md` first (highest attention) and `MEMORY.md` last.

## Install

**Hermes** (persona only; loaded fresh each message):

```bash
cp adapters/soul/SOUL.md ~/.hermes/SOUL.md
```

**OpenClaw** (full bootstrap set in the agent workspace):

```bash
mkdir -p ~/.openclaw/agents/<agentId>/workspace
cp adapters/soul/SOUL.md adapters/soul/IDENTITY.md adapters/soul/USER.md \
   adapters/soul/AGENTS.md adapters/soul/MEMORY.md \
   ~/.openclaw/agents/<agentId>/workspace/
```

After installing, edit `USER.md` and `MEMORY.md` to match the actual user. Keep `SOUL.md`
concise (OpenClaw's own guidance: ~200–500 words) — every line should earn its place.

## Relation to the rest of BUAP

This is a thin persona surface. The full contract lives in `BUAP_FULL.md`,
`BUDDY_PROFILE.md`, `LIL_BUDDY_PROFILE.md`, and `standards/`. For agents with real
harness primitives (subagents, skills, hooks), prefer the native plugin in
`plugins/buap/` over a prose-only soul file.
