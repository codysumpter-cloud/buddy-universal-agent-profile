# Prismtek Agent Profile Protocol v1

Contract ID: `prismtek.agent-profile.v1`

Profile schema: `prismtek-agent-profile-v1`

State schema: `prismtek-agent-profile-state-v1`

## Purpose

Give BUAP a portable, first-class agent object: an identity with an ongoing mission,
bounded autonomy, memory scope, runtime targets, connected capabilities, approval rules,
scheduled work, activity state, and a stable relationship to Agent Life.

A profile is not merely a prompt or personality preset. It is an immutable contract a
host can instantiate and persist across sessions.

## Model

An agent profile has two layers:

1. **Compiled profile** — stable identity and policy. The host treats this as immutable.
2. **Runtime state** — pause status, capability bindings, task/activity history, and
   execution progress. The host persists this separately.

The same profile can run in ChatGPT Work, Codex, Hermes, a local daemon, an ACP client,
or a future native agent product. Hosts map the portable contract onto the capabilities
they actually provide.

## Identity

Every profile declares:

- a stable agent ID;
- display name and naming source;
- relationship role such as `buddy`, `lil_buddy`, or `specialist`;
- kind: `primary`, `specialist`, or `worker`;
- mission, goals, and responsibilities;
- optional handle/avatar/pet references.

"Buddy" is a relationship/role, not a required proper name.

## Mission and responsibility

The mission is the durable reason the agent exists. Goals are persistent outcomes;
responsibilities define the work the agent should notice and own.

Profiles SHOULD stay narrow enough that the user can understand what the agent is
responsible for and what it is not.

## Execution targets

Profiles may prefer one or more host targets:

- `chat`
- `work`
- `codex_cloud`
- `local_computer`
- `cloud_computer`
- `ide`
- `daemon`

A preference is not proof that the target is available. Capability negotiation still
governs every real action.

## Memory

Each agent receives a memory namespace. A profile may declare shared context namespaces,
write scopes, proactive-learning permission, and an optional Agent Life profile reference.

The host owns actual storage and retention. A namespace declaration alone never proves
memory is persisted.

## Capabilities and connectors

Profiles declare required, optional, and denied capabilities by symbolic ID. Hosts bind
those IDs to real tools, plugins, MCP servers, APIs, local skills, or computer access.

Profiles MUST NOT contain raw credentials, API keys, passwords, session cookies, or
tokens. Credential handling belongs to the host. A profile may store only opaque
credential/binding references supplied by that host.

## Action rules

Action rules determine the default review behavior for matching actions:

- `allow` — may proceed without a new approval when the host and policy allow it.
- `preapproved` — may proceed only when the current user request already approved it.
- `ask` — ask the user before execution.
- `handoff` — the user must perform or directly control the action.
- `deny` — do not perform the action.

Built-in safety, platform policy, and repo-local policy always outrank profile rules.

## Ongoing and scheduled work

Profiles may declare standing schedules, but the host owns timing and background
execution. Runtime state distinguishes queued, scheduled, in-progress, completed,
failed, and cancelled work.

The profile runtime can decide what is due and whether an action is permitted; it does
not pretend to be a daemon or scheduler when none exists.

## Activity and control

Hosts should expose enough runtime state for the user to inspect:

- queued / in-progress work;
- scheduled work;
- completed / failed work;
- capability bindings;
- recent activity;
- paused / active status.

Pausing an agent blocks new task starts. Resetting or deleting durable state is a host
operation and should require explicit user intent.

## Agent Life integration

`prismtek.agent-profile.v1` is the outer operating shell. `prismtek.agent-life.v1`
is the bounded developmental layer underneath it.

Agent Profile owns mission, identity, runtime bindings, tools, approvals, schedules,
and activity. Agent Life owns bounded drives, traits, preferences, relationships,
developmental stages, and provenance-backed learning.

Learned Agent Life state may influence recommendations but may never expand Agent
Profile permissions or action rules.

## Host responsibilities

A conforming host:

1. validates the profile;
2. persists runtime state separately from the profile;
3. verifies real capabilities before binding them;
4. enforces approval rules before side effects;
5. persists scheduled work only when it has a scheduler;
6. persists memory only when it has a memory store;
7. records receipts for external actions;
8. exposes pause/resume controls;
9. never reports a preferred execution target as connected unless verified.

## Native-product boundary

BUAP Agent Profiles can model and run the portable semantics of an always-on agent, but
they do not create vendor-native entitlements, cloud computers, messaging identities,
or proprietary UI surfaces. Those are host capabilities.

When a native agent product becomes available, its adapter should map this contract to
the native profile instead of creating a second competing identity system.
