# @prismtek/buap-hatch-pet

Permission-safe wrapper for the official OpenAI `hatch-pet` skill used by the
BUAP ACP agent.

The wrapper installs or refreshes the skill with:

```bash
npx skills add https://github.com/openai/skills --skill hatch-pet --agent codex --yes
```

If the installed `skills` CLI supports non-interactive execution, it runs:

```bash
npx skills run hatch-pet --concept "<concept>" --name "<optional name>"
```

The current local `skills` CLI may provide `add` and `use` but not `run`. In that
case the wrapper returns a clear blocked error instead of claiming a pet was
generated. After successful live execution it locates the generated `pet.json` under
`${CODEX_HOME:-$HOME/.codex}/pets/` and returns the pet display name plus package
path.

## Smoke test

```bash
npm install
npm run build
npm run smoke
```

`npm run smoke` imports the wrapper only. Live generation is opt-in:

```bash
BUAP_HATCH_PET_LIVE=1 npm run smoke
```

Live generation can install skills, call image generation, and write pet files.
It also requires a `skills` CLI/runtime that supports non-interactive skill runs.
