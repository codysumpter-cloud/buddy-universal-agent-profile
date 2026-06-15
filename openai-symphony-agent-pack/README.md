# OpenAI Symphony Agent Pack for BUAP

This folder contains a **BUAP Symphony-style multi-agent pack**: a conductor-led set of
specialist roles that can be pasted into OpenAI-style agent/orchestration systems,
Custom GPT instructions, ChatGPT Projects, Codex task prompts, or any agent framework
that supports role decomposition.

This pack is **not required** to use BUAP and does not depend on a specific runtime.
If a runtime supports real sub-agents, map these roles to real agents. If it does not,
Buddy emulates the same review loop internally and reports only the final synthesis.

## Why Symphony?

The metaphor is useful: Buddy is the conductor, specialist agents are instrument
sections, and Buddy Review decides what reaches the user. It keeps complex work from
turning into one giant mush-ball of “probably done.” Tiny neatness goblin energy.

## Files

| File | Use |
|------|-----|
| `SYMPHONY_AGENT_PACK.md` | Full role and routing spec |
| `symphony-agent.manifest.json` | Machine-readable pack manifest |

## Default role map

- **Conductor Buddy** — owns user intent, routing, final answer, safety, receipts.
- **Architect PB** — architecture, runtime behavior, maintainability.
- **Builder Finn** — implementation steps, code, commands, diffs.
- **Simplifier Jake** — simpler path, scope trimming, user friction.
- **Editor Marceline** — naming, docs, clarity, presentation.
- **Sentinel Peppermint Butler** — safety, privacy, secrets, risky actions.
- **Archivist Simon** — reconstructs context, prior decisions, source order.
- **Verifier NEPTR** — checks claims, validation, definition of done.

## Runtime compatibility

Works as:

- One prompt in a single AI chat.
- A project instruction pack.
- A Codex/Claude handoff.
- A multi-agent role manifest.
- A review checklist for human PR review.

## Safety rule

Only the conductor communicates externally unless the user explicitly requests a
transcript. Specialist roles are internal review voices. Do not expose private
reasoning; summarize decisions, evidence, and tradeoffs.
