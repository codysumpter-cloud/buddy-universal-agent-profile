---
name: libresprite-buddy
description: >-
  Hybrid LibreSprite + Python/Pillow toolkit for buddy sprites: crisp-resize to 64x64
  (or any size), clone templates, generate recolored variants, feature-swap parts, and
  build new-shape buddies by reusing the pose/rotation/animation library plus simple
  procedural parts. Also a Codex buddy factory: compose a Codex-installable pet atlas and
  64x64 game sprite sheets from real Buddy art, with recolor for sibling buddies. Use when
  asked to resize, recolor, clone, feature-swap, generate buddy/pet sprite variants, or
  build a Codex pet / game sheet from the Buddy pack. Pillow is the pixel engine;
  LibreSprite is editor/preview.
---

# libresprite-buddy

A hybrid sprite toolkit. **Pillow is the pixel engine. LibreSprite is the editor /
preview only.** The entrypoint is a single dispatcher:

`plugins/buap/skills/libresprite-buddy/scripts/buddy.py`

## Hard constraints (verified — build on these, do not relitigate)

- **LibreSprite headless (`-b`) scripting cannot do pixel ops.** In batch mode the `app`
  object only exposes `launch, open, yield, createDialog, documentation` — no
  `activeImage` / `activeSprite` / `pixelColor` / `command`. The pixel API exists **only
  in the GUI**. So all automation here uses Python/Pillow, never LibreSprite CLI
  scripting.
- **LibreSprite CLI resize (`--scale`, `--shrink-to`) is smooth/bilinear only** (no
  nearest) → soft results. Do not use it for quality resizes; use the `resize` subcommand.
- **Opening a file for preview works**:
  `/Applications/LibreSprite.app/Contents/MacOS/libresprite <file>`. The `open` subcommand
  shells to that — optional, GUI-only, best-effort.
- **Resize of the Buddy art is best-effort, not lossless.** The source art is true
  ~116px anti-aliased color, not a clean low-res grid, so downscaling is a quality
  reconstruction (`LANCZOS` + a light `UnsharpMask`), not a pixel-perfect conversion.

## Dependency

Requires **Pillow**. If it is missing the scripts exit with code 2 and print:
`Install it with:  pip3 install --user Pillow`. Verified present on this machine as
Pillow 11.3.0 under `python3` (3.9.6).

## Subcommands

Run `python3 .../buddy.py <subcommand> --help` for full flags.

- **resize** `input output [--size 64] [--method lanczos-sharp|lanczos|nearest|box]`
  Crisp-resize a PNG, or a whole directory of PNGs, preserving alpha. Default
  `lanczos-sharp` (LANCZOS + UnsharpMask) is tuned for the anti-aliased Buddy art; use
  `nearest` when the input is already clean low-res pixel art.
- **clone** `source dest [--force]`
  Copy a single template file, or a whole pose/rotation/animation directory, to a
  destination.
- **recolor** `input outdir [--count N | --hue 0..1] [--size 64] [--method ...]`
  Generate hue-shifted variants. Identity is preserved: fully transparent pixels stay
  transparent; near-gray/white pixels (face, eyes, outline) are kept; the warm
  belly-heart accent is kept; everything else rotates by the hue shift. Emits a native
  copy plus a resized copy per variant.
- **feature-swap** `base feature output [--x N --y N] [--size 0] [--method ...]`
  Alpha-paste a feature layer (alternate antennae / eyes / belly icon) onto a base buddy
  at an offset. **Feature parts are user-supplied PNGs.**
- **new-buddy** `--outdir DIR [--name N] [--base FRAME] [--hue 0..1] [--feature PNG --fx --fy] [--size 64] [--procedural [--egg]]`
  "New shape" generator. Two paths:
  - **Pose reuse (preferred):** pass `--base` = a pose/rotation/animation frame from a
    Buddy pack (8 rotations, 24 animation sets), then apply recolor and/or feature-swap.
    Emits native + resized.
  - **Procedural v1 (`--procedural`):** simple parametric primitives (round or `--egg`
    body, dot eyes, smile, antennae, belly accent) drawn with `PIL.ImageDraw`.
- **open** `file [--libresprite PATH]`
  Preview a file in the LibreSprite GUI. Optional, GUI-only, best-effort.

The `recolor` subcommand also takes `--heart keep|recolor|remove` (default `keep`) to
control the belly heart, consistent with the factory's `--heart` flag.

## Codex buddy factory (compose, never generate)

The factory composes a Codex-installable pet atlas and 64×64 game sprite sheets **from
Cody's real Buddy animation frames** — even-sampled then scaled-to-fit and centered per
cell. **Compose, never AI-generate.** AI generation drifts humanoid and loses the buddy's
identity; composition reuses the exact source pixels, so recolors and pose-reuse stay on
model.

### Codex pet atlas contract (reimplemented from the public hatch-pet spec)

- Atlas **1536×1872**, **8 cols × 9 rows**, cell **192×208**, transparent RGBA, saved as
  lossless PNG **and** lossless WebP.
- Row → (state, frame_count): `0 idle 6 · 1 running-right 8 · 2 running-left 8 ·
  3 waving 4 · 4 jumping 5 · 5 failed 8 · 6 waiting 6 · 7 running 6 · 8 review 6`.
- Default source mapping (state ← `Anim/dir` in the pack): idle←idle/south,
  running-right←Walk/east, running-left←Walk/west, waving←happy/south,
  jumping←victory/south, failed←defeat/south, waiting←thinking/south, running←cast/south,
  review←charge/south. Override any row with `--mapping <json>` (a list of
  `{row, state?, frames?, source?}`).
- **Validation invariants** (run on every compose; nonzero exit + `validation.json` on
  fail): dims exact; each used cell (col < frame_count) has ≥50 non-transparent px and is
  not >95 % opaque (else a non-transparent background slipped in); each unused cell fully
  transparent; atlas not fully opaque; no transparent pixel carries non-zero RGB.
- Package layout (install): `${CODEX_HOME:-$HOME/.codex}/pets/<id>/pet.json` +
  `spritesheet.webp`, with `pet.json = {id, displayName, description,
  spritesheetPath:"spritesheet.webp"}`.

### Factory subcommands

- **compose-atlas** `--pack DIR --out DIR [--mapping JSON] [--hue 0..1] [--heart keep|recolor|remove] [--fill 0.92]`
  Compose the 1536×1872 atlas. Writes `spritesheet.png`, `spritesheet.webp`,
  `validation.json` (nonzero exit if invariants fail), and `contact-sheet.png` (a
  scaled-down grid for visual QA). `--hue` makes a recolored sibling; `--fill` controls
  how much of each cell the buddy fills.
- **install-pet** `--atlas WEBP --id ID --name NAME --desc TEXT [--codex-home PATH] [--force]`
  Write `${CODEX_HOME:-$HOME/.codex}/pets/<id>/pet.json` + `spritesheet.webp`. Refuses to
  overwrite an existing pet id without `--force`. Prints the written paths.
- **sheet-64** `--pack DIR --out DIR [--state all|<state>] [--method ...] [--hue] [--heart]`
  64×64 frames per state under `frames/`, a packed `spritesheet-64.png`, and
  `frames-64.json` (state, frame index, x, y, w, h, duration). Game-ready.
- **mint** `--pack DIR --id ID --name NAME [--desc] --out DIR [--hue] [--heart] [--fill] [--install] [--codex-home] [--force]`
  One-shot: composes the recolored Codex atlas (+ validation + contact sheet), stages
  `pet.json`, and builds the 64×64 game sheet. Installs into `CODEX_HOME/pets` **only**
  with `--install`. The "as easy as hatch_pet" entrypoint.

Frame durations (ms) from the contract are written into the 64×64 frame map: idle
280/110/110/140/140/320 · running-right & running-left 120×7 then 220 · waving
140/140/140/280 · jumping 140×4 then 280 · failed 140×7 then 240 · waiting 150×5 then 260
· running 120×5 then 220 · review 150×5 then 280.

## Honesty caveats

- **Brand-new original silhouettes are best-effort.** The `new-buddy --procedural` path
  is **v1 / simple** parametric art — basic primitives, not invented hand-drawn pixel
  art. The higher-fidelity path reuses real pack poses (`--base`) and recolors/composites
  them. Say so when reporting results.
- AA-source downscales are reconstructions; do not claim pixel-perfect output.
- **Factory scope is honest.** The Codex atlas, 64×64 sheets, recolored siblings, and
  pose/animation reuse all work because they compose Cody's **real** Buddy family art.
  A brand-new creature **species** (a silhouette the pack has never drawn) is **out of
  scope** here — that still needs real new art or AI generation, and AI generation drifts
  humanoid. The factory makes variants of the Buddy family, not new species.
- The default mapping reuses the south/east/west views that read cleanly head-on; some
  source animations carry effects (fireballs, impact flashes) that ride along if mapped —
  pick effect-free `Anim/dir` sources, or override per row with `--mapping`, when you want
  a clean buddy.

## How Claude should drive it

1. Take all input paths as arguments from the user — never assume a Downloads location.
2. For quality 64×64 output of Buddy art, use the `resize` default (`lanczos-sharp`);
   switch to `--method nearest` only for clean pixel-art input.
3. To produce variants, prefer `recolor` (preserves identity) and pose-reuse `new-buddy`
   over the procedural path; reach for `--procedural` only for quick v1 shapes.
   For a Codex pet or game sheet from the pack, use `compose-atlas` / `sheet-64`, or
   `mint` for the one-shot. Always check `validation.json` `ok:true` before installing.
   Never install over an existing live pet id without `--force`.
4. Never call the PixelLab API, never touch the network, never spend credits, never print
   tokens or config contents (consistent with the hatch-pet fallback rules in
   `docs/hatch-pet-integration.md`).
5. Report sample output paths and dimensions as receipts.

For non-trivial batch jobs, delegate the run to the `lil-buddy` subagent and review its
receipts before reporting back.
