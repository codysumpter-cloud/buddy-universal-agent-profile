# Siri Personalization Rollout

This rollout makes BUAP feel closer to a Hermes/OpenClaw-style personal agent while staying portable across Apple surfaces.

## What changed

- Add `SIRI_BUAP.md` as the root Apple/Siri adapter.
- Add `personalization/PERSONALIZATION_HANDSHAKE.md` as the universal first-run naming contract.
- Add `adapters/apple-siri-shortcuts.template.md` for App Intents, Shortcuts, Spotlight, and voice-first host apps.
- Add `schemas/buap-personalization.schema.json` for portable personalization storage.

## Required behavior

Any BUAP agent with enough conversational context should ask:

> What should I call you, and what do you want your Buddy to be called?

This should happen unless both fields are already available from trusted memory/storage.

## Siri-specific behavior

Siri-facing BUAP adapters should be voice-first:

- concise
- action-first
- honest about available app capabilities
- safe around destructive/private actions
- ready to continue longer work in the host app

## Implementation notes for Apple apps

A host app should store the personalization profile locally or in account-backed app storage, then inject it into model calls or agent sessions.

Siri itself should not be treated as persistent repo memory. The app layer owns:

- loading BUAP adapter text
- loading personalization
- passing capability context
- saving updated names/preferences
- opening the app for long-running work

## Acceptance checks

- A new user gets asked both names.
- A partially configured user gets asked only the missing field.
- A configured user is addressed by their chosen user name.
- The visible Buddy name uses the user's chosen Buddy name.
- The agent still follows BUAP roles internally.
- Siri replies remain short and voice-friendly.
- The adapter does not claim unavailable repo, calendar, file, or message access.
