# Acceptance — BUAP Claude Code plugin

Manual + scripted checks for `plugins/buap/` and the marketplace at the repo root.

## Scripted (run from repo root)

```bash
node scripts/buap-conformance-check.mjs   # required files + key text present
node scripts/buap-lint.mjs                # plugin manifests parse + required keys,
                                          # agent/skill frontmatter, relative links,
                                          # prompt-tier invariants
```

Both must exit 0. The same two run in `.github/workflows/buap-conformance.yml`.

## Hook behavior (scripted)

```bash
# destructive -> permissionDecision "ask"
echo '{"tool_input":{"command":"rm -rf build/"}}' | node plugins/buap/hooks/buap-safety-guard.mjs
echo '{"tool_input":{"command":"git push --force origin main"}}' | node plugins/buap/hooks/buap-safety-guard.mjs

# safe -> no output, exit 0
echo '{"tool_input":{"command":"npm test"}}' | node plugins/buap/hooks/buap-safety-guard.mjs

# session reminder -> JSON with hookSpecificOutput.additionalContext
echo '{"hook_event_name":"SessionStart","source":"startup"}' | node plugins/buap/hooks/buap-session-reminder.mjs
```

Expected:
- Destructive commands emit `{"hookSpecificOutput":{...,"permissionDecision":"ask",...}}`.
- Safe commands emit nothing and exit 0 (normal flow, no extra prompt).
- The session reminder emits `additionalContext` carrying the BUAP claim-label/receipts contract.

## Manual (in a Claude Code session)

1. `/plugin marketplace add` the repo, then `/plugin install buap@buap`. Plugin appears
   enabled with 1 subagent, 3 skills, 2 commands, and hooks.
2. Ask for a non-trivial repo change. Buddy should delegate to the `lil-buddy` subagent
   and review its report before answering (structured Inspected/Changed/Ran/Verified output).
3. Run `/buap-audit .` — get verified-findings-only output with claim labels.
4. Run `/buap-handoff "codex to finish X"` — get a complete handoff brief in the BUAP shape.
5. Ask Buddy to run a destructive Bash command (e.g. `rm -rf` a directory). The safety
   guard should force an approval prompt rather than running it silently.

## Definition of done

- [ ] Both scripts exit 0 locally and in CI.
- [ ] All three hook payloads behave as described above.
- [ ] Plugin installs and lists its components without errors.
- [ ] `lil-buddy` is invoked for delegated work; Buddy reviews before answering.
