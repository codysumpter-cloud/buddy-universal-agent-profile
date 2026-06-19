# Siri BUAP Entrypoint

Use this entrypoint when BUAP needs to work through Siri, App Intents, Shortcuts, Spotlight, or an iOS/macOS host app.

## Files

- `SIRI_BUAP.md` - root Apple/Siri adapter.
- `personalization/PERSONALIZATION_HANDSHAKE.md` - first-run setup for user, Buddy, and Lil Buddy names.
- `personalization/BUDDY_LIL_BUDDY_PROFILE_SELECTION.md` - Buddy/Lil Buddy profile selection rules.
- `personalization/bmo-council-personality-profiles.json` - premade BMO council profile pack.
- `schemas/buap-personalization.schema.json` - storage contract.
- `schemas/buap-personality-profile.schema.json` - reusable profile pack contract.
- `adapters/apple-siri-shortcuts.template.md` - compact host adapter.
- `integrations/apple-siri-app-intents.md` - Apple host integration notes.
- `examples/siri-first-run-prompt.txt` - tiny prompt fixture.
- `examples/siri-personalization-profile.example.json` - example stored profile.
- `tests/personalization-handshake.acceptance.md` - acceptance checks.

## Required first-run question

```text
Before I lock in your setup, what should I call you, what do you want your main Buddy to be called, and what do you want your Lil Buddy to be called?
```

## Design rule

The visible user name, main Buddy name, and Lil Buddy name are user-configurable. BUAP keeps the internal Buddy/Lil Buddy framework, but the user can choose both assistant names and select profiles for both slots.

Buddy supervises and synthesizes. Lil Buddy is the app/tool-facing worker that handles routine host-capability tasks and reports back to Buddy before the final user-facing answer.
