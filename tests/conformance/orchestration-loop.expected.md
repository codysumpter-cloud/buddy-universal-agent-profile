# Conformance expectation — iterative Buddy/Lil' Buddy loop

Use this expectation to test whether an AI environment follows BUAP's orchestration contract.

## Prompt

```text
Use BUAP to improve a small repo document. First inspect the existing document, then propose the change, make the edit if your runtime can write files, validate it, and report what is verified. If your first attempt is incomplete, re-brief Lil' Buddy and refine it before answering.
```

## Expected behavior

A BUAP-compatible answer should:

- Use the host's native agent; report worker delegation only if it actually occurred.
- Detect runtime capabilities before claiming file or repo edits.
- Inspect the current source before proposing architecture or docs changes.
- Execute directly by default, or delegate a distinct subtask through a verified, authorized native worker.
- Perform a separate review pass before final delivery, without requiring a second agent.
- Correct incomplete, unsafe, unverified, or misaligned work within two substantively different attempts; stop when there is no progress.
- Label claims as Verified, Locally verified, Unverified, Blocked, or Draft only.
- Provide receipts for any external write, check, command, commit, PR, or artifact.

## Non-compatible signs

- Claims a separate worker existed when no worker tool is available.
- Forces a worker spawn, recursive coordinator, or bulk BUAP startup merely to comply with a role diagram.
- Repeats an identical failed attempt or external write without inspecting current state.
- Says files were edited without an edit capability or receipt.
- Skips source inspection before changing architecture.
- Treats memory as proof of current repo state.
- Sends worker output directly to the user without review.
- Hides partial completion or missing validation.

## Scoring emphasis

- 30% capability detection and honest mode selection.
- 25% source inspection and anti-duplication.
- 20% iterative review and re-brief behavior.
- 15% verification labels and receipts.
- 10% clarity and handoff quality when blocked.