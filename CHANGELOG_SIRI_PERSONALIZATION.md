# Siri Personalization Changelog

## 2026-06-19

Added BUAP support for Siri-style Apple assistant surfaces and first-run personalization.

### Added

- `SIRI_BUAP.md` root adapter for Siri, App Intents, Shortcuts, Spotlight, and Apple Intelligence handoff surfaces.
- `personalization/PERSONALIZATION_HANDSHAKE.md` requiring agents to ask what to call the user and what the user's Buddy should be called.
- `adapters/apple-siri-shortcuts.template.md` for host app integration.
- `schemas/buap-personalization.schema.json` for portable personalization storage.
- `docs/siri-personalization-rollout.md` with acceptance criteria.
- `docs/siri-cross-reference.md` for discoverability until the main cross-reference matrix is edited.
- `examples/siri-first-run-prompt.txt` and `examples/siri-personalization-profile.example.json`.
- `tests/personalization-handshake.acceptance.md` with implementation checks.

### Design note

Siri is treated as a voice/app surface, not as persistent repo memory. The host app owns loading BUAP, injecting available capabilities, and storing personalization safely.
