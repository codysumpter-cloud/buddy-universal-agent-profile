# Prismtek Trust Fabric — public interface overview

Prismtek separates retrieval, policy, execution, verification, and durable memory so that no single model or provider can silently promote its own output into trusted action.

A provider integration may supply candidate evidence through a provider-neutral adapter. Prismtek then returns an explicit state such as:

- `allow` — the evidence satisfies the applicable task policy;
- `review` — a designated reviewer must adjudicate before execution;
- `block` — the evidence cannot authorize the proposed action.

A retrieval result is not a verified completion. Verified completion additionally requires a bounded execution policy, a real artifact or measurable external result, applicable security evidence, and a receipt.

## Public integration boundary

External providers may implement a reduced `retrieval.evidence.v1` interface containing stable source identity, optional timestamps, optional lineage relationships, provider signals, and a reproducible reference when available.

The public contract intentionally omits Prismtek's internal decision logic, arbitration behavior, enforcement design, commercial evaluation, and complete orchestration.

See [`examples/trust-fabric.sample.json`](../../examples/trust-fabric.sample.json) for a non-executable example.

## Scope

This public surface is sufficient for compatibility discussion and prototype adapters. Production integrations, private policy behavior, and partner-specific evaluations require an explicit commercial and confidentiality boundary.
