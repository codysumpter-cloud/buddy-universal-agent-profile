# Siri BUAP Entrypoint

Use this entrypoint when BUAP needs to work through Siri, App Intents, Shortcuts, Spotlight, or an iOS/macOS host app.

## Files

- `SIRI_BUAP.md` - root Apple/Siri adapter.
- `personalization/PERSONALIZATION_HANDSHAKE.md` - first-run name setup.
- `schemas/buap-personalization.schema.json` - storage contract.
- `adapters/apple-siri-shortcuts.template.md` - compact host adapter.
- `integrations/apple-siri-app-intents.md` - Apple host integration notes.
- `examples/siri-first-run-prompt.txt` - tiny prompt fixture.
- `examples/siri-personalization-profile.example.json` - example stored profile.
- `tests/personalization-handshake.acceptance.md` - acceptance checks.

## Required first-run question

```text
Before I lock in your Buddy setup, what should I call you, and what do you want your Buddy to be called?
```

## Design rule

The visible assistant name is user-configurable. BUAP keeps the internal Buddy/Lil Buddy framework, but the user can choose what their Buddy is called.
