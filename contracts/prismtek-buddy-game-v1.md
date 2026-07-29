# Prismtek Buddy Game Protocol v1

Contract ID: `prismtek.buddy-game.v1`

Wire version: `prismtek-buddy-game-v1`

## Purpose

Give native and hosted Prismtek games one stable, provider-neutral way to use Buddy policy, model routing, task lifecycle, approvals, and durable memory without embedding provider credentials or granting a game repository authority.

## Transports

Both transports expose:

- `GET /health`
- `GET /v1/tools`
- `POST /v1/call`

Native games use the guarded loopback `buddy-serve` transport from Buddy Agent. Hosted games use a same-origin authenticated adapter, currently Prismtek.dev Pages Functions.

The JSON call envelope is validated by `schemas/prismtek-buddy-game.schema.json`.

## Required tool families

A conforming full local runtime provides:

- `buddy.game.status`
- `buddy.game.chat`
- `buddy.task.*`
- `buddy.status`
- `buddy.project_context`
- `buddy.vault_search`
- `buddy.repo_overview`

A hosted runtime may omit local repository context tools, but must report that absence in `buddy.game.status.capabilities`. It must not silently simulate repository access.

## Game commands

`buddy.game.chat` may propose only:

- `buddy.walk_to`
- `buddy.use_item`
- `focus.start`
- `focus.pause`
- `focus.reset`
- `room.save`

Proposals are not execution receipts. The game owns final validation against current state and may reject any command.

## Capability truthfulness

`buddy.game.status` must report at least:

- protocol version;
- provider name/model/configured state;
- chat availability;
- persistent task availability;
- durable memory-event availability;
- repository execution availability;
- container-sandbox availability when relevant;
- production-action availability.

A Web adapter must report repository execution, container access, and production actions as unavailable unless those capabilities are actually enforced and separately approved.

## Security boundary

The game client must never embed:

- model or API keys;
- GitHub credentials;
- account-session tokens;
- raw browser state;
- private local paths;
- unrestricted tool names;
- shell or repository-execution arguments.

The local bridge is loopback-first. Non-loopback binding requires explicit opt-in and authentication. Hosted access is account-scoped through the owning product's session layer.

## Durable state

Task identity and lifecycle follow Buddy Agent semantics:

```text
created → planned/awaiting_approval → running → completed|failed|cancelled
                                         ↑              |
                                         └──── resume ──┘
```

Write, repository-mutation, and destructive risk classes require attributable human approval. Durable events use:

- `task_created`
- `task_state_changed`
- `task_completed`

Lifecycle events must exclude raw task objectives, approval notes, prompts, tool I/O, credentials, browser state, private paths, and private source excerpts.

## Ownership

- **BUAP:** policy, schema, compatibility and conformance.
- **Buddy Agent:** canonical local runtime, providers, MCP tools, task state, approvals and guarded HTTP transport.
- **Buddy Brain:** policy/economics feedback and readiness interpretation.
- **KnowledgeVault:** durable public-safe lifecycle events and future explanation retrieval.
- **Omni Buddy:** optional local voice/vision/device transport into the same protocol.
- **Prismtek Apps:** game UI, current-world context and final in-game command validation.
- **Prismtek Site:** authenticated hosted adapter and account-scoped persistence.

## Claim boundary

A successful game-protocol response proves only that the runtime produced a response or changed task state. It does not prove that an in-game command, repository mutation, artifact verification, merge, release, or deployment occurred. Those claims require receipts from the owning executor and verifier.
