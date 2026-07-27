# BUAP Compiler

`@prismtek/buap-compiler` turns canonical BUAP modules into deterministic, diffable repository instructions and policy files.

It generates:

```text
AGENTS.md
REVIEW.md
.buddy/policy.yaml
.buddy/claims.yaml
.buddy/providers/codex.yaml
.buddy/providers/copilot-review.yaml
.buddy/providers/buddy.yaml
.buddy/manifest.json
```

## Safety and reliability checks

- missing imports;
- circular dependencies;
- undefined variables;
- duplicate sections without explicit overrides;
- conflicting permissions without explicit overrides;
- unsupported provider fields;
- secret-like strings;
- generated-file drift;
- per-output token budgets.

## Usage

```bash
node packages/buap-compiler/src/cli.mjs build --config path/to/buap.config.json
node packages/buap-compiler/src/cli.mjs check --config path/to/buap.config.json
node packages/buap-compiler/src/cli.mjs validate --config path/to/buap.config.json
```

The compiler intentionally has no runtime dependencies. Canonical modules may be JSON or the documented two-space YAML subset. Generated files include a source hash and never include timestamps, so identical input produces byte-identical output.
