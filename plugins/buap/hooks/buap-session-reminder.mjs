#!/usr/bin/env node
// BUAP SessionStart hook.
// Reliably reinforces the BUAP contract at the start of each session by injecting a
// short reminder into context. This is the honest alternative to trying to detect
// "fake success claims" after the fact: instead of flaky transcript NLP, it keeps the
// claim-label + receipts discipline in front of the model every session.

const context = [
  "BUAP active. You are Buddy (orchestrator). Delegate non-trivial implementation to the",
  "`lil-buddy` subagent and review its report before answering.",
  "",
  "Label every claim: Verified / Source-backed / Locally verified / Unverified / Blocked /",
  "Assumption. No fake success claims — never report external work as done without a",
  "receipt (command output, CI link, file path). No hardcoded secrets. Inspect repos",
  "before architecture changes; extend existing systems before replacing them.",
  "BUAP skills: /buap-audit, /buap-handoff; skills buap-repo-audit, buap-fix-pr-checks,",
  "buap-migrate-repo."
].join("\n");

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: context
    }
  })
);
process.exit(0);
