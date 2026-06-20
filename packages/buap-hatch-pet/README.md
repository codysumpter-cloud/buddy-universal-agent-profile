# @prismtek/buap-hatch-pet

Host-aware planning and verification helpers for the official OpenAI
`hatch-pet` skill.

This package does **not** run `npx skills run`. The current local `skills` CLI may
support `add` and `use`, but it does not advertise a non-interactive `run`
command. BUAP therefore prepares a Codex-host prompt and verifies generated files
after the host skill runs.

Exports:

- `buildBuddyPetConcept(request)`
- `buildHatchPetHostPrompt(request)`
- `planHatchPet(request)`
- `verifyPetArtifact(petDir)`
- `detectLibreSprite()`
- `detectAseprite()`
- `detectPixelLabMcp()`
- `detectPixelLabAdapter()`
- `detectAsepriteExtensionReference()`

Install hatch-pet in a Codex host if needed:

```text
$skill-installer hatch-pet
```

Then paste the host prompt returned by `planHatchPet()` into a Codex chat where
`$hatch-pet` is loaded. After hatching, verify the package under
`${CODEX_HOME:-$HOME/.codex}/pets/<pet-id>/`.

## Smoke test

```bash
npm install
npm run build
npm run smoke
```

`npm run smoke` checks the planner and verifies a temporary fake pet artifact. It
does not install skills, call image generation, or write to the real Codex pets
directory.

## Sprite Tool Doctor

```bash
node dist/cli.js doctor
node dist/cli.js sprite-tool doctor
```

The doctor checks:

- LibreSprite app presence.
- LibreSprite executable path inside the app bundle even when `libresprite` is not
  on `PATH`.
- LibreSprite `--help` behavior.
- Aseprite app/CLI presence.

On this Mac, LibreSprite is installed at `/Applications/LibreSprite.app` and the
CLI executable is:

```text
/Applications/LibreSprite.app/Contents/MacOS/libresprite
```

If it is not on `PATH`, use the direct command or add an alias:

```bash
alias libresprite="/Applications/LibreSprite.app/Contents/MacOS/libresprite"
```

Discovered LibreSprite batch/export options include:

```text
--batch
--script <filename>
--sheet <filename.png>
--data <filename.json>
--format json-hash|json-array
--sheet-type horizontal|vertical|rows|columns|packed
--frame-range from,to
--save-as <filename>
```

## PixelLab + LibreSprite fallback

`node dist/cli.js doctor` also reports the `pixellab-libresprite-fallback`
toolchain. The doctor detects each capability by existence only — it never calls
the PixelLab API and never spends credits (`API probe: skipped, would spend
credits`).

- PixelLab MCP config: `/Users/prismtek/.codex/config.toml`. Read only for safe
  lowercase substrings (`pixellab`, `pixflux`, `mcp`) to set
  `PixelLab MCP entry: present|missing|unknown`. Config contents and tokens are
  never printed — secrets redacted. Generation allowance is verified manually.
- LibreSprite JS adapter:
  `/Users/prismtek/Library/Application Support/LibreSprite/scripts/PixelLab.js`.
  Supports a balance check and Pixflux image generation.
- Aseprite PixelLab extension reference:
  `/Users/prismtek/Library/Application Support/LibreSprite/PixelLab-Aseprite-extension`.
  Lua-based Aseprite code; reference only for LibreSprite, not an active runtime.
- LibreSprite CLI: `/Applications/LibreSprite.app/Contents/MacOS/libresprite`.

Hatch workflow modes, in order: `host-hatch-pet` → `manual-handoff` →
`pixellab-libresprite-fallback`.

## BUAP profile pairing

This repo locks Buddy profile = `bmo` and Lil Buddy profile = `finn`; Lil Buddy is
the implementation worker. The doctor prints these as `Buddy profile: bmo` and
`Lil Buddy profile: finn`.
