# Siri Personalization Changelog

## 2026-06-19

Added BUAP support for Siri-style Apple assistant surfaces, first-run personalization, Lil Buddy naming, and reusable BMO council personality profiles.

### Added

- `SIRI_BUAP.md` root adapter for Siri, App Intents, Shortcuts, Spotlight, and Apple Intelligence handoff surfaces.
- `personalization/PERSONALIZATION_HANDSHAKE.md` requiring agents to ask what to call the user, what the user's main Buddy should be called, and what the user's Lil Buddy should be called.
- `personalization/BUDDY_LIL_BUDDY_PROFILE_SELECTION.md` defining Buddy/Lil Buddy profile slots and command/report rules.
- `personalization/bmo-council-personality-profiles.json` with premade BMO council profile templates usable for either Buddy or Lil Buddy.
- `schemas/buap-personality-profile.schema.json` for reusable profile packs.
- `adapters/apple-siri-shortcuts.template.md` for host app integration.
- `schemas/buap-personalization.schema.json` for portable personalization storage.
- `docs/siri-personalization-rollout.md` with acceptance criteria.
- `docs/siri-cross-reference.md` for discoverability until the main cross-reference matrix is edited.
- `examples/siri-first-run-prompt.txt` and `examples/siri-personalization-profile.example.json`.
- `tests/personalization-handshake.acceptance.md` with implementation checks.

### Design note

Siri is treated as a voice/app surface, not as persistent repo memory. The host app owns loading BUAP, injecting available capabilities, selecting personality templates, and storing personalization safely.

Buddy supervises and synthesizes. Lil Buddy is the routine app/tool-facing worker that reports back to Buddy before Buddy answers the user.
