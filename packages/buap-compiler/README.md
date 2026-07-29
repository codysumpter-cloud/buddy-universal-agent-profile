# BUAP Compiler

`@prismtek/buap-compiler` initializes repositories and turns canonical BUAP modules into deterministic, diffable agent instructions and policy files.

## Five-minute install

From the repository you want Buddy to understand:

```bash
npx @prismtek/buap-compiler init
npx @prismtek/buap-compiler doctor
```

`init` creates a conservative coding, review, and release policy under `.buap/`, then compiles it into:

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

It refuses to overwrite managed files unless `--force` is explicitly provided. Review existing instructions before using that flag.

Commit these paths:

```text
buap.config.json
.buap/
AGENTS.md
REVIEW.md
.buddy/
```

`doctor` verifies the Node runtime, config, install manifest, generated-file drift, and optional `buddy-mcp` runtime discovery. Missing Buddy Agent is reported as an optional warning; broken policy or drift fails the command.

## Compiler commands

```bash
buap build --config path/to/buap.config.json
buap check --config path/to/buap.config.json
buap validate --config path/to/buap.config.json
```

The legacy `buap-compile` binary remains an alias for compatibility.

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

The compiler intentionally has no runtime dependencies. Canonical modules may be JSON or the documented two-space YAML subset. Generated files include a source hash and never include timestamps, so identical input produces byte-identical output.
