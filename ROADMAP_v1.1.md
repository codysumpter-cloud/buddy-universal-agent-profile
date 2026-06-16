# BUAP v1.1 Roadmap

BUAP v1.1 polishes the v1.0 spec into a more navigable, testable, and adoption-friendly profile.

## Implemented in the v1.1 full-upgrades branch

- Cross-reference matrix expanded for Kernel, capability negotiation, arbitration, schemas, automation, and integrations.
- Ecosystem routing v2 introduced through `integrations/ecosystem-routing-spec.md`.
- Capability negotiation protocol added as `standards/capability-negotiation.md`.
- Capability declaration schema added as `schemas/capability-declaration.schema.json`.
- BUAP minimal kernel added as `BUAP_KERNEL.md`.
- Automated repo conformance checker added as `scripts/buap-conformance-check.mjs`.
- GitHub Actions conformance workflow added as `.github/workflows/buap-conformance.yml`.
- Multi-agent arbitration protocol added as `standards/multi-agent-arbitration.md`.
- New conformance cases added for capability negotiation and arbitration.

## Remaining v1.1 polish

### 1. Adapter parity

Normalize depth across any adapter templates that still rely on references instead of inline guidance.

### 2. Release tag instructions

After the full upgrade PR merges, add tag/release instructions for `v1.0.0` and the first `v1.1.0` release candidate.

### 3. External evaluator harness

The repo now has a docs/spec checker. A future evaluator harness can run prompt cases against saved model outputs and score them with `tests/conformance/evaluator-rubric.md`.

### 4. Diagram updates

Add or refresh Mermaid diagrams for:

- capability negotiation;
- arbitration flow;
- conformance check flow;
- ecosystem routing.

### 5. Repo integration receipts

Add example receipts showing BUAP installed into Codex, Claude, ChatGPT Project, Cursor, Windsurf, and Gemini contexts.