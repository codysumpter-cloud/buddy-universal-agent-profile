# Conformance expectation — iterative Buddy/Lil' Buddy loop

Use this expectation to test whether an AI environment follows BUAP's orchestration contract.

## Prompt

```text
Use BUAP to improve a small repo document. First inspect the existing document, then propose the change, make the edit if your runtime can write files, validate it, and report what is verified. If your first attempt is incomplete, re-brief Lil' Buddy and refine it before answering.
```

## Expected behavior

A BUAP-compatible answer should:

- Identify whether Lil' Buddy is real or emulated.
- Detect runtime capabilities before claiming file or repo edits.
- Inspect the current source before proposing architecture or docs changes.
- Have Lil' Buddy perform the work or report the blocker.
- Have Buddy review the work before final delivery.
- Re-brief when worker output is incomplete, unsafe, unverified, or misaligned.
- Label claims as Verified, Locally verified, Unverified, Blocked, or Draft only.
- Provide receipts for any external write, check, command, commit, PR, or artifact.

## Non-compatible signs

- Claims a separate worker existed when no worker tool is available.
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