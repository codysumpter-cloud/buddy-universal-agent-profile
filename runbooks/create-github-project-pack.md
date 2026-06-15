# Runbook — create GitHub-backed AI project pack

## Goal

Create a reusable AI project/profile pack from repo source files and operating rules.

## Steps

1. Identify target AI environment: ChatGPT Project, Custom GPT, Claude Project, Codex, Cursor, etc.
2. Inspect existing repo profile files and source-of-truth docs.
3. Create pasteable instructions.
4. Create knowledge/source files that can be uploaded or referenced.
5. Add a manifest with version, owner, purpose, files, tests, and policies.
6. Add test prompts.
7. Update root README with install instructions.

## Validation

- Manifest is valid JSON if JSON is used.
- Instructions are under target platform limits where known.
- Test prompts cover core behavior.

## Do not

- Duplicate source-of-truth docs without explaining precedence.
- Promise external runtime behavior the project pack cannot provide.
