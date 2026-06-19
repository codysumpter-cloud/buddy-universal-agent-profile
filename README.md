# Buddy Universal Agent Profile (BUAP)

A portable, tool-agnostic agent behavior standard for the Prismtek / Buddy ecosystem
(GitHub org: **codysumpter-cloud**). Drop this folder into any repository and any
capable coding agent — Codex, Claude Code, Claude Projects, Cowork, OpenCode,
Gemini CLI, Grok/xAI, Cursor, Windsurf, Xcode/ACP clients, Siri/App Intents hosts, or future frameworks — behaves as **Buddy** (user-facing
orchestrator) with at least one **Lil' Buddy** (implementation worker).

BUAP is a **behavior/orchestration standard, not a sub-agent runtime** by default. It does not
spawn processes unless a host package explicitly implements a runtime adapter. Where real worker runtimes exist, `standards/orchestration.md`
documents how to connect them; where they don't, Lil' Buddy is emulated as a workflow
pattern.

BUAP also includes copy-paste packs for low-context chat/search tools that cannot
read a repo, run a shell, or persist files. Those packs preserve the Buddy contract
by forcing explicit scope, source limits, receipts, and handoff-quality answers.

## Prompt tiers

| Tier | File | Use |
|------|------|-----|
| Kernel | `BUAP_KERNEL.md` | Micro-profile for constrained tools and stripped contexts |
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

Read `integrations/ecosystem-routing-spec.md` first for canonical routing. Use
`linked-repos/buddy-ecosystem.repos.json`, `integrations/buddy-ecosystem-runtime-map.md`,
and `integrations/prismtek-ecosystem-map.md` for supporting machine-readable links and detail.

## Resilience and negotiation standards

| Standard | Purpose |
|---|---|
| `standards/runtime-contract.md` | Defines how Buddy adapts to chat, search, repo-aware, local, and multi-agent runtimes |
| `standards/capability-negotiation.md` | Declares available capabilities and selects execute/inspect/draft/handoff/blocked mode |
| `standards/failure-modes.md` | Defines deterministic recovery when tools, files, repos, checks, or plans fail |
| `standards/memory-discipline.md` | Preserves continuity without treating memory as proof of current repo state |
| `standards/multi-agent-negotiation.md` | Defines worker/council conflict resolution and iterative re-brief behavior |
| `standards/multi-agent-arbitration.md` | Resolves worker/source/path disagreement with evidence-backed decisions |
| `standards/universal-agent-fingerprint.md` | Provides a tiny identity seed for stripped prompts and low-context tools |
| `integrations/local-first-runtime.md` | Defines offline, partially connected, and fully connected Buddy behavior |

## Folder map

| Path | Purpose |
|------|---------|
| `AGENTS.md` | Entry point for Codex / OpenCode / AGENTS.md-aware tools |
| `CLAUDE.md` | Entry point for Claude Code / Claude Projects / Cowork |
| `CODEX.md` | Codex-specific install notes and quirks |
| `GEMINI.md` | Entry point for Gemini CLI |
| `GROK_BUAP.md` | Copy-paste Grok/xAI profile that adapts BUAP into Grok custom instructions or chats |
| `SIRI_BUAP.md` | Siri/App Intents adapter profile |
| `XCODE_ACP_BUAP.md` | Xcode / Agent Client Protocol adapter profile |
| `SYSTEM_PROMPT.md` | Copy-paste system prompt for any other agent |
| `BUAP_KERNEL.md` | Micro-profile for constrained tools |
| `BUAP_LITE.md` | Tiny prompt for low-context AI/search tools |
| `BUAP_STANDARD.md` | Standard portable prompt for normal AI chats |
| `BUAP_FULL.md` | Full repo-aware operating profile |
| `BUDDY_PROFILE.md` | Full Buddy role specification |
| `LIL_BUDDY_PROFILE.md` | Full Lil' Buddy role specification |
| `plugins/buap/` | Native Claude Code and Codex plugin assets: Lil Buddy profile, BUAP runbook skills, slash commands, and safety/receipts hooks |
| `.claude-plugin/marketplace.json` | Plugin marketplace manifest so BUAP installs via `/plugin install buap@buap` |
| `packages/buap-acp-agent/` | Local stdio ACP server package for Xcode/ACP clients |
| `packages/buap-knowledge-vault/` | Local KnowledgeVault Markdown index/search helper |
| `packages/buap-apple-notes-reminders/` | macOS-only Apple Notes/Reminders helper (osascript) used by the ACP agent |
| `personalization/` | Personalization handshake and Buddy/Lil Buddy profile selection assets |
| `linked-repos/` | Machine-readable linked repo map for Buddy ecosystem routing |
| `integrations/` | Runtime integration docs and canonical ecosystem routing |
| `audits/` | Source-backed BUAP and runtime integration audit reports |
| `standards/` | Orchestration, runtime contracts, capability negotiation, memory, failure modes, validation, response format |
| `schemas/` | Machine-readable schemas, including receipts and capability declarations |
| `tests/conformance/` | Prompt/rubric suite for checking BUAP compatibility |
| `scripts/` | Local validation and conformance helper scripts |
| `.github/workflows/` | CI checks for BUAP docs/spec conformance |
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
- **Codex plugin:** use `plugins/buap/.codex-plugin/plugin.json` for native Codex
  plugin metadata, BUAP skills, slash-command prompts, Lil Buddy profile assets, and
  safety/receipts hooks. Details: `plugins/buap/README.md`.
- **Claude Code:** add to the repo's `CLAUDE.md` (or create one):
  `Read buddy-universal-agent-profile/CLAUDE.md and follow it.`
- **Claude Code (plugin, recommended):** install BUAP as a native plugin so the loop is
  structural, not just prose — a real `lil-buddy` worker subagent, BUAP runbooks as skills,
  `/buap-audit` and `/buap-handoff` commands, and safety/receipts hooks:
  ```
  /plugin marketplace add codysumpter-cloud/buddy-universal-agent-profile
  /plugin install buap@buap
  ```
  Details: `plugins/buap/README.md`. For repo-wide permission/secret-read guardrails, copy
  `templates/claude-settings.preset.json` into the consuming repo's `.claude/settings.json`.
- **Claude Projects:** paste `SYSTEM_PROMPT.md` or `BUAP_STANDARD.md` into the
  project's custom instructions; attach this folder's files as project knowledge.
- **ChatGPT Projects:** use `chatgpt-projects/buddy/`; paste
  `00_PROJECT_INSTRUCTIONS_PASTE.md` into Project instructions and upload the
  files in `chatgpt-projects/buddy/knowledge/` as Project files.
- **Grok / xAI:** paste `GROK_BUAP.md` into Grok custom instructions or start a
  chat with `Operate under GROK_BUAP`; use `BUAP_STANDARD.md` or
  `universal-ai-chat/UNIVERSAL_AI_CHAT_PASTE.md` when broader portable chat behavior fits better.
- **Siri / App Intents hosts:** start with `SIRI_BUAP.md`, `README_SIRI.md`, and
  `integrations/apple-siri-app-intents.md`.
- **Xcode / ACP clients:** build `packages/buap-acp-agent/` and point the client at
  `node packages/buap-acp-agent/dist/index.js`. Details: `XCODE_ACP_BUAP.md` and
  `integrations/xcode-acp-import.md`.
  For local verification and first-run setup, see
  `docs/local-buap-doctor-and-bootstrap.md`.
  For local KnowledgeVault search, see `docs/knowledge-vault-search.md`.
- **Any AI chat / search box:** use `BUAP_KERNEL.md` or `BUAP_LITE.md` for tiny tools,
  and `BUAP_STANDARD.md` or `universal-ai-chat/UNIVERSAL_AI_CHAT_PASTE.md` for normal chats.
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
Use `schemas/capability-declaration.schema.json` to record capability declarations.
Use `docs/cross-reference-matrix.md` to confirm standards, prompt tiers, adapters,
tests, and integrations stay aligned.

Run the local docs/spec check with:

```bash
node scripts/buap-conformance-check.mjs   # required files + key text
node scripts/buap-lint.mjs                 # plugin manifests, agent/skill frontmatter,
                                           # repo-wide relative links, prompt-tier invariants
```

Both checks run in `.github/workflows/buap-conformance.yml` for Markdown, JSON, plugin,
and script changes.

## Versioning

BUAP-1 (2026-06). Changes to roles, loop, or rules bump the major version.
