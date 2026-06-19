# Apple Siri / App Intents Integration Notes

BUAP can be made usable by new Siri-style assistants through a host app that exposes actions via App Intents or Shortcuts.

## Integration shape

```text
Siri phrase
  -> App Intent / Shortcut
  -> Host app loads BUAP + personalization profile
  -> Agent/model receives task + capabilities + names
  -> Host app returns short voice-safe response
  -> Host app stores long output or follow-up task when needed
```

## Host app must provide

- The BUAP adapter text for the target surface.
- The current user request.
- The personalization profile, if available.
- A list of capabilities that are actually available.
- A safe writeback path for updated names/preferences.

## Host app must not assume

- Siri can directly read GitHub repository files.
- Siri can persist BUAP memory without an app/account storage layer.
- The agent can access private repos, files, calendars, reminders, or messages unless the app passes that capability.

## Recommended App Intent parameters

- `request`: user's natural language task.
- `userDisplayName`: optional stored user name.
- `buddyDisplayName`: optional stored Buddy name.
- `surface`: `siri`, `shortcut`, `spotlight`, or `in_app`.
- `memoryScope`: `device`, `account`, `session`, or `none`.

## First-run behavior

If either display name is missing, return the personalization prompt before running non-urgent tasks:

```text
Before I lock in your Buddy setup, what should I call you, and what do you want your Buddy to be called?
```

If the task is urgent, help first and ask the missing personalization question afterward.
