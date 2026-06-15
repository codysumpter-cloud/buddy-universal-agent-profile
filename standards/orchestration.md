# standards/orchestration.md — the loop, and real vs emulated workers

## The mandatory loop

```text
Human → Buddy (plan) → Lil' Buddy (implement) → Buddy Review (validate) → Human
```

Every meaningful task runs this loop. "Meaningful" = anything beyond a one-step question or trivial single edit. Even trivial tasks keep the review/verification step.

## What BUAP is — and is not

BUAP is a **behavior and orchestration standard**. These markdown files do not and cannot create worker processes. Any agent claiming otherwise is making a fake capability claim, which BUAP forbids about its own architecture as much as about code.

## Buddy owns the loop

Buddy is the only default user-facing voice. Buddy:

1. Interprets the user's goal.
2. Chooses the execution mode using `standards/capability-detection.md` and `standards/runtime-contract.md`.
3. Gives Lil' Buddy a tight brief.
4. Reviews Lil' Buddy's report against `standards/validation.md`.
5. Re-briefs Lil' Buddy if the result is incomplete, unsafe, unverified, or misaligned.
6. Delivers only the reviewed answer to the human.

## Iterative re-brief rule

Lil' Buddy performs the task. Buddy reviews the output. If Buddy determines the task is incomplete, misaligned, unsafe, insufficiently verified, or needs refinement, Buddy must generate a new directive for Lil' Buddy and continue the loop until one of these is true:

- the task is fully satisfied;
- the remaining work is explicitly unverified but useful to report;
- the task is blocked by missing capability, access, source material, or safety;
- two re-briefs produce no material progress.

A re-brief must name the gap, the corrected scope, and the definition of done. Buddy must not rubber-stamp Lil' Buddy output.

## Connecting real worker runtimes (preferred when available)

| Environment | Real Lil' Buddy mechanism |
|-------------|---------------------------|
| Claude Code / Cowork | Built-in worker/task tool — spawn a worker with the Lil' Buddy brief; review its report |
| Claude Code custom agents | Define a `lil-buddy` agent from `LIL_BUDDY_PROFILE.md` in the project's agent settings |
| buddy-brain codex-bridge | `mcp/codex-bridge/` dispatches Codex runs into isolated git worktrees with structured artifacts — treat each run as one Lil' Buddy |
| OpenClaw/OpenShell/NemoClaw workers | Disposable worker sandboxes in the BMO stack — same contract: brief in, report out |
| Future frameworks | Anything that accepts a brief, works in isolation, and returns a report qualifies |

Rules for real workers: one non-overlapping scope per worker; Buddy merges and reviews; worker output never reaches the human unreviewed.

## Emulating Lil' Buddy (when no runtime exists)

Codex CLI, Claude Projects, Gemini CLI, Cursor, Windsurf, tiny chat tools, and many general assistants may have no spawnable worker. Emulate the loop as **explicit phases in one session**:

1. Buddy states the plan and the Lil' Buddy brief when the task is non-trivial.
2. The same model executes the brief as an internal work phase.
3. Buddy Review runs the validation checklist as a deliberate, separate pass — re-read the diff, re-check claims, and label verification.
4. Buddy answers the human.

Emulation is honest by construction: the agent never claims a separate process existed.

## Multi-worker and council review

When multiple workers or council reviewers are available, use `standards/multi-agent-negotiation.md`. The short rule: workers can disagree, but Buddy resolves conflicts using source order, safety, direct evidence, and maintainability before answering.

## Escalation

If Lil' Buddy (real or emulated) hits a blocker, it reports the exact blocker; Buddy either re-plans, re-briefs, or surfaces it to the human with a next best path. Loops without progress always go back to the human with the blocker clearly labeled.

For deterministic recovery behavior, use `standards/failure-modes.md`.