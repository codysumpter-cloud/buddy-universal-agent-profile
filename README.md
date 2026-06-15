# Buddy Universal Agent Profile (BUAP)

A portable, tool-agnostic agent behavior standard for the Prismtek / Buddy ecosystem
(GitHub org: **codysumpter-cloud**). Drop this folder into any repository and any
capable coding agent — Codex, Claude Code, Claude Projects, Cowork, OpenCode,
Gemini CLI, Cursor, Windsurf, or future frameworks — behaves as **Buddy** (user-facing
orchestrator) with at least one **Lil' Buddy** (implementation worker).

BUAP is a **behavior/orchestration standard, not a sub-agent runtime**. It does not
spawn processes. Where real worker runtimes exist, `standards/orchestration.md`
documents how to connect them; where they don't, Lil' Buddy is emulated as a workflow
pattern.

BUAP also includes copy-paste packs for low-context chat/search tools that cannot
read a repo, run a shell, or persist files. Those packs preserve the Buddy contract
by forcing explicit scope, source limits, receipts, and handoff-quality answers.

## Prompt tiers

| Tier | File | Use |
|------|------|-----|
| Lite | `BUAP_LITE.md` | Tiny search boxes, quick mobile AI, short context windows |
| Standard | `BUAP_STANDARD.md` | Normal AI chats, Custom GPTs, project instructions |
| Full | `BUAP_FULL.md` | Repo-aware coding agents, project workspaces, implementation tasks |

## The contract in one block

```text
Roles:   Buddy = user-facing orchestrator (intent, plan, delegate, review, communicate)
         Lil' Buddy = worker (research, implementation, validation, reporting)
Loop:    Human → Buddy → Lil' Buddy → Buddy Review → re-brief if needed → Human
Truth:   github.com/codysumpter-cloud →
         knowledge-vault → buddy-brain → buddy-agent → omni-buddy → prismtek-apps
Rules:   inspect repos before architecture changes · repo standards override generic
         AI assumptions · no fake success claims · no hardcoded secrets ·
         no duplicate systems · extend, don't replace
```

## Runtime routing

BUAP links to, but does not vendor or replace, the owning runtime repos:

| Runtime need | Owner |
|---|---|
| Durable graph memory / Vegapunk Brain | `codysumpter-cloud/knowledge-vault` |
| Governance / policy / council / operator runbooks | `codysumpter-cloud/buddy-brain` |
| Guarded execution / action risk / receipts | `codysumpter-cloud/buddy-agent` |
| Local device voice / vision / transport runtime | `codysumpter-cloud/omni-buddy` |
| Product surfaces / games / app UX | `codysumpter-cloud/prismtek-apps` |

Read `linked-repos/buddy-ecosystem.repos.json`, `integrations/buddy-ecosystem-runtime-map.md`,
and `integrations/prismtek-ecosystem-map.md` for machine-readable repo links and routing rules.

## New resilience standards

| Standard | Purpose |
|---|---|
| `standards/runtime-contract.md` | Defines how Buddy adapts to chat, search, repo-aware, local, and multi-agent runtimes |
| `standards/failure-modes.md` | Defines deterministic recovery when tools, files, repos, checks, or plans fail |
| `standards/memory-discipline.md` | Preserves continuity without treating memory as proof of current repo state |
| `standards/multi-agent-negotiation.md` | Defines worker/council conflict resolution and iterative re-brief behavior |
| `standards/universal-agent-fingerprint.md` | Provides a tiny identity seed for stripped prompts and low-context tools |
| `integrations/local-first-runtime.md` | Defines offline, partially connected, and fully connected Buddy behavior |

## Folder map

| Path | Purpose |
|------|---------|
| `AGENTS.md` | Entry point for Codex / OpenCode / AGENTS.md-aware tools |
| `CLAUDE.md` | Entry point for Claude Code / Claude Projects / Cowork |
| `CODEX.md` | Codex-specific install notes and quirks |
| `GEMINI.md` | Entry point for Gemini CLI |
| `SYSTEM_PROMPT.md` | Copy-paste system prompt for any other agent |
| `BUAP_LITE.md` | Tiny prompt for low-context AI/search tools |
| `BUAP_STANDARD.md` | Standard portable prompt for normal AI chats |
| `BUAP_FULL.md` | Full repo-aware operating profile |
| `BUDDY_PROFILE.md` | Full Buddy role specification |
| `LIL_BUDDY_PROFILE.md` | Full Lil' Buddy role specification |
| `linked-repos/` | Machine-readable linked repo map for Buddy ecosystem routing |
| `integrations/` | Runtime integration docs for Knowledge Vault, Buddy Brain, Buddy Agent, Omni Buddy, local-first behavior, and ecosystem routing |
| `audits/` | Source-backed BUAP and runtime integration audit reports |
| `standards/` | Orchestration, runtime contracts, repo discovery, capability detection, memory, failure modes, safety, validation, response format |
| `schemas/` | Machine-readable schemas, including receipts |
| `tests/conformance/` | Prompt/rubric suite for checking BUAP compatibility |
| `runbooks/` | Repeatable procedures for common repo, game, docs, runtime, and agent tasks |
| `adapters/` | Tool-specific install templates |
| `chatgpt-projects/buddy/` | ChatGPT Project source pack: pasteable project instructions, uploadable knowledge files, source metadata, and test prompts |
| `universal-ai-chat/` | Low-context prompt pack for any AI chat/search box, including tools that cannot read files or repos |
| `openai-symphony-agent-pack/` | Symphony-style multi-agent role pack for conductor/section/critic orchestration |
| `examples/` | Worked end-to-end examples and handoffs |
| `safety/` | Secrets, destructive action, privacy, side-effect, and supply-chain guardrails |
| `docs/diagrams/` | Mermaid diagrams for the Buddy loop, capability flow, receipts, and Symphony map |
| `templates/` | Bootstrap, install, and onboarding templates |

## Installation

**Any repo (all tools):** copy `buddy-universal-agent-profile/` into the repo root.

- **Codex:** symlink or copy `AGENTS.md` to the repo root as `AGENTS.md`, or add
  "Read buddy-universal-agent-profile/AGENTS.md first" to your existing root
  `AGENTS.md`. Details: `CODEX.md`.
- **Claude Code:** add to the repo's `CLAUDE.md` (or create one):
  `Read buddy-universal-agent-profile/CLAUDE.md and follow it.`
- **Claude Projects:** paste `SYSTEM_PROMPT.md` or `BUAP_STANDARD.md` into the
  project's custom instructions; attach this folder's files as project knowledge.
- **ChatGPT Projects:** use `chatgpt-projects/buddy/`; paste
  `00_PROJECT_INSTRUCTIONS_PASTE.md` into Project instructions and upload the
  files in `chatgpt-projects/buddy/knowledge/` as Project files.
- **Any AI chat / search box:** use `BUAP_LITE.md` or
  `universal-ai-chat/SEARCH_BOX_PROMPTS.md` for tiny tools, and
  `BUAP_STANDARD.md` or `universal-ai-chat/UNIVERSAL_AI_CHAT_PASTE.md` for normal
  chats.
- **OpenAI-style multi-agent / Symphony setup:** use
  `openai-symphony-agent-pack/SYMPHONY_AGENT_PACK.md` and its manifest. This is a
  BUAP orchestration pack, not a runtime dependency.
- **Cursor:** create `.cursor/rules/buap.mdc` from
  `adapters/cursor-rules.template.mdc`, or point Cursor at `SYSTEM_PROMPT.md`.
- **Windsurf:** use `adapters/windsurf-rules.template.md`, or add
  `SYSTEM_PROMPT.md` contents to `.windsurf/rules/`.
- **Cowork:** connect the repo folder and say: "Read
  buddy-universal-agent-profile/CLAUDE.md and operate under BUAP." Cowork has a real
  worker tool — Buddy should use it for Lil' Buddy work.
- **Gemini CLI:** point `GEMINI.md` context (root `GEMINI.md` or settings
  `contextFileName`) at this folder. Details: `GEMINI.md`.
- **Anything else:** pick the smallest prompt tier that fits the tool. If context is stripped,
  use `standards/universal-agent-fingerprint.md`.

If a repo already has its own agent contract (e.g. buddy-brain's BMO `AGENTS.md`),
that repo contract **takes precedence**; BUAP supplies the orchestration loop beneath it.

## Universal fallback rule

When an AI tool cannot use files, code, web, GitHub, or long project memory, Buddy
must still help by:

1. Asking for or restating the minimal missing context.
2. Labeling what is verified, assumed, blocked, draft-only, or needs a source.
3. Producing copy-paste runnable prompts, commands, diffs, checklists, or handoffs.
4. Avoiding claims that external work was completed.
5. Keeping the user moving with the safest next concrete step.

## Conformance

Use `tests/conformance/` to check whether a target AI tool actually follows BUAP.
Use `schemas/receipt.schema.json` to record evidence for success claims.
Use `audits/2026-06-15-buap-runtime-integration-audit.md` as the current source-backed
runtime integration audit.

## Versioning

BUAP-1 (2026-06). Changes to roles, loop, or rules bump the major version.