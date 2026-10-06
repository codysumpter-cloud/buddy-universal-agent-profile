# BUAP Agent Profile Runtime

`@prismtek/buap-agent-profile` turns a `prismtek-agent-profile-v1` document into an
inspectable persistent agent state.

It is the portable operating shell around BUAP Agent Life:

- stable identity, mission, goals, and responsibilities;
- named memory namespace and optional Agent Life binding;
- preferred execution targets;
- capability allow/deny declarations;
- approval/action rules;
- pause/resume control;
- queued and scheduled task state;
- in-progress/completed/failed activity;
- profile-hash-bound snapshots.

It deliberately does **not** pretend to be a scheduler, cloud computer, plugin system,
memory database, or background daemon. A host provides those capabilities and persists
the runtime snapshot.

```js
import { AgentProfileRuntime } from "@prismtek/buap-agent-profile";
import profile from "./atlas.agent-profile.json" with { type: "json" };

const atlas = new AgentProfileRuntime(profile);

atlas.bindCapability("github", { evidence_ref: "connector:github" });
atlas.enqueueTask({
  id: "repo-health",
  title: "Review repository health",
  action: "repo.inspect",
});

const decision = atlas.startTask("repo-health");
// decision.started === true when the action rule and lifecycle permit it.

atlas.completeTask("repo-health", {
  result_ref: "https://github.com/example/repo/pull/123",
});

// Persist atlas.snapshot() in the host.
```

## Action matching

Rules use exact matches or a trailing `.*` prefix wildcard:

- `repo.read` matches only `repo.read`.
- `repo.*` matches `repo.read`, `repo.write`, etc.
- `*` matches everything.

First matching rule wins. If nothing matches, the runtime defaults to `ask`.

`preapproved` means the current user request must explicitly cover the action. The
runtime does not infer consent from old tasks or memory.

## Scheduled work

A task with `scheduled_for` is stored as `scheduled`. `dueTasks(now)` reports tasks
whose time has arrived. A host scheduler must call the runtime and start them.

This is intentional: BUAP can describe always-on behavior without falsely claiming a
background worker exists in runtimes that do not provide one.

## Security

Profiles contain symbolic capability IDs only. Never store raw secrets or credentials
inside a profile or state snapshot. Hosts keep credentials out-of-model and expose
bounded capability bindings.
