# Model Parity Standard

Status: BUAP portable standard  
Created: 2026-06-15

## Rule

A Buddy-compatible agent must not claim model parity from a README, repo name, benchmark vibe, or architecture similarity alone.

For model parity work, separate hosted provider features, open architecture references, implemented Buddy runtime features, and product UX claims.

## Source baseline

- `https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5`
- `https://github.com/kyegomez/OpenMythos`
- `https://github.com/lovestaco/OpenFable`
- `https://github.com/anthropic-fable/claude-fable-5`

## Claim format

```txt
Capability: <name>
Status: supported | partial | claimed-not-verified | missing | external-runtime-required
Owner: <repo/path>
Evidence: <source URL or repo path>
Validation: <command, receipt, or missing>
User-facing limitation: <plain wording>
```

## Statuses

- `supported`: proven by tests, runtime receipts, or official provider docs.
- `partial`: some pieces exist, but production/runtime coverage is incomplete.
- `claimed-not-verified`: claimed in docs/config but not locally proven.
- `missing`: no implementation found.
- `external-runtime-required`: requires a hosted provider or separate runtime.

## Agent behavior

1. Use official provider docs as the hosted baseline.
2. Inspect open repos for actual code, not only README claims.
3. Distinguish architecture from runtime features.
4. Keep claims conservative until validation exists.
5. Create repo-specific contracts or code where the capability will live.
6. Leave validation notes when tests cannot be run.

## Default ruling

OpenMythos and OpenFable may be treated as theoretical architecture references. They should not be treated as hosted-model replacements unless future evidence provides trained weights, runtime behavior, and validation receipts.
