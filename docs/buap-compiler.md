# BUAP compiler and repository policy layout

The compiler separates stable control-plane rules from task-specific skills and separates execution, review, and release permissions.

```text
BUAP source modules
  -> schema and graph validation
  -> deterministic profile resolution
  -> provider transpilation
  -> generated-file drift check
  -> repository instructions and .buddy policy
```

Recommended consuming-repository layout:

```text
/
├── AGENTS.md
├── REVIEW.md
├── .buddy/
│   ├── policy.yaml
│   ├── claims.yaml
│   ├── manifest.json
│   ├── providers/
│   │   ├── codex.yaml
│   │   ├── copilot-review.yaml
│   │   └── buddy.yaml
│   └── skills/
├── .github/workflows/copilot-code-review.yml
└── packages/*/AGENTS.md
```

The generated files are build artifacts. Change canonical modules, run `build`, inspect the diff, and require `check` in CI. An agent may propose source-module changes through a normal pull request, but it must not mutate generated live instructions directly.
