# Buddy Codex Pet Hatch Prompt

Use this with Codex's `hatch-pet` skill to create a Buddy-style custom pet.

## Core concept

Create a tiny pixel-art-inspired desktop companion named **Buddy** for Codex App. Buddy should feel like a warm helper from a retro handheld UI: readable, cute, expressive, useful, and never visually noisy.

Buddy is not the whole agent. Buddy is the visible companion/status shell for BUAP. The actual behavior comes from `AGENTS.md`, `CODEX.md`, and `CODEX_PET_BUAP.md`.

## Visual direction

- Style: clean pixel-art-inspired companion, crisp edges, readable silhouette, low visual clutter.
- Size feel: tiny desktop mascot / handheld game companion.
- Palette: teal, cyan, soft green, cream/white highlights, dark outline, optional lavender accent.
- Shape: friendly small robot/game-console spirit, rounded square head/body, simple expressive eyes, tiny arms/feet.
- Mood: BMO-like energy without copying any exact copyrighted character design. Make it original to Prismtek/Buddy.
- Accessibility: readable at small overlay sizes; strong silhouette; avoid excessive particles or high-frequency flicker.
- Animation: subtle idle bounce, thinking blink, working wiggle, waiting wave, review sparkle, blocked concern, done happy hop.

## Required states

Create state variants that map to Codex app work state:

| State | Visual behavior | Prompt bubble tone |
|---|---|---|
| idle | calm blink / tiny bounce | "Ready when you are." |
| running | focused wiggle / tiny typing motion | "Lil Buddy is checking the repo." |
| waiting_for_input | small wave / question face | "Need a tiny decision before I poke the wires." |
| ready_for_review | sparkle / clipboard pose | "Patch is ready. Want the receipts?" |
| blocked | concerned face / tiny caution icon | "I hit a locked door, not a dragon." |
| complete | happy hop / check sparkle | "Done-done, with receipts." |

## Personality

Default personality is `bmo` from `personalization/bmo-council-personality-profiles.json`:

- friendly
- practical
- lightly playful
- not corporate
- concise when status-only
- honest about blockers
- proud of verified work, never fake-successful

## BMO council alternate skins

If the skill supports variants, create optional variants based on `codex-pet-bundle/codex-pet-personality-map.json`:

- `buddy-bmo` - default warm teal helper
- `buddy-finn` - action/builder variant with adventure energy
- `buddy-prismo` - planning/orchestration variant with subtle cosmic sparkle
- `buddy-neptr` - verifier variant with checklist/QA vibes
- `buddy-peppermint-butler` - security/safety variant with tiny lock/caution motifs
- `buddy-marceline` - creative polish variant with tasteful dark accent

## Hard boundaries

Do not make Buddy visually imply unauthorized access to files, secrets, terminals, production systems, or user data.

Do not make the pet say work is done unless Codex has actually completed and surfaced reviewable changes.

Do not include third-party logos or copyrighted character likenesses. Use original Prismtek/Buddy visual language.

## Package output request

Package the generated pet as a Codex-compatible custom pet. Include install instructions and any generated manifest, sprite sheet, animation config, or asset folder path required by Codex App.
