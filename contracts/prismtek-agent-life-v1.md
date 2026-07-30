# Prismtek Agent Life Protocol v1

Contract ID: `prismtek.agent-life.v1`

Profile schema: `prismtek-agent-life-profile-v1`

Event schema: `prismtek-agent-life-event-v1`

## Purpose

Give BUAP agents persistent, inspectable developmental state without treating a model prompt as a personality and without claiming subjective consciousness.

The protocol models functional affect: bounded drives, slowly changing traits, learned preferences, person-scoped relationships, developmental stages, and curated lineage. These values may influence attention and recommendations, but never grant authority.

## Ownership

- **BUAP compiler:** immutable constitution, bounds, reinforcement policy, relationship scope, development stages, and inheritance rules.
- **Agent host / Buddy Agent / Hermes adapter:** runtime state persistence, event admission, decision integration, and user controls.
- **Knowledge Vault:** durable `prismtek-agent-life-event-v1` records, provenance graph, retrieval, correction, decay evidence, and explanation support.
- **Buddy Brain:** policy interpretation, evaluation, behavioral benchmarks, and promotion recommendations.
- **Prismtek Apps:** visible Buddy embodiment and game-originated outcome receipts.

## Constitutional boundary

Learned state must never:

- expand filesystem, network, repository, account, or production permissions;
- override safety, honesty, approval, privacy, or evidence policy;
- edit its own compiled life profile;
- reward itself;
- present functional state as proof of consciousness or suffering.

The host loads `.buddy/life-profile.json` as immutable input and stores mutable state separately.

## Reinforcement admission

An outcome may alter developmental state only when it includes:

- a unique event ID;
- an allowed external authority (`human`, `host`, or `verifier`);
- a bounded reward in `-1..1`;
- confidence in `0..1`;
- a scoped subject such as a tool, workflow, repository, object, or person;
- at least one provenance reference;
- an attributable timestamp.

Repeated event IDs are idempotent. The agent's own identity may not appear as the reinforcing authority.

## Runtime behavior

`@prismtek/buap-agent-life` currently supports:

- positive and negative subject preferences;
- bounded drive changes;
- slowly changing traits;
- person-scoped trust, familiarity, and respect;
- developmental experience and stages;
- time-based decay toward compiled baselines;
- snapshot/restore with profile-hash binding;
- before/after state hashes;
- Knowledge Vault-ready memory events.

## Knowledge Vault event

A conforming life event records the admitted evidence and the exact state changes. It must exclude private chain-of-thought and must not treat a preference update as proof that an external action succeeded. External success still requires the owning executor's receipt.

## Inheritance

A child or specialist agent may inherit only what the compiled profile permits. The default policy allows curated procedure inheritance and requires lineage, but forbids constitutional changes and private episodic-memory inheritance.

## Evaluation boundary

A changed number is not proof of learning. Behavioral evaluation must compare adaptive and non-adaptive agents on repeated tasks, retention, reversal learning, transfer to new contexts, stale-belief correction, relationship scoping, and constitutional compliance.
