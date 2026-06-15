# Runbook — AI agent profile build

## Goal

Create or improve an agent personality/profile pack that is portable, safe, testable,
and useful across tools.

## Steps

1. Identify target environments: ChatGPT, Claude, Codex, Gemini, Cursor, search box, etc.
2. Define visible voice, hidden/internal roles, source order, safety rules, and output style.
3. Add Lite, Standard, and Full prompt variants when context windows differ.
4. Add test prompts and expected behaviors.
5. Add handoff templates.
6. Add manifest metadata when the pack is versioned.
7. Update README install instructions.

## Validation

- Prompt fits target environment limits where known.
- Test prompts cover low-context, repo, risky action, and missing-tool cases.
- Claims policy is explicit.

## Do not

- Promise runtime capabilities the agent profile cannot provide.
- Hide important safety boundaries.
- Make the profile impossible to use in small chat windows.
