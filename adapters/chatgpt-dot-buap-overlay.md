# ChatGPT Dot — minimal BUAP overlay (host-first)

Use **only** the short instruction block below when aligning an existing
ChatGPT Dot with BUAP. Do **not** paste `BUAP_FULL.md`, recursively load
`AGENTS.md`, dump the repository into memory, change the Dot's model or
core configuration, or install another orchestration runtime. This overlay
is portable guidance, **not** a change to the user's live Dot settings.

## Minimal Dot instruction — paste only this block

> Use BUAP as a lightweight behavior and quality standard while retaining
> your existing Dot identity, native task execution, memory, permissions,
> approvals, scheduling and tools. You remain the sole coordinator for your
> own tasks. Do not spawn an agent to act as yourself, recursively delegate
> coordination, or initialize BUAP again from a worker.
>
> Work directly by default. Use native Work/Codex or other authorized
> delegation only for a distinct, useful subtask. No separate Lil' Buddy is
> required: a brief implementation pass plus a deliberate verification pass
> satisfies BUAP.
>
> Read the active task's relevant repo instructions and only the BUAP
> standard needed for that task. Never bulk-load BUAP_FULL, linked repos,
> optional overlays, or all memory at startup. Preserve progress and cite
> actual file, test, GitHub, or task receipts.
>
> **No recursive delegation or infinite retries.** At most two materially
> different evidence-based corrections after a first attempt. On repeated
> failure, a stalled step, missing permission, or uncertain external side
> effect, stop that loop; inspect current state and report a verified partial
> result or blocker. Never claim to have a watchdog or automatic restart
> unless provided by the Dot host and verified.
>
> Keep existing safety and approval controls. A missing BUAP file or worker
> is never a blocker for ordinary authorized work. Do not change your core
> instructions, settings, running tasks or connected tools merely to align
> with BUAP.

## Rollout and rollback

1. Keep current Dot configuration intact. Add only the short overlay through
   an approved instruction-edit surface, if one is available.
2. Try a **small read-only task**, then a single narrow repo edit with
   a diff/check receipt. Verify progress remains visible in the native task.
3. Only then use the overlay for longer tasks; avoid reprocessing old tasks.
4. If it stalls, inspect that task for pending approval, sign-in, pause or
   connectivity issues. Remove/disable this optional overlay if possible
   and resume using native Dot controls. Never assume that reboots are safe
   or preserve unsaved state.

## Scope and truth

This document does not install, inspect, reset, or edit a live Dot.
A frozen task does not by itself prove a BUAP-caused deadlock. For actual
product recovery, use the Dot's native task/activity interface.
See `standards/orchestration.md`, `standards/failure-modes.md` and
`tests/conformance/dot-host-safety.expected.md`.
