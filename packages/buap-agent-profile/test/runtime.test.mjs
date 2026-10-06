import assert from "node:assert/strict";
import test from "node:test";
import { AgentProfileRuntime, validateAgentProfile } from "../src/index.mjs";

const profile = {
  schema: "prismtek-agent-profile-v1",
  id: "atlas",
  display_name: "Atlas",
  relationship_role: "buddy",
  kind: "primary",
  mission: "Help the user turn goals into verified finished work.",
  goals: ["Keep important work moving"],
  responsibilities: ["Plan", "Delegate", "Review", "Report"],
  identity: { name_source: "self" },
  model: { strategy: "host_default" },
  memory: {
    namespace: "agents/atlas",
    shared_context: ["user"],
    write_scopes: ["agents/atlas"],
    proactive_learning: true,
    life_profile_ref: ".buddy/life-profile.json",
  },
  execution: {
    preferred_targets: ["chat", "work", "local_computer"],
    background_allowed: true,
    max_concurrent_tasks: 1,
  },
  capabilities: {
    required: ["memory"],
    optional: ["github", "web"],
    denied: ["payments"],
  },
  autonomy: {
    proactive_research: true,
    create_tasks: true,
    schedule_tasks: true,
  },
  action_rules: [
    { match: "repo.read", behavior: "allow" },
    { match: "repo.write", behavior: "preapproved" },
    { match: "external.*", behavior: "ask" },
    { match: "account.password", behavior: "handoff" },
    { match: "payments.*", behavior: "deny" },
  ],
  channels: ["chat", "app", "cli"],
  schedules: [],
};

test("validates a first-class agent profile", () => {
  assert.equal(validateAgentProfile(profile), true);
});

test("profile is immutable while runtime state is separate", () => {
  const runtime = new AgentProfileRuntime(profile);
  assert.equal(Object.isFrozen(runtime.profile), true);
  assert.equal(runtime.snapshot().display_name, undefined);
  assert.throws(() => {
    runtime.profile.goals.push("secret new goal");
  });
});

test("capability bindings require declared capability and evidence", () => {
  const runtime = new AgentProfileRuntime(profile);
  assert.throws(() => runtime.bindCapability("github"), /evidence_ref/);
  assert.throws(() => runtime.bindCapability("payments", { evidence_ref: "x" }), /denied/);
  runtime.bindCapability("memory", { evidence_ref: "memory:connected" });
  runtime.bindCapability("github", { evidence_ref: "connector:github" });
  assert.deepEqual(runtime.capabilityReport(), {
    connected: ["github", "memory"],
    missing_required: [],
    optional_available: ["github"],
    denied: ["payments"],
  });
});

test("required capabilities gate execution and proactive work", () => {
  const runtime = new AgentProfileRuntime(profile);
  runtime.enqueueTask({ id: "gated", title: "Gated", action: "repo.read" });
  const blocked = runtime.startTask("gated");
  assert.equal(blocked.started, false);
  assert.equal(blocked.decision, "missing_capabilities");
  assert.deepEqual(blocked.missing_capabilities, ["memory"]);
  assert.equal(runtime.canProactivelyResearch(), false);

  runtime.bindCapability("memory", { evidence_ref: "memory:connected" });
  assert.equal(runtime.canProactivelyResearch(), true);
  assert.equal(runtime.startTask("gated").started, true);
});

test("activity view mirrors queued, in-progress, scheduled, and completed work", () => {
  const runtime = new AgentProfileRuntime(profile);
  runtime.bindCapability("memory", { evidence_ref: "memory:connected" });
  runtime.enqueueTask({ id: "queued", title: "Queued", action: "repo.read" });
  runtime.enqueueTask({
    id: "scheduled",
    title: "Scheduled",
    action: "repo.read",
    scheduled_for: "2026-10-07T12:00:00Z",
  });
  runtime.startTask("queued");
  let view = runtime.activityView();
  assert.equal(view.in_progress.length, 1);
  assert.equal(view.scheduled.length, 1);
  runtime.completeTask("queued", { result_ref: "receipt:done" });
  view = runtime.activityView();
  assert.equal(view.in_progress.length, 0);
  assert.equal(view.completed.length, 1);
});

test("action rules distinguish allow, preapproval, ask, handoff, and deny", () => {
  const runtime = new AgentProfileRuntime(profile);
  assert.equal(runtime.authorizeAction("repo.read").decision, "allow");
  assert.equal(runtime.authorizeAction("repo.write").decision, "ask");
  assert.equal(runtime.authorizeAction("repo.write", { preapproved: true }).decision, "allow");
  assert.equal(runtime.authorizeAction("external.send").decision, "ask");
  assert.equal(runtime.authorizeAction("account.password").decision, "handoff");
  assert.equal(runtime.authorizeAction("payments.charge").decision, "deny");
  assert.equal(runtime.authorizeAction("unknown.action").decision, "ask");
});

test("tasks move through queue, execution, completion, and receipts", () => {
  const runtime = new AgentProfileRuntime(profile);
  runtime.bindCapability("memory", { evidence_ref: "memory:connected" });
  runtime.enqueueTask({
    id: "repo-health",
    title: "Review repo health",
    action: "repo.read",
    created_at: "2026-10-06T12:00:00Z",
  });
  const started = runtime.startTask("repo-health", { now: "2026-10-06T12:01:00Z" });
  assert.equal(started.started, true);
  const completed = runtime.completeTask("repo-health", {
    now: "2026-10-06T12:02:00Z",
    result_ref: "receipt:run-123",
  });
  assert.equal(completed.status, "completed");
  assert.equal(completed.result_ref, "receipt:run-123");
  assert.ok(runtime.snapshot().activity.some((item) => item.kind === "task.completed"));
});

test("scheduled tasks are inert until due and a host starts them", () => {
  const runtime = new AgentProfileRuntime(profile);
  runtime.bindCapability("memory", { evidence_ref: "memory:connected" });
  runtime.enqueueTask({
    id: "morning-brief",
    title: "Prepare morning brief",
    action: "repo.read",
    created_at: "2026-10-06T12:00:00Z",
    scheduled_for: "2026-10-07T12:00:00Z",
  });
  assert.equal(runtime.dueTasks("2026-10-07T11:59:59Z").length, 0);
  assert.equal(runtime.dueTasks("2026-10-07T12:00:00Z").length, 1);
  assert.equal(runtime.startTask("morning-brief", { now: "2026-10-07T11:00:00Z" }).decision, "not_due");
  assert.equal(runtime.startTask("morning-brief", { now: "2026-10-07T12:00:00Z" }).started, true);
});

test("pause blocks new task starts without deleting work", () => {
  const runtime = new AgentProfileRuntime(profile);
  runtime.bindCapability("memory", { evidence_ref: "memory:connected" });
  runtime.enqueueTask({ id: "one", title: "One", action: "repo.read" });
  runtime.pause("2026-10-06T12:00:00Z");
  assert.equal(runtime.startTask("one").decision, "paused");
  assert.equal(runtime.snapshot().tasks[0].status, "queued");
  runtime.resume("2026-10-06T12:05:00Z");
  assert.equal(runtime.startTask("one").started, true);
});

test("autonomy flags constrain self-created work", () => {
  const restricted = structuredClone(profile);
  restricted.id = "restricted";
  restricted.autonomy.create_tasks = false;
  restricted.autonomy.schedule_tasks = false;
  const runtime = new AgentProfileRuntime(restricted);
  assert.throws(
    () => runtime.enqueueTask({ id: "self-task", title: "Self task", action: "repo.read" }, { origin: "agent" }),
    /autonomous task creation/,
  );
  runtime.enqueueTask({ id: "user-task", title: "User task", action: "repo.read" }, { origin: "user" });
  assert.equal(runtime.snapshot().tasks.length, 1);
});

test("profile hashes are stable across object key order", () => {
  const runtime = new AgentProfileRuntime(profile);
  const snapshot = runtime.snapshot();
  const reordered = Object.fromEntries(Object.entries(profile).reverse());
  const restored = new AgentProfileRuntime(reordered, snapshot);
  assert.equal(restored.snapshot().profile_sha256, snapshot.profile_sha256);
});

test("concurrency limits and profile-bound snapshots are enforced", () => {
  const runtime = new AgentProfileRuntime(profile);
  runtime.bindCapability("memory", { evidence_ref: "memory:connected" });
  runtime.enqueueTask({ id: "a", title: "A", action: "repo.read" });
  runtime.enqueueTask({ id: "b", title: "B", action: "repo.read" });
  assert.equal(runtime.startTask("a").started, true);
  assert.equal(runtime.startTask("b").decision, "concurrency_limit");

  const snapshot = runtime.snapshot();
  const restored = new AgentProfileRuntime(profile, snapshot);
  assert.equal(restored.snapshot().tasks[0].status, "in_progress");

  const other = structuredClone(profile);
  other.mission = "Changed mission";
  assert.throws(() => new AgentProfileRuntime(other, snapshot), /different agent profile/);
});
