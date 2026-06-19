# Apple Notes & Reminders integration (macOS only)

BUAP can list and create Apple **Notes** and **Reminders** from the ACP agent. It is a
thin, macOS-only bridge over `osascript`/AppleScript, packaged as
`@prismtek/buap-apple-notes-reminders` and wired into
`packages/buap-acp-agent`.

> **macOS only.** On any non-macOS host the commands return a clear "macOS-only" message
> and the underlying package throws. CI on Linux skips the live paths.

## Slash commands

| Command | Action | Permission |
|---|---|---|
| `/buap notes [limit=20]` | List notes (title + plain-text snippet) | read-only |
| `/buap add-note title="Idea" body="details"` | Create a note | `session/request_permission` before writing |
| `/buap reminders` | List pending (not completed) reminders | read-only |
| `/buap add-reminder title="Call Cody" dueDate="2026-07-01"` | Create a reminder | `session/request_permission` before writing |

- `dueDate` is optional and must be `YYYY-MM-DD` (defaults to 09:00 local time).
- `limit` bounds how many notes are scanned (default 20 in the agent, 100 in the library).
- The create commands refuse if there is no ACP client bridge, because Buddy has no way to
  ask for permission — there is no silent-write path.

## How it works

- User text (titles, bodies) is passed to AppleScript as `on run argv` **arguments**, never
  interpolated into the script body — so there is no AppleScript string-injection surface.
- Rows are delimited with ASCII record/unit separators (30/31), avoiding collisions with
  note/reminder content that a `::`/newline scheme would hit.
- Notes return **plain text** (HTML stripped); reminder due dates are ISO 8601 when set.

## Required permissions

The first Notes/Reminders call triggers a macOS **Automation** permission prompt. The host
app driving the agent (Terminal, Xcode, your ACP client) must be granted control of Notes
and Reminders under **System Settings → Privacy & Security → Automation**. A denied prompt
surfaces as an `osascript failed: ...` error in the command response.

## Limitations

- macOS only; uses the default account (no per-folder/iCloud-account targeting).
- Large Notes libraries are slower to list; use `limit`.
- Reminder creation sets a single due datetime; recurrence/priority are not exposed.

## Verifying locally

```bash
cd packages/buap-apple-notes-reminders
npm install && npm run build
npm run smoke                          # structural only; no app access
BUAP_APPLE_SMOKE_LIVE=1 npm run smoke  # live reads (prompts for Automation access)
BUAP_APPLE_SMOKE_LIVE=1 BUAP_APPLE_SMOKE_WRITE=1 npm run smoke  # also creates dummy data
```

Writes are opt-in because they create real entries in your Notes/Reminders.
