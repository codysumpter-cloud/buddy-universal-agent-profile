# BUAP v1.1 Roadmap

BUAP v1.1 should polish the v1.0 spec into a more navigable, testable, and adoption-friendly profile.

## 1. Cross-reference matrix

Create and maintain a single map of:

- standards to prompt tiers;
- standards to adapters and overlays;
- standards to conformance tests;
- standards to integrations and runbooks.

## 2. Ecosystem routing v2

Promote `integrations/ecosystem-routing-spec.md` as the canonical routing document. Keep `buddy-ecosystem-runtime-map.md` and `prismtek-ecosystem-map.md` as focused reference docs or forwards.

## 3. Capability negotiation protocol

Extend capability detection into a declaration/negotiation format that tools can expose or Buddy can infer:

- file read/write;
- repo read/write;
- command/check execution;
- web/current facts;
- persistent memory;
- external side effects;
- real or emulated workers.

## 4. BUAP minimal kernel adoption

Use `BUAP_KERNEL.md` as the stable micro-profile for tiny tools, search boxes, mobile assistants, and constrained custom-instruction fields. Keep it aligned with Lite, Standard, and Full.

## 5. Automated conformance runner

Add a script or workflow that can run conformance prompts against a target tool or saved output. Store scores and receipts in a consistent format.

## 6. Multi-agent arbitration protocol

Extend `standards/multi-agent-negotiation.md` with formal arbitration examples:

- worker disagreement;
- source conflict;
- safety conflict;
- incomplete validation;
- user intent versus repo convention.

## 7. Documentation polish

- Add standard-to-test links to each standard.
- Normalize adapter depth where possible.
- Reduce duplicated routing language.
- Give overlays one canonical home and thin references elsewhere.
- Add v1.0.0 release tag instructions after the release is cut.