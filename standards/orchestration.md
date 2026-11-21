# standards/orchestration.md — host-native, bounded execution and review

## Principle: never replace the host's orchestration

BUAP defines **logical responsibilities**, not mandatory agents, threads,
subprocesses or daemons. The active host controls execution, tool calls,
memory, scheduling, subagents, approvals, and cancellation. Its higher-priority
instructions take precedence. **One agent with a separate review pass is
fully BUAP-compliant.** Do not install an orchestrator on top of an orchestrator,
overwrite an agent's core instructions, or try to invoke the current agent as
its own worker.

For ChatGPT Dots, use `adapters/chatgpt-dot-buap-overlay.md` first. A Dot already
operates through its own conversations, tasks and authorized tools. BUAP must
not turn conceptual roles into new Dot instances, Work/Codex tasks, or recursive
calls unless a *distinct* subtask needs native delegation and the host/user
permits it.

## Logical path (not a required process graph)

```text
Human request → existing host agent → implement / optional native delegation
              → review evidence and safety → report result
```

- **Coordinator function:** understand intent, choose capabilities, track
  work, check outputs, and communicate results. This function is not an agent
  name or a newly spawned service.
- **Worker function:** execute a specific subtask, either inside the current
  agent's ordinary workflow or through a verified host-native worker.
- **Review function:** re-read relevant changes, run available checks, and
  distinguish verified facts from unverified ones. Self-review is acceptable
  when independent review is unavailable. Never claim an independent reviewer
  that did not exist.

## Selection rules

1. **Default: existing agent acts directly.** No mandatory Lil' Buddy. A
   one-pass implementation plus one deliberate review is sufficient.
2. **Optional native delegation:** only when a distinct subtask benefits from
   it, the host exposes a real worker mechanism, permissions allow it, and
   its execution cost is proportionate. One owner per scope; avoid overlap.
3. **No recursive delegation:** a delegated worker must not instantiate a new
   coordinator, delegate the same task back to the parent, start another BUAP
   bootstrap, or clone the current agent to satisfy role labels.
4. **No invented worker:** if no subagent exists, keep the phases internal.
   A label such as “emulated worker” describes a review technique, not a
   running process.
5. **No mandatory long setup:** read a compact host adapter plus sources
   relevant to the current task. Do not load BUAP_FULL's entire reference list,
   optional overlays, mission control, archived repos, or memory stores unless
   needed and accessible.

## Bounded execution and retry contract

- Default budget: **one implementation pass + one review pass**.
- Up to **two** additional, materially different re-brief/correction passes
  are allowed if evidence identifies a specific fix. Never infinitely chase
  the “perfect” review.
- Stop after a repeated identical failure, a stalled/no-progress attempt, a
  missing permission, or an unavailable tool. Report the actual status and
  next safe action; do not retry the same side effect blindly.
- Timeouts and heartbeat supervision require actual host support. These
  markdown rules **cannot** detect, prevent, or restart a frozen Dot.
- Keep work granular and preserve checkpoints/commit refs when supported.
  After interruption, inspect the existing task and remote side effects
  before resuming; never assume an operation did or did not occur.
- For long tasks, give progress updates when the host supports them, while
  respecting its communication rules.

## Host adaptation examples

| Host | Execution choice |
|---|---|
| ChatGPT Dot / ChatGPT Work | Keep native task control; use native Work/Codex delegation only for independently useful authorized work |
| Claude Code / Cowork with native worker tool | Optional scoped delegation with a reviewed result |
| Codex / IDE / chat without worker runtime | Single agent implements, then performs an explicit review pass |
| Multi-agent environment | Existing coordinator delegates bounded non-overlapping work and reviews outputs |

“Buddy” and “Lil' Buddy” describe relationship/functions, not a fixed
hierarchy, required personas, or an instruction to launch additional agents.

## Failure and completion

A task ends when work is verified, honestly partial, or blocked with a useful
handoff. A re-brief states the exact gap and acceptance check, and must not
repeat a failed call without new evidence. For recovery use
`standards/failure-modes.md`; for factual claims use
`standards/validation.md`.
