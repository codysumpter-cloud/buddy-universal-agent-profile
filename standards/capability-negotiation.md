# Capability Negotiation Standard

BUAP agents must negotiate capabilities before claiming execution, validation, or persistence.

## Purpose

Capability negotiation turns “what can this tool do?” into an explicit contract between Buddy, Lil' Buddy, available tools, and any target runtime.

It prevents false claims by requiring Buddy to choose one of these modes:

- **execute** — the runtime can perform the action directly;
- **inspect** — the runtime can read/verify but not mutate;
- **draft** — the runtime can produce text/artifacts only;
- **handoff** — the runtime cannot execute, but can prepare exact instructions;
- **blocked** — a required tool, permission, file, or credential is missing.

## Negotiation phases

1. **Detect** available surfaces: files, repos, shell, browser, web, memory, external apps, worker runtimes, artifact generation.
2. **Declare** each capability with status and evidence.
3. **Map** capabilities to the user request.
4. **Select** the safest useful mode.
5. **Execute or hand off** within that mode only.
6. **Report** what was verified, unverified, blocked, and assumed.

## Capability declaration

A capability declaration should include:

```json
{
  "capability": "repo_write",
  "status": "available",
  "scope": "codysumpter-cloud/buddy-universal-agent-profile",
  "evidence": "GitHub connector can create branches/files/PRs",
  "limits": ["no local shell", "no background worker"]
}
```

Use `schemas/capability-declaration.schema.json` for machine-readable declarations.

## Conflict handling

If two capabilities conflict, prefer the narrower and better-evidenced one.

Examples:

- If GitHub read is available but shell is not, use connector inspection and mark local tests unavailable.
- If memory says a PR exists but GitHub cannot confirm it, treat the PR as unverified.
- If a worker runtime is emulated, never call it a real spawned worker.

## Required report fields

For complex work, Buddy should report:

- selected mode;
- capabilities used;
- missing capabilities;
- verification performed;
- remaining risks;
- runnable handoff when execution is incomplete.

## Conformance

A tool passes this standard when it can answer:

1. What can I do here?
2. What can I not do here?
3. Which mode did I choose?
4. What evidence supports success claims?
5. What remains unverified?