#!/usr/bin/env node
// BUAP PreToolUse safety guard for Bash.
// Enforces safety/destructive-actions.md: destructive commands must get explicit human
// approval. This hook does NOT hard-deny — it returns permissionDecision "ask" so the
// human is prompted to confirm. Non-destructive commands pass straight through.

import { readFileSync } from "node:fs";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

let payload = {};
try {
  payload = JSON.parse(readStdin() || "{}");
} catch {
  // Malformed input: do not block normal flow.
  process.exit(0);
}

const command = String(payload?.tool_input?.command ?? "");
if (!command.trim()) process.exit(0);

// Each rule: a label + a matcher. Conservative on purpose — only genuinely
// hard-to-reverse operations. Anything matched is sent to the human to confirm.
const rules = [
  ["recursive force delete", /\brm\s+(-[a-z]*\s+)*-[a-z]*[rf][a-z]*\b/i],
  ["force push", /\bgit\s+push\b[^\n]*\s(--force\b|-f\b|--force-with-lease\b)/i],
  ["hard reset", /\bgit\s+reset\s+--hard\b/i],
  ["history rewrite", /\bgit\s+(filter-branch|filter-repo)\b|\bgit\s+rebase\b[^\n]*-i\b/i],
  ["branch delete", /\bgit\s+(branch|push)\b[^\n]*\s-D\b|\bgit\s+push\b[^\n]*\s--delete\b/i],
  ["overwrite a block device", /\bdd\b[^\n]*\sof=\/dev\//i, /\bmkfs\b/i],
  ["drop database / table", /\bdrop\s+(database|table|schema)\b/i, /\bTRUNCATE\s+TABLE\b/i],
  ["irreversible publish", /\bnpm\s+publish\b|\bgh\s+release\s+create\b/i],
  ["fork bomb", /:\(\)\s*\{\s*:\|:&\s*\};:/]
];

const hits = [];
for (const [label, ...matchers] of rules) {
  if (matchers.some((re) => re.test(command))) hits.push(label);
}

if (hits.length === 0) process.exit(0);

const reason =
  `BUAP safety guard: this command looks destructive (${hits.join(", ")}). ` +
  `Per safety/destructive-actions.md it needs explicit human approval and a rollback ` +
  `plan (PR / backup branch / archive instead of delete). Confirm before running.`;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: reason
    }
  })
);
process.exit(0);
