# @prismtek/buap-apple-notes-reminders

macOS-only helper that lets BUAP agents list and create Apple **Notes** and
**Reminders** through `osascript` / AppleScript.

> **macOS only.** Every function throws a clear error on non-macOS platforms (no
> `osascript`). CI on Linux skips it.

## API

```ts
import {
  listNotes,        // (limit?: number) => Promise<Note[]>      { title, body }
  createNote,       // (title: string, body: string) => Promise<void>
  listReminders,    // () => Promise<Reminder[]>                { title, dueDate? (ISO) }
  createReminder,   // (title: string, dueDate?: Date) => Promise<void>
  isSupported       // () => boolean   (true only on darwin)
} from "@prismtek/buap-apple-notes-reminders";
```

- `listNotes` returns the note title and its **plain text** body (HTML stripped),
  capped at `limit` (default 100, or `BUAP_APPLE_NOTES_LIMIT`).
- `createNote` uses the title as the note's first line, then the body.
- `listReminders` returns only **pending** (not completed) reminders.
- `createReminder` accepts an optional JS `Date`; time-of-day is preserved.

## How it works

User-supplied text (titles, bodies) is passed to AppleScript as `on run argv`
arguments, **not** interpolated into the script source — so there is no AppleScript
string-injection surface. Output rows are separated with ASCII record/unit separators
(30/31) instead of `::`/newlines, which avoids parser collisions with note content.

## Permissions

The first call to Notes or Reminders triggers a macOS **Automation** permission
prompt (System Settings → Privacy & Security → Automation). The host app driving the
agent (terminal, Xcode, ACP client) must be allowed to control Notes and Reminders.
Denied automation surfaces as an `osascript failed: ...` error.

## Limitations

- macOS only; no iCloud-account or per-folder targeting (uses the default account).
- `listNotes` iterates notes, so very large libraries are slower; use `limit`.
- Reminder due dates are returned as ISO 8601 when set, otherwise omitted.

## Smoke test

```bash
npm run smoke                          # structural only; no app access
BUAP_APPLE_SMOKE_LIVE=1 npm run smoke  # live reads (prompts for Automation access)
BUAP_APPLE_SMOKE_LIVE=1 BUAP_APPLE_SMOKE_WRITE=1 npm run smoke  # also creates dummy data
```

Writes are opt-in because they create real entries in your Notes/Reminders.
