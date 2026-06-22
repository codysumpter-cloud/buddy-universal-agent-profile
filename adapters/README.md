# BUAP Adapters

Adapters are small copy-paste templates for installing BUAP into specific AI tools or
repo conventions.

Use the smallest adapter that matches the target tool. Repo-local instructions still
take precedence.

## Templates

- `AGENTS.template.md`
- `CLAUDE.template.md`
- `CODEX.template.md`
- `GEMINI.template.md`
- `cursor-rules.template.mdc`
- `windsurf-rules.template.md`
- `custom-gpt-instructions.template.md`
- `chatgpt-project-instructions.template.md`
- `soul/` — BUAP persona / bootstrap files for soul-style agents (Hermes `SOUL.md`;
  OpenClaw `SOUL.md` + `IDENTITY.md` + `USER.md` + `AGENTS.md` + `MEMORY.md`). See
  `soul/README.md` for install paths.

## Adapter rule

An adapter should point to BUAP source files instead of duplicating the whole profile
unless the target tool cannot read files. For low-context tools, use `BUAP_LITE.md` or
`universal-ai-chat/`.

## Optional external overlays

All adapters may reference these after BUAP, repo-local instructions, and owning-repo standards:

- `DietrichGebert/ponytail` — optional minimal-code/YAGNI implementation discipline.
- `JuliusBrussee/caveman` — optional terse technical communication discipline.

These overlays never override BUAP safety, validation, source-of-truth, capability, or repo-local rules.