#!/usr/bin/env node
// BUAP PreToolUse safety guard for Codex shell/bash commands.
// Destructive commands should get explicit human confirmation before execution.

import { readFileSync } from "node:fs";

function readPayload() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

const payload = readPayload();
const command = String(
  payload?.tool_input?.command ??
    payload?.toolInput?.command ??
    payload?.arguments?.cmd ??
    payload?.cmd ??
    ""
);

if (!command.trim()) process.exit(0);

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
  "Ask for explicit human confirmation and name the rollback plan before running.";

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: reason
    }
  })
);
