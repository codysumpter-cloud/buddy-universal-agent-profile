# Hatch-Pet Integration

BUAP prepares Codex pet hatching through the official OpenAI `hatch-pet` skill.
The integration is intentionally thin: BUAP confirms Buddy/Lil Buddy profiles,
builds a Codex-host prompt, and verifies the generated package after the host skill
runs.

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

BUAP's wrapper lives at `packages/buap-hatch-pet/` and exports planner/verifier
helpers instead of a direct runner.
The ACP agent exposes it as:

```text
/buap hatch-pet profile="buddy" name="Buddy"
/buap hatch-pet profile="lil-buddy" name="Lil Buddy"
/buap hatch-pet verify name="Buddy"
```

## Modes

1. `host-hatch-pet` — preferred. A Codex host with the official `$hatch-pet` skill
   executes the full pet workflow and writes the package under `.codex/pets/`.
2. `manual-handoff` — BUAP returns the exact hatch prompt for the user or Codex host
   to run. This is the ACP agent's default behavior because the current local
   `skills` CLI does not provide `npx skills run`.
3. `pixel-art-fallback` — when official hatch-pet execution is unavailable,
   Pixellab.ai and LibreSprite scripting can be used to generate, assemble, repair,
   validate, slice, or export Buddy/Lil Buddy pixel-art assets. The concrete local
   wiring for this mode is the `pixellab-libresprite-fallback` toolchain documented
   below.

The fallback path is an art pipeline, not a success claim. BUAP must still package
and verify the final artifact before reporting completion. Do not invent a Codex
pet package format. The format currently documented by the official hatch-pet skill
is:

```text
${CODEX_HOME:-$HOME/.codex}/pets/<pet-id>/
  pet.json
  spritesheet.webp
```

BUAP also accepts common spritesheet/atlas filenames during verification:

```text
spritesheet.webp
spritesheet.png
atlas.webp
atlas.png
```

## Prerequisites

- Node.js and `npm`/`npx`.
- Access to the `skills` CLI through `npx skills`.
- Network access the first time the official skill is installed or refreshed.
- Codex Desktop pets enabled if the user wants to select the generated pet.
- A personalized BUAP session. If BUAP only has fallback profiles, `/buap hatch-pet`
  asks the user to choose Buddy and Lil Buddy profiles before preparing a hatch.

Manual install, if needed:

```bash
npx skills add https://github.com/openai/skills --skill hatch-pet
```

Codex-host install:

```text
$skill-installer hatch-pet
```

## Safety

`/buap hatch-pet` does not generate pet files directly and does not call
`npx skills run`. It returns a host-action report with the active Buddy/Lil Buddy
profiles, the install command, a Codex prompt for `$hatch-pet`, the expected output
directory, and a verification command.

The default smoke test checks planning and verification only:

```bash
node packages/buap-hatch-pet/scripts/smoke.mjs
```

It does not install skills, call image generation, or write to the real Codex pets
directory.

## Pixel-Art Fallback

When `host-hatch-pet` is unavailable, Buddy may prepare a `pixel-art-fallback`
handoff:

1. Generate Buddy or Lil Buddy concept art through Pixellab.ai if needed.
2. Use LibreSprite scripting to assemble, repair, slice, validate, or export
   spritesheets/atlases.
3. Package only when the required Codex pet structure is known.
4. Run `/buap hatch-pet verify name="..."` before claiming the pet exists.

If the format cannot be verified from official docs or generated examples, assets
may be created or repaired, but packaging remains blocked pending format
verification.

LibreSprite is installed on this Mac as an app bundle. The executable may exist
inside the bundle even when `libresprite` is not on `PATH`:

```text
/Applications/LibreSprite.app/Contents/MacOS/libresprite
```

Optional alias:

```bash
alias libresprite="/Applications/LibreSprite.app/Contents/MacOS/libresprite"
```

Discovered CLI syntax from `--help` includes:

```text
libresprite --batch input.aseprite --sheet output.png --data output.json --format json-array
libresprite --batch input.aseprite --script script.lua
```

Useful flags include `--batch`, `--script`, `--sheet`, `--data`, `--format`,
`--sheet-type`, `--frame-range`, and `--save-as`.

## Default Profile Concepts

The default Buddy pet command is:

```text
/buap hatch-pet profile="buddy" name="Buddy"
```

It uses the active Buddy profile. With the default `bmo` profile, BUAP uses the
Buddy/BMO-style companion concept and asks the host skill to create an original
Prismtek-compatible pet.

The default Lil Buddy worker pet command is:

```text
/buap hatch-pet profile="lil-buddy" name="Lil Buddy"
```

It uses the active Lil Buddy worker profile. With the default `finn` profile, BUAP
uses an energetic, task-focused worker companion concept.

## Limitations

- The integration depends on the external skills CLI and the current behavior of
  the official `hatch-pet` skill.
- BUAP cannot generate pet files from the ACP agent process. Use a skill-aware
  Codex host to invoke `$hatch-pet`, then run `/buap hatch-pet verify name="..."`.
- Live hatching can take several minutes and may require image generation
  capabilities.
- BUAP reports generated paths; it does not automatically select the pet in Codex
  Settings.

## PixelLab + LibreSprite Fallback Tooling

The `pixellab-libresprite-fallback` mode wires three local capabilities. The doctor
detects each by existence only; it never calls the PixelLab API and never spends
credits.

PixelLab MCP config:

```text
/Users/prismtek/.codex/config.toml
```

The doctor reads this file only to test for safe lowercase substrings (`pixellab`,
`pixflux`, `mcp`) so it can report `PixelLab MCP entry: present|missing|unknown`.
It never prints config contents or token values — secrets redacted. PixelLab
generation allowance is verified manually by the user, not by the doctor. The
doctor's `API probe` is `skipped, would spend credits` (no credits spent).

LibreSprite JS adapter (the active LibreSprite runtime path):

```text
/Users/prismtek/Library/Application Support/LibreSprite/scripts/PixelLab.js
```

This LibreSprite JS adapter supports a PixelLab balance check and Pixflux image
generation.

Aseprite PixelLab extension reference (reference only):

```text
/Users/prismtek/Library/Application Support/LibreSprite/PixelLab-Aseprite-extension
```

This is Lua-based Aseprite code kept as a reference for the LibreSprite JS adapter;
it is not an active LibreSprite runtime.

LibreSprite CLI:

```text
/Applications/LibreSprite.app/Contents/MacOS/libresprite
```

It is not on `PATH`; use the direct path or the optional alias:

```bash
alias libresprite="/Applications/LibreSprite.app/Contents/MacOS/libresprite"
```

### Hatch workflow modes, in order

1. `host-hatch-pet`
2. `manual-handoff`
3. `pixellab-libresprite-fallback`

## BUAP Active Profile Pairing

For this repo the BUAP pairing is locked:

- `Buddy profile: bmo` (BMO-style: playful, warm, curious, practical, friendly)
- `Lil Buddy profile: finn` (Finn-style: brave, action-oriented, direct, loyal,
  persistent)
- `Lil Buddy is the implementation worker`.

In Claude Code with the BUAP plugin active, Lil Buddy is a true subagent. In plain
node tooling (`tools/buap-doctor.mjs`) there is no subagent runtime, so the doctor
reports Lil Buddy as an emulated worker pattern (true subagent in Claude Code
plugin) rather than claiming a live runtime.

Future sessions should ask the user to select Buddy/Lil Buddy profiles only when no
pairing is configured. This repo defaults to Buddy=`bmo` / Lil Buddy=`finn`.
