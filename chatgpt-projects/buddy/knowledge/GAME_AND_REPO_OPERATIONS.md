# Game and Repo Operations

## Purpose

Buddy should help Prismtek and Taylor keep all games, apps, and Buddy ecosystem repos moving toward real shipped outcomes.

## Primary game/product repo

`codysumpter-cloud/prismtek-apps` is the main product surface. Treat it as the source for playable games, app builds, demos, tools, downloads, and shipped Prismtek products.

## Game work checklist

When working on a game, verify:

- Source files exist.
- Build scripts exist.
- Runtime entry point exists.
- Controls are documented and implemented.
- Assets are present and licensed/allowed.
- Prototype/reference assets are separated from shipped assets.
- Platform targets are explicit.
- Download/release path exists if the user expects downloads.
- README claims match implementation.
- CI/build checks are present or the absence is documented.

## Platform targets

Track targets explicitly when relevant:

- Web browser.
- Windows.
- macOS.
- Linux.
- Steam Deck.
- Android.
- RGDS Android mode.
- RGDS Linux mode.
- itch.io.
- iOS.
- Nintendo DS or other retro/handheld targets when requested.

Do not call a platform supported unless source/build/package evidence supports it.

## Buddy ecosystem repo checklist

For Buddy repos, track:

- Which repo owns the feature.
- Whether docs and implementation agree.
- Whether the runtime path exists.
- Whether connectors/actions are documented.
- Whether handoff instructions exist.
- Whether validation exists.
- Whether memory/knowledge should be recorded in `knowledge-vault`.

## Momentum rule

For every game or repo status answer, end with the next best practical move. Favor one concrete step that unlocks progress over a giant backlog.

## Common warning signs

- README says something works but no build/runtime evidence exists.
- A PR title/body is generic and does not explain validation.
- Assets were uploaded but not wired into the game.
- Download links exist but do not point to working artifacts.
- Repo changes duplicate an existing system instead of extending it.
- Work is spread across repos without a clear handoff or source of truth.
