
import assert from "node:assert/strict";
import test from "node:test";
import { AgentProfileRuntime } from "../../buap-agent-profile/src/index.mjs";
import { MissionControl, validateMission, inspectToolAction, createHandoff } from "../src/index.mjs";

const profile = {
  schema: "prismtek-agent-profile-v1", id: "atlas", display_name: "Atlas",
  relationship_role: "buddy", kind: "primary", mission: "Build and verify",
  goals: ["Ship"], responsibilities: ["Plan", "Review"],
  identity: { name_source: "self" },
  memory: { namespace: "agents/atlas", shared_context: [], write_scopes: [], proactive_learning: false },
  execution: { preferred_targets: ["chat"], background_allowed: false, max_concurrent_tasks: 2 },
  capabilities: { required: [], optional: ["github", "web"], denied: ["payments"] },
  autonomy: { proactive_research: false, create_tasks: false, schedule_tasks: false },
  action_rules: [
    { match: "repo.read", behavior: "allow" },
    { match: "repo.write", behavior: "ask" },
    { match: "external.*", behavior: "deny" },
    { match: "*", behavior: "ask" }
  ],
  channels: ["chat"], schedules: [],
};
function spec() {
  return { id: "ship-buap", title: "Ship verified change",
    budget: { max_tokens: 5000, max_cost_cents: 30, max_parallel: 2 },
    steps: [
      { id: "inspect", title: "Inspect", action: "repo.read",
        capabilities: ["github"], depends_on: [], checks: ["repo-scanned"],
        estimated_tokens: 2000, estimated_cost_cents: 10 },
      { id: "verify", title: "Verify", action: "repo.read",
        capabilities: ["github"], depends_on: ["inspect"], checks: ["tests-pass", "source-cited"],
        estimated_tokens: 3000, estimated_cost_cents: 20 },
    ],
  };
}
function make() {
  const runtime = new AgentProfileRuntime(profile);
  const mission = new MissionControl(runtime, spec());
  return { runtime, mission };
}
const checked = (names) => names.map(name => ({
  name, status: "pass", evidence_ref: "test-run:" + name,
}));

test("accepts bounded DAGs but rejects duplicates, unknown dependency and cycles", () => {
  assert.equal(validateMission(spec()), true);
  const unknown = spec(); unknown.steps[1].depends_on = ["nope"];
  assert.throws(() => validateMission(unknown), /unknown mission dependency/);
  const cyclic = spec(); cyclic.steps[0].depends_on = ["verify"];
  assert.throws(() => validateMission(cyclic), /cycle/);
  const dup = spec(); dup.steps[1].id = "inspect";
  assert.throws(() => validateMission(dup), /duplicate/);
});

test("allows only connected capabilities, never claims the host has tools", () => {
  const { runtime, mission } = make();
  assert.deepEqual(mission.ready(), ["inspect"]);
  assert.deepEqual(mission.begin("inspect").missing, ["github"]);
  assert.equal(runtime.snapshot().tasks.length, 0);
  runtime.bindCapability("github", { evidence_ref: "connector:github:verified" });
  assert.equal(mission.begin("inspect").started, true);
  assert.equal(mission.status("inspect"), "in_progress");
  assert.equal(mission.begin("inspect").decision, "already_claimed");
});

test("requires passing named checks with receipts before dependency unlock", () => {
  const { runtime, mission } = make();
  runtime.bindCapability("github", { evidence_ref: "connector:github" });
  mission.begin("inspect");
  assert.deepEqual(mission.ready(), []);
  assert.throws(() => mission.complete("inspect", {
    result_ref: "pr:1", checks: [{ name: "repo-scanned", status: "unverified", evidence_ref: "report:1" }],
    usage: { tokens: 100, cost_cents: 1 },
  }), /passing named checks/);
  assert.equal(mission.status("inspect"), "in_progress");
  const receipt = mission.complete("inspect", {
    result_ref: "pr:1", checks: checked(["repo-scanned"]),
    usage: { tokens: 1000, cost_cents: 8 }, sources: ["github:main"],
  });
  assert.equal(receipt.result_ref, "pr:1");
  assert.deepEqual(mission.ready(), ["verify"]);
  assert.deepEqual(mission.remainingBudget(), { tokens: 4000, cost_cents: 22 });
  assert.equal(mission.begin("verify").started, true);
  mission.complete("verify", {
    result_ref: "ci:42", checks: checked(["tests-pass", "source-cited"]),
    usage: { tokens: 2900, cost_cents: 18 },
  });
  assert.deepEqual(mission.ready(), []);
  assert.deepEqual(mission.report().receipts, ["inspect", "verify"]);
});

test("enforces mission budget reservations even before usage is reconciled", () => {
  const manifest = spec();
  manifest.steps[1].depends_on = [];
  const { runtime, mission } = (() => {
    const runtime = new AgentProfileRuntime(profile);
    return { runtime, mission: new MissionControl(runtime, manifest) };
  })();
  runtime.bindCapability("github", { evidence_ref: "connector:github" });
  assert.equal(mission.begin("inspect").started, true);
  assert.deepEqual(mission.remainingBudget(), { tokens: 3000, cost_cents: 20 });
  assert.equal(mission.begin("verify").started, true);
  assert.deepEqual(mission.remainingBudget(), { tokens: 0, cost_cents: 0 });
});

test("denies unknown or unsanctioned write and high-risk actions", () => {
  const { runtime, mission } = make();
  runtime.bindCapability("github", { evidence_ref: "connector:github" });
  assert.deepEqual(inspectToolAction(runtime, { action: "repo.read", capability: "web" }),
    { decision: "deny", reason: "capability_not_verified" });
  assert.deepEqual(inspectToolAction(runtime, { action: "repo.read", capability: "payments" }),
    { decision: "deny", reason: "capability_denied" });
  assert.equal(inspectToolAction(runtime, { action: "repo.read", capability: "github" }).decision, "allow");
  assert.equal(inspectToolAction(runtime, { action: "repo.read", capability: "github", sideEffect: true }).decision, "ask");
  assert.equal(inspectToolAction(runtime, { action: "repo.read", capability: "github", untrustedSource: true }).decision, "ask");
  assert.equal(inspectToolAction(runtime, { action: "repo.write", capability: "github" }).decision, "ask");
  assert.equal(mission.begin("verify").decision, "waiting_dependencies");
});

test("failure releases reservation and leaves dependents pending", () => {
  const { runtime, mission } = make();
  runtime.bindCapability("github", { evidence_ref: "connector:github" });
  mission.begin("inspect");
  mission.fail("inspect", { reason: "test_failure" });
  assert.equal(mission.status("inspect"), "failed");
  assert.deepEqual(mission.ready(), []);
  assert.deepEqual(mission.remainingBudget(), { tokens: 5000, cost_cents: 30 });
});

test("mission remains inert while runtime is paused", () => {
  const { runtime, mission } = make();
  runtime.bindCapability("github", { evidence_ref: "connector:github" });
  runtime.pause();
  assert.equal(mission.begin("inspect").decision, "paused");
  assert.equal(mission.status("inspect"), "queued");
  runtime.resume();
  assert.equal(mission.begin("inspect").started, true);
});

test("resume requires matching runtime and verifies event hash chain", () => {
  const { runtime, mission } = make();
  runtime.bindCapability("github", { evidence_ref: "connector:github" });
  mission.begin("inspect");
  const runtimeCopy = new AgentProfileRuntime(profile, runtime.snapshot());
  const resumed = new MissionControl(runtimeCopy, spec(), mission.snapshot());
  assert.equal(resumed.status("inspect"), "in_progress");
  assert.deepEqual(resumed.remainingBudget(), { tokens: 3000, cost_cents: 20 });
  const mutated = mission.snapshot();
  mutated.audit[0].payload.budget.tokens = 999;
  assert.throws(() => new MissionControl(runtimeCopy, spec(), mutated), /integrity|checksum/);
  const wrong = spec(); wrong.title = "Changed mission";
  assert.throws(() => new MissionControl(runtimeCopy, wrong, mission.snapshot()), /provenance mismatch/);
});

test("portable handoff carries scope, provenance, budget and policy without impersonating A2A", () => {
  const { runtime } = make();
  const handoff = createHandoff(runtime, spec(), "inspect", {
    scope: "read repo and inspect tests", requestId: "human-001", sources: ["github:abc"],
  });
  assert.equal(handoff.schema, "prismtek-agent-handoff-v1");
  assert.equal(handoff.transport, "host_managed");
  assert.deepEqual(handoff.required_checks, ["repo-scanned"]);
  assert.equal(handoff.authorization.decision, "allow");
  assert.throws(() => createHandoff(runtime, spec(), "inspect", { scope: "read", requestId: "id", sources: ["", "x"] }), /invalid/);
});

test("two missions with the same local step IDs remain isolated in one Agent Profile", () => {
  const runtime = new AgentProfileRuntime(profile);
  runtime.bindCapability("github", { evidence_ref: "connector:github" });
  const first = new MissionControl(runtime, spec());
  const otherSpec = spec(); otherSpec.id = "upgrade-hermes";
  const second = new MissionControl(runtime, otherSpec);
  assert.equal(first.begin("inspect").started, true);
  assert.equal(second.begin("inspect").started, true);
  const keys = runtime.snapshot().tasks.map(t => t.id).sort();
  assert.deepEqual(keys, ["ship-buap--inspect", "upgrade-hermes--inspect"]);
  first.complete("inspect", { result_ref: "ci:first", checks: checked(["repo-scanned"]),
    usage: { tokens: 1500, cost_cents: 4 } });
  assert.equal(first.status("inspect"), "completed");
  assert.equal(second.status("inspect"), "in_progress");
});
test("snapshot checksum covers receipts and measured usage, not just audit entries", () => {
  const { runtime, mission } = make();
  runtime.bindCapability("github", { evidence_ref: "connector:github" });
  mission.begin("inspect");
  mission.complete("inspect", { result_ref: "ci:1", checks: checked(["repo-scanned"]),
    usage: { tokens: 200, cost_cents: 1 } });
  const snap = mission.snapshot();
  snap.receipts.inspect.result_ref = "forged";
  assert.throws(() => new MissionControl(new AgentProfileRuntime(profile, runtime.snapshot()), spec(), snap), /checksum/);
});
