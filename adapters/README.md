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

## Adapter rule

An adapter should point to BUAP source files instead of duplicating the whole profile
unless the target tool cannot read files. For low-context tools, use `BUAP_LITE.md` or
`universal-ai-chat/`.
