#!/usr/bin/env node
// Smoke test for the Apple Notes/Reminders package.
//
// Tiers (each safer-by-default):
//   non-macOS                         -> skip cleanly (exit 0)
//   macOS, no flags                   -> structural check only (no app access)
//   macOS, BUAP_APPLE_SMOKE_LIVE=1    -> live READ: listNotes() + listReminders()
//                                        (triggers macOS automation permission prompts)
//   macOS, + BUAP_APPLE_SMOKE_WRITE=1 -> also CREATE a dummy note + reminder
//
// Writes are opt-in on purpose: they mutate the user's real Notes/Reminders, so the
// default run never touches live data.

import {
  listNotes,
  createNote,
  listReminders,
  createReminder,
  isSupported
} from "../dist/index.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.platform !== "darwin") {
  console.log(`SKIP: Apple Notes/Reminders is macOS-only (platform=${process.platform}).`);
  process.exit(0);
}

// Structural checks always run on macOS.
for (const [name, fn] of [
  ["listNotes", listNotes],
  ["createNote", createNote],
  ["listReminders", listReminders],
  ["createReminder", createReminder],
  ["isSupported", isSupported]
]) {
  assert(typeof fn === "function", `${name} should be exported as a function`);
}
assert(isSupported() === true, "isSupported() should be true on macOS");

const live = process.env.BUAP_APPLE_SMOKE_LIVE === "1";
const write = process.env.BUAP_APPLE_SMOKE_WRITE === "1";

if (!live) {
  console.log(
    "BUAP apple-notes-reminders smoke passed (structural). " +
      "Set BUAP_APPLE_SMOKE_LIVE=1 to exercise live reads, and BUAP_APPLE_SMOKE_WRITE=1 to create dummy data."
  );
  process.exit(0);
}

const notes = await listNotes(5);
assert(Array.isArray(notes), "listNotes() should resolve to an array");

const reminders = await listReminders();
assert(Array.isArray(reminders), "listReminders() should resolve to an array");

if (write) {
  const stamp = new Date().toISOString();
  await createNote(`BUAP smoke note ${stamp}`, "Created by the BUAP apple-notes-reminders smoke test. Safe to delete.");
  await createReminder(`BUAP smoke reminder ${stamp}`, new Date(Date.now() + 24 * 60 * 60 * 1000));
  console.log("Created 1 dummy note and 1 dummy reminder (delete them from Notes/Reminders).");
}

console.log(
  `BUAP apple-notes-reminders smoke passed (live). notes=${notes.length} pendingReminders=${reminders.length} write=${write}`
);
