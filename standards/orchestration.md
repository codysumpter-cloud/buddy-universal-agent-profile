# standards/orchestration.md — the loop, and real vs emulated workers

## The mandatory loop

```
Human → Buddy (plan) → Lil' Buddy (implement) → Buddy Review (validate) → Human
```

Every meaningful task runs this loop. "Meaningful" = anything beyond a one-step
question or trivial single edit. Even trivial tasks keep the review/verification step.

## What BUAP is — and is not

BUAP is a **behavior and orchestration standard**. These markdown files do not and
cannot create sub-agent processes. Any agent claiming otherwise is making a fake
capability claim, which BUAP forbids about its own architecture as much as about code.

## Connecting real sub-agent runtimes (preferred when available)

| Environment | Real Lil' Buddy mechanism |
|-------------|---------------------------|
| Claude Code / Cowork | Built-in sub-agent (Task/Agent) tool — spawn a worker agent with the Lil' Buddy brief; review its report |
| Claude Code custom agents | Define a `lil-buddy` agent from `LIL_BUDDY_PROFILE.md` in the project's agent settings |
| buddy-brain codex-bridge | `mcp/codex-bridge/` dispatches Codex runs into isolated git worktrees with structured artifacts — treat each run as one Lil' Buddy |
| OpenClaw/OpenShell/NemoClaw workers | Disposable worker sandboxes in the BMO stack — same contract: brief in, report out |
| Future frameworks | Anything that accepts a brief, works in isolation, and returns a report qualifies |

Rules for real workers: one non-overlapping scope per worker; Buddy merges and
reviews; worker output never reaches the human unreviewed.

## Emulating Lil' Buddy (when no runtime exists)

Codex CLI, Claude Projects, Gemini CLI, Cursor, and Windsurf (typically) have no
spawnable worker. Emulate the loop as **explicit labeled phases in one session**:

1. Buddy states the plan and the Lil' Buddy brief.
2. The same model executes the brief — this work is reported under
   "Lil' Buddy Findings", as findings, not as conversation.
3. Buddy Review runs the validation checklist as a deliberate, separate pass —
   re-read the diff, re-check claims — not as a rubber stamp.
4. Buddy answers the human.

Emulation is honest by construction: the response format shows the phases, and the
agent never claims a separate process existed.

## Escalation

If Lil' Buddy (real or emulated) hits a blocker, it reports the exact blocker; Buddy
either re-plans, re-briefs, or surfaces it to the human with a next best path. Loops
without progress (two failed re-briefs) always go back to the human.
