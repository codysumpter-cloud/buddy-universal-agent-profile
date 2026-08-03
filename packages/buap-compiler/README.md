# BUAP Compiler

`@prismtek/buap-compiler` initializes repositories and turns canonical BUAP modules into deterministic, diffable agent instructions, GitHub agent skills, policy files, and bounded agent life profiles.

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
.buddy/life-profile.json
.buddy/manifest.json
```

Projects may also configure narrow GitHub agent skills under `.github/skills/<name>/SKILL.md`. Skill metadata lives in `buap.config.json`; instructions stay in canonical modules so one source hash covers repository instructions, provider policy, and progressively disclosed skills.

`.buddy/life-profile.json` is the agent's compiled developmental genome. It keeps constitution and safety boundaries immutable while declaring bounded drives, traits, reinforcement authorities, memory provenance, relationship scope, developmental stages, and inheritance policy. Hosts may persist learned state separately through `@prismtek/buap-agent-life`; learned state never rewrites the compiled profile.

Modules may add a `life` object. Conflicting scalar values require an explicit `life.*` override, just like other high-impact policy changes.

It refuses to overwrite managed files unless `--force` is explicitly provided. Review existing instructions before using that flag.

Commit these paths:

```text
buap.config.json
.buap/
AGENTS.md
REVIEW.md
.buddy/
.github/skills/  # when githubSkills are configured
```

`doctor` verifies the Node runtime, config, install manifest, generated-file drift, and optional `buddy-mcp` runtime discovery. Missing Buddy Agent is reported as an optional warning; broken policy or drift fails the command.

## GitHub agent skills

Each configured skill needs a lowercase hyphenated name, a one-line description, a profile, and at least one canonical module section targeted to `github-skill:<name>`.

```json
{
  "githubSkills": [
    {
      "name": "godot-review",
      "description": "Review Godot scene, script, resource, import, and rendered-behavior changes.",
      "profile": "review",
      "title": "Godot pull request review"
    }
  ],
  "tokenBudgets": {
    ".github/skills/godot-review/SKILL.md": 700
  }
}
```

```json
{
  "id": "godot-review-workflow",
  "title": "Review the Godot change as rendered behavior",
  "order": 10,
  "targets": ["github-skill:godot-review"],
  "body": "Run the repository verifier and require rendered evidence before accepting visual claims."
}
```

The generated file contains required YAML frontmatter, a source hash, and only the explicitly targeted sections. The compiler refuses duplicate or unsafe names, invalid descriptions, missing profiles, and skills with no matching canonical content.

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
- conflicting life-profile values without explicit overrides;
- unsupported provider fields;
- invalid or unbound GitHub skill definitions;
- secret-like strings;
- generated-file drift;
- per-output token budgets.

The compiler intentionally has no runtime dependencies. Canonical modules may be JSON or the documented two-space YAML subset. Generated files include a source hash and never include timestamps, so identical input produces byte-identical output.
