# Apple Siri / App Intents Integration Notes

BUAP can be made usable by new Siri-style assistants through a host app that exposes actions via App Intents or Shortcuts.

## Integration shape

```text
Siri phrase
  -> App Intent / Shortcut
  -> Host app loads BUAP + personalization profile + profile pack
  -> Agent/model receives task + capabilities + names + selected profiles
  -> Buddy decides whether to answer directly or command Lil Buddy
  -> Lil Buddy performs routine host-capability work and reports back
  -> Buddy returns short voice-safe response
  -> Host app stores long output or follow-up task when needed
```

## Host app must provide

- The BUAP adapter text for the target surface.
- The current user request.
- The personalization profile, if available.
- The profile pack, defaulting to `personalization/bmo-council-personality-profiles.json`.
- A list of capabilities that are actually available.
- A safe writeback path for updated names/preferences/profile choices.

## Host app must not assume

- Siri can directly read GitHub repository files.
- Siri can persist BUAP memory without an app/account storage layer.
- The agent can access private repos, files, calendars, reminders, or messages unless the app passes that capability.
- Lil Buddy can bypass app permission prompts, system privacy controls, or user confirmation requirements.

## Recommended App Intent parameters

- `request`: user's natural language task.
- `userDisplayName`: optional stored user name.
- `buddyDisplayName`: optional stored Buddy name.
- `lilBuddyDisplayName`: optional stored Lil Buddy name.
- `buddyProfileId`: optional Buddy profile template ID.
- `lilBuddyProfileId`: optional Lil Buddy profile template ID.
- `selectedProfilePackId`: optional profile pack ID.
- `surface`: `siri`, `shortcut`, `spotlight`, or `in_app`.
- `memoryScope`: `device`, `account`, `session`, or `none`.

## First-run behavior

If any required display name is missing, return the personalization prompt before running non-urgent tasks:

```text
Before I lock in your setup, what should I call you, what do you want your main Buddy to be called, and what do you want your Lil Buddy to be called?
```

If the task is urgent, help first and ask the missing personalization question afterward.

## Lil Buddy command flow

Buddy can command Lil Buddy for routine actions when the host capability list allows it and the action is low-risk.

Lil Buddy should return:

```json
{
  "status": "done|blocked|needs_confirmation|failed",
  "summary": "",
  "actions_taken": [],
  "evidence": [],
  "risks_or_permissions": [],
  "next_recommended_command": ""
}
```

Buddy then summarizes for the user or asks for confirmation before any risky next step.
