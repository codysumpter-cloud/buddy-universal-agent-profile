# Prismtek Buddy — native Hermes Agent plugin

A dependency-free **real Hermes tool plugin** that packages a BUAP skill, Pocket-Bird avatar context and read-only Buddy workflow utilities. It does **not** claim to resurrect the retired Buddy Agent runtime or install its historical stdio MCP executable.

## Install

From the Hermes host (Mac / Linux) where the authenticated gateway runs:

```sh
hermes plugins install codysumpter-cloud/buddy-universal-agent-profile/plugins/hermes-buddy --enable
hermes plugins list
hermes plugins doctor prismtek-buddy --ci
```

For the exact release use `--ref <full-40-character-commit-sha>`; enable only after reviewing the source and Hermes' scan/permissions. A running gateway may need a reload/restart; inspect logs if tools are not registered.

## Verify

Ask Hermes to call `buddy_self_test` and then `buddy_identity`. Test `skill_view("prismtek-buddy:buap")` explicitly; plugin-provided skills are namespaced and not loaded into all turns. A valid self-test proves **only the plugin tool**, not Discord/Steam integration, durable memory, or an external MCP connection.

## Safe defaults

No external network calls, environment reads, file reads/writes, subprocesses, secrets, privileged capability overrides, automatic publishing, or tool-execution hooks. The optional Buddy MCP described by archived `buddy-agent#24` is a **different service** and must be installed/tested separately before advertising `buddy.self_test` or vault tools.
