# Siri Personalization Rollout

This rollout makes BUAP feel closer to a Hermes/OpenClaw-style personal agent while staying portable across Apple surfaces.

## What changed

- Add `SIRI_BUAP.md` as the root Apple/Siri adapter.
- Add `personalization/PERSONALIZATION_HANDSHAKE.md` as the universal first-run naming contract.
- Add `adapters/apple-siri-shortcuts.template.md` for App Intents, Shortcuts, Spotlight, and voice-first host apps.
- Add `schemas/buap-personalization.schema.json` for portable personalization storage.

## Required behavior

Any BUAP agent with enough conversational context should establish the user's display
name and the Buddy naming mode:

> What should I call you? Do you want to name your Buddy, or should your Buddy choose its own name?

"Buddy" remains the relationship/role. The individual display name can be user-selected
or self-selected. This should happen unless the relevant fields are already available
from trusted memory/storage.

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

- A new user is asked what to call them and whether the Buddy should be user-named or self-named.
- A partially configured user gets asked only for unresolved identity fields.
- A configured user is addressed by their chosen user name.
- The visible Buddy name uses the resolved individual name, regardless of whether the user or Buddy selected it.
- A self-selected Buddy name remains stable when persistence exists.
- The agent still follows BUAP roles internally.
- Siri replies remain short and voice-friendly.
- The adapter does not claim unavailable repo, calendar, file, or message access.
