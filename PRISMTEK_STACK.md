# Prismtek Buddy Stack

This repository is one component of the **Prismtek Buddy Agent Platform**. It is not a standalone description of the whole system.

## This repository owns

**Portable policy compilation, capability negotiation, ecosystem routing, and conformance.**

It must not absorb responsibilities owned by sibling repositories. Cross-repo behavior is declared in [`prismtek.component.json`](prismtek.component.json), while the canonical topology lives in [`linked-repos/prismtek-stack.manifest.json`](linked-repos/prismtek-stack.manifest.json).

## Runtime chain

```text
KnowledgeVault / Vegapunk Brain  -> durable memory and provenance
Buddy Brain                      -> governance, policy, and economics
BUAP                             -> deterministic policy compilation and routing
Buddy Agent                      -> guarded execution, evidence, and receipts
Omni Buddy                       -> local voice, vision, and device runtime
Prismtek Apps                    -> product and user-facing experiences
```

## Trust Fabric integration

External retrieval providers can supply cited evidence, but they do not become the source of Prismtek policy or execution authority. Buddy Agent normalizes evidence, applies freshness/conflict/trust rules, and produces verification receipts. KnowledgeVault records accepted events; Buddy Brain measures policy outcomes and cost per verified completion.

## Contract rule

Changes to owned or consumed contracts must update `prismtek.component.json` and the canonical stack manifest in the same coordinated change set. No repository may claim another repository's runtime behavior without a source-backed receipt or passing integration check.
