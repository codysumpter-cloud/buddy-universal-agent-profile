# Hatch-Pet Integration

BUAP can prepare Codex pet hatching through the official OpenAI `hatch-pet` skill.
The integration is intentionally thin: BUAP asks for ACP permission, installs or
refreshes the skill, attempts a non-interactive skills runner when available, then
reports the generated pet name and package path.

## What It Does

`hatch-pet` creates a Codex-compatible animated pet from a text concept, optional
name, and any skill-supported visual workflow. The official skill packages output
under:

```text
${CODEX_HOME:-$HOME/.codex}/pets/<pet-id>/
```

Expected package files are:

```text
pet.json
spritesheet.webp
```

BUAP's wrapper lives at `packages/buap-hatch-pet/` and exports `hatchPet()`.
The ACP agent exposes it as:

```text
/buap hatch-pet concept="tiny teal robot helper" name="Buddy"
```

## Prerequisites

- Node.js and `npm`/`npx`.
- Access to the `skills` CLI through `npx skills`.
- A skills CLI/runtime that supports non-interactive skill execution. The local
  `skills` CLI may support `add` and `use` without supporting `run`; in that case
  `/buap hatch-pet` reports a blocker after permission instead of pretending
  generation succeeded.
- Network access the first time the official skill is installed or refreshed.
- Codex Desktop pets enabled if the user wants to select the generated pet.

Manual install, if needed:

```bash
npx skills add https://github.com/openai/skills --skill hatch-pet
```

## Safety

`/buap hatch-pet` refuses to run unless an ACP client bridge is available, because
it must call `session/request_permission` before external commands run. The
permission prompt explains that the command installs/runs the official skill and
generates files under `.codex/pets`.

The default smoke test does not run the live skill. Live testing is opt-in:

```bash
BUAP_HATCH_PET_LIVE=1 node packages/buap-hatch-pet/scripts/smoke.mjs
```

## Limitations

- The integration depends on the external skills CLI and the current behavior of
  the official `hatch-pet` skill.
- If `npx skills run` is unavailable, BUAP cannot generate pet files from the ACP
  agent process. Use a skill-aware Codex host to invoke `$hatch-pet`, or retry when
  the skills CLI supports non-interactive runs.
- Live hatching can take several minutes and may require image generation
  capabilities.
- BUAP reports generated paths; it does not automatically select the pet in Codex
  Settings.
