import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** A single Apple Note. `body` is the note's plain text (HTML stripped by Notes). */
export type Note = {
  title: string;
  body: string;
};

/** A pending (not completed) Apple Reminder. `dueDate` is ISO 8601 when set. */
export type Reminder = {
  title: string;
  dueDate?: string;
};

// Delimiters chosen to be safe against note/reminder content: ASCII unit (US, 31)
// separates fields, record (RS, 30) separates rows. They effectively never appear in
// user-entered text, so we avoid the `::`/newline collisions a naive parser hits.
const US = String.fromCharCode(31);
const RS = String.fromCharCode(30);

const OSA_TIMEOUT_MS = Number(process.env.BUAP_APPLE_OSA_TIMEOUT_MS || 30000);
const OSA_MAX_BUFFER = 16 * 1024 * 1024;

function assertMacOs(): void {
  if (process.platform !== "darwin") {
    throw new Error(
      `Apple Notes/Reminders integration is macOS-only (it requires osascript/AppleScript). Current platform: ${process.platform}.`
    );
  }
}

/**
 * Run an AppleScript via osascript. The script should use `on run argv ... end run`;
 * `args` are passed as argv items so user text never has to be escaped into the script
 * body (no AppleScript string-injection surface).
 */
async function runOsascript(script: string, args: string[] = []): Promise<string> {
  assertMacOs();
  try {
    const { stdout } = await execFileAsync(
      "osascript",
      ["-l", "AppleScript", "-e", script, ...args],
      { timeout: OSA_TIMEOUT_MS, maxBuffer: OSA_MAX_BUFFER }
    );
    return stdout;
  } catch (error) {
    const err = error as { stderr?: Buffer | string; message?: string; code?: string };
    const stderr = typeof err.stderr === "string" ? err.stderr : err.stderr?.toString?.() ?? "";
    if (err.code === "ENOENT") {
      throw new Error("osascript was not found. Apple Notes/Reminders integration is macOS-only.");
    }
    throw new Error(`osascript failed: ${(stderr || err.message || "unknown error").trim()}`);
  }
}

function parseRows(stdout: string): string[][] {
  return stdout
    .split(RS)
    .map((row) => row.replace(/\r?\n$/, ""))
    .filter((row) => row.length > 0)
    .map((row) => row.split(US));
}

/** List notes (title + plain-text body), capped by `limit` (default 100). */
export async function listNotes(limit = Number(process.env.BUAP_APPLE_NOTES_LIMIT || 100)): Promise<Note[]> {
  const script = `on run argv
  set theLimit to (item 1 of argv) as integer
  set fieldSep to (ASCII character 31)
  set recordSep to (ASCII character 30)
  set output to ""
  tell application "Notes"
    set theNotes to notes
    set total to count of theNotes
    if total > theLimit then set total to theLimit
    repeat with i from 1 to total
      set N to item i of theNotes
      set noteBody to ""
      try
        set noteBody to plaintext of N
      on error
        set noteBody to body of N
      end try
      set output to output & (name of N) & fieldSep & noteBody & recordSep
    end repeat
  end tell
  return output
end run`;
  const stdout = await runOsascript(script, [String(Math.max(0, Math.floor(limit)))]);
  return parseRows(stdout).map(([title, ...rest]) => ({
    title: title ?? "",
    body: rest.join(US)
  }));
}

/** Create a note. The title becomes the note's first line; body follows. */
export async function createNote(title: string, body: string): Promise<void> {
  if (!title || !title.trim()) throw new Error("createNote requires a non-empty title.");
  const script = `on run argv
  set theTitle to item 1 of argv
  set theBody to item 2 of argv
  tell application "Notes"
    make new note with properties {body:theTitle & return & theBody}
  end tell
end run`;
  await runOsascript(script, [title, body ?? ""]);
}

/** List pending (not completed) reminders with optional ISO 8601 due dates. */
export async function listReminders(): Promise<Reminder[]> {
  const script = `on run argv
  set fieldSep to (ASCII character 31)
  set recordSep to (ASCII character 30)
  set output to ""
  tell application "Reminders"
    set pending to (reminders whose completed is false)
    repeat with R in pending
      set due to ""
      if (due date of R) is not missing value then
        set due to (due date of R) as «class isot» as string
      end if
      set output to output & (name of R) & fieldSep & due & recordSep
    end repeat
  end tell
  return output
end run`;
  const stdout = await runOsascript(script);
  return parseRows(stdout).map(([title, due]) => {
    const reminder: Reminder = { title: title ?? "" };
    if (due && due.trim()) {
      const parsed = new Date(due);
      reminder.dueDate = Number.isNaN(parsed.getTime()) ? due : parsed.toISOString();
    }
    return reminder;
  });
}

/** Create a reminder, optionally with a due date. */
export async function createReminder(title: string, dueDate?: Date): Promise<void> {
  if (!title || !title.trim()) throw new Error("createReminder requires a non-empty title.");
  const hasDue = dueDate instanceof Date && !Number.isNaN(dueDate.getTime());
  const script = `on run argv
  set theTitle to item 1 of argv
  set hasDue to (item 2 of argv)
  tell application "Reminders"
    if hasDue is "1" then
      set y to (item 3 of argv) as integer
      set mo to (item 4 of argv) as integer
      set d to (item 5 of argv) as integer
      set hh to (item 6 of argv) as integer
      set mi to (item 7 of argv) as integer
      set theDate to current date
      set day of theDate to 1
      set year of theDate to y
      set month of theDate to mo
      set day of theDate to d
      set hours of theDate to hh
      set minutes of theDate to mi
      set seconds of theDate to 0
      make new reminder with properties {name:theTitle, due date:theDate}
    else
      make new reminder with properties {name:theTitle}
    end if
  end tell
end run`;
  const args = [title, hasDue ? "1" : "0"];
  if (hasDue && dueDate) {
    args.push(
      String(dueDate.getFullYear()),
      String(dueDate.getMonth() + 1),
      String(dueDate.getDate()),
      String(dueDate.getHours()),
      String(dueDate.getMinutes())
    );
  }
  await runOsascript(script, args);
}

/** True when this platform can run the integration. */
export function isSupported(): boolean {
  return process.platform === "darwin";
}
