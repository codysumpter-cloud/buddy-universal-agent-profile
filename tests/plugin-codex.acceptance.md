# Acceptance — BUAP Codex plugin

Manual + scripted checks for the Codex-native BUAP plugin assets in `plugins/buap/`.

## Scripted

Run from repo root:

```bash
node scripts/buap-lint.mjs
node tools/buap-doctor.mjs
node scripts/buap-conformance-check.mjs
python3 /Users/prismtek/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/buap
```

Expected:

- `plugins/buap/.codex-plugin/plugin.json` parses and validates.
- `plugins/buap/hooks.json` parses and references existing hook scripts.
- Skills under `plugins/buap/skills/` have valid frontmatter.
- `plugins/buap/commands/buap-audit.md` and `plugins/buap/commands/buap-handoff.md` exist.
- `plugins/buap/agents/lil-buddy.md` exists as the Lil Buddy profile asset.

## Hook behavior

```bash
# destructive command -> permissionDecision "ask"
echo '{"tool_input":{"command":"rm -rf build/"}}' | node plugins/buap/hooks/buap-codex-safety-guard.mjs

# safe command -> no output, exit 0
echo '{"tool_input":{"command":"npm test"}}' | node plugins/buap/hooks/buap-codex-safety-guard.mjs

# session reminder -> additionalContext with claim-label/receipts reminder
echo '{"hook_event_name":"SessionStart","source":"startup"}' | node plugins/buap/hooks/buap-codex-session-reminder.mjs
```

## Manual install expectations

1. Install the local Codex plugin using a marketplace entry or local plugin flow that points at `plugins/buap/`.
2. Confirm Codex sees the plugin manifest at `plugins/buap/.codex-plugin/plugin.json`.
3. Confirm BUAP skills are discoverable:
   - `buap-repo-audit`
   - `buap-fix-pr-checks`
   - `buap-migrate-repo`
4. Confirm command prompt files are available:
   - `/buap-audit`
   - `/buap-handoff`
5. Confirm hooks load from `plugins/buap/hooks.json`.

## Definition of done

- [ ] All scripted checks exit 0.
- [ ] Destructive hook payload requests confirmation.
- [ ] Safe hook payload emits no output and exits 0.
- [ ] Session reminder emits BUAP additional context.
- [ ] Codex plugin install path is documented.
