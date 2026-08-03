# BUAP compiler and repository policy layout

The compiler separates stable control-plane rules from task-specific skills and separates execution, review, and release permissions.

```text
BUAP source modules
  -> schema and graph validation
  -> deterministic profile resolution
  -> provider and skill transpilation
  -> generated-file drift check
  -> repository instructions, .github skills, and .buddy policy
```

Recommended consuming-repository layout:

```text
/
├── AGENTS.md
├── REVIEW.md
├── .github/
│   ├── skills/
│   │   ├── godot-review/SKILL.md
│   │   ├── react-browser-verification/SKILL.md
│   │   ├── purchased-assets-policy/SKILL.md
│   │   └── buddy-claim-verification/SKILL.md
│   └── workflows/copilot-code-review.yml
├── .buddy/
│   ├── policy.yaml
│   ├── claims.yaml
│   ├── manifest.json
│   ├── providers/
│   │   ├── codex.yaml
│   │   ├── copilot-review.yaml
│   │   └── buddy.yaml
│   └── skills/
└── packages/*/AGENTS.md
```

GitHub skill metadata is declared in `buap.config.json`. Skill instructions remain in canonical modules and opt into one skill with a target such as `github-skill:godot-review`. This keeps each `SKILL.md` narrow while preserving the same deterministic source hash, secret scan, token budget, manifest digest, and drift checks used by the other compiler outputs.

The generated files are build artifacts. Change canonical modules, run `build`, inspect the diff, and require `check` in CI. An agent may propose source-module changes through a normal pull request, but it must not mutate generated live instructions directly.
