import assert from "node:assert/strict";
import test from "node:test";
import { AgentProfileRuntime } from "../../buap-agent-profile/src/index.mjs";
import { MissionControl } from "./index.mjs";
import {
  inspectMission, captureMissionCheckpoint, verifyMissionCheckpoint, renderMissionReport,
} from "./doctor.mjs";

const profile = {
  schema: "prismtek-agent-profile-v1", id: "portable-agent",
  display_name: "Example Agent", relationship_role: "buddy", kind: "primary",
  mission: "Deliver validated changes", goals: ["Complete work"], responsibilities: ["Plan", "Verify"],
  identity: { name_source: "self" },
  memory: { namespace: "agents/example", shared_context: [], write_scopes: [], proactive_learning: false },
  execution: { preferred_targets: ["chat"], background_allowed: false, max_concurrent_tasks: 2 },
  capabilities: { required: [], optional: ["source"], denied: ["payments"] },
  autonomy: { proactive_research: false, create_tasks: false, schedule_tasks: false },
  action_rules: [
    { match: "repo.read", behavior: "allow" },
    { match: "repo.write", behavior: "ask" },
    { match: "*", behavior: "deny" },
  ],
  channels: ["chat"], schedules: [],
};
const spec = () => ({
  id: "portable-workflow", title: "Portable build/test",
  budget: { max_tokens: 4000, max_cost_cents: 25, max_parallel: 1 },
  steps: [
    { id: "research", title: "Read source", action: "repo.read",
      depends_on: [], capabilities: ["source"], checks: ["source-verified"],
      estimated_tokens: 1000, estimated_cost_cents: 5 },
    { id: "publish", title: "Publish changes", action: "repo.write",
      depends_on: ["research"], capabilities: ["source"], checks: ["checks-pass"],
      estimated_tokens: 3000, estimated_cost_cents: 20 },
  ],
});
function make() {
  const agent = new AgentProfileRuntime(profile);
  return { agent, mission: new MissionControl(agent, spec()) };
}

test("doctor reports missing capability without modifying task or mission state", () => {
  const { agent, mission } = make();
  const before = JSON.stringify([agent.snapshot(), mission.snapshot()]);
  const report = inspectMission(mission);
  assert.equal(report.health, "blocked");
  assert.deepEqual(report.ready, []);
  assert(report.steps[0].blockers.some(b => b.code === "missing_capability"));
  assert(report.steps[1].blockers.some(b => b.code === "approval_required"));
  assert.equal(report.critical_path_depth, 2);
  assert.equal(JSON.stringify([agent.snapshot(), mission.snapshot()]), before);
});

test("doctor distinguishes ready work, active work and approval requests", () => {
  const { agent, mission } = make();
  agent.bindCapability("source", { evidence_ref: "host:verified" });
  const initial = inspectMission(mission);
  assert.deepEqual(initial.ready, ["research"]);
  assert.equal(initial.health, "approval_pending"); // Future steps may require approval.
  assert.equal(mission.begin("research").started, true);
  const active = inspectMission(mission);
  assert.deepEqual(active.requires_reconciliation, ["research"]);
  assert.equal(active.health, "reconcile");
  assert.deepEqual(active.ready, []);
  mission.complete("research", { result_ref: "commit:abc",
    checks: [{ name: "source-verified", status: "pass", evidence_ref: "test:read" }],
    usage: { tokens: 500, cost_cents: 2 } });
  const blocked = inspectMission(mission);
  assert.deepEqual(blocked.pending_approvals, ["publish"]);
  assert.equal(blocked.health, "approval_pending");
});

test("paired checkpoints restore with matching profiles and missions", () => {
  const { agent, mission } = make();
  agent.bindCapability("source", { evidence_ref: "host:verified" });
  mission.begin("research");
  const checkpoint = captureMissionCheckpoint(mission, { revision: 7 });
  const checked = verifyMissionCheckpoint(checkpoint, {
    minimumRevision: 7, profileHash: agent.profileHash,
    missionHash: mission.manifestHash,
  });
  const restoredAgent = new AgentProfileRuntime(profile, checked.agent);
  const restoredMission = new MissionControl(restoredAgent, spec(), checked.mission);
  assert.equal(restoredMission.status("research"), "in_progress");
  assert.deepEqual(inspectMission(restoredMission).requires_reconciliation, ["research"]);
});

test("checkpoint catches corruption, replay to earlier revision and wrong provenance", () => {
  const { agent, mission } = make();
  let checkpoint = captureMissionCheckpoint(mission, { revision: 4 });
  checkpoint.agent.agent_id = "injected";
  assert.throws(() => verifyMissionCheckpoint(checkpoint), /checksum/);
  checkpoint = captureMissionCheckpoint(mission, { revision: 4 });
  assert.throws(() => verifyMissionCheckpoint(checkpoint, { minimumRevision: 5 }), /revision/);
  assert.throws(() => verifyMissionCheckpoint(checkpoint, { profileHash: "f".repeat(64) }), /provenance/);
  assert.throws(() => captureMissionCheckpoint(mission, { revision: -1 }), /revision/);
});

test("diagnostics surface actual usage overruns and paused states", () => {
  const { agent, mission } = make();
  agent.bindCapability("source", { evidence_ref: "host:verified" });
  agent.pause();
  assert.equal(inspectMission(mission).health, "paused");
  agent.resume();
  mission.begin("research");
  mission.complete("research", { result_ref: "receipt:test",
    checks: [{ name: "source-verified", status: "pass", evidence_ref: "ci:42" }],
    usage: { tokens: 5000, cost_cents: 40 } });
  const report = inspectMission(mission);
  assert.equal(report.health, "needs_attention");
  assert(report.discrepancies.some(d => d.code === "actual_usage_over_budget"));
});

test("markdown report has safe readable status without raw untrusted HTML", () => {
  const { mission } = make();
  const report = inspectMission(mission);
  report.steps[0].id = "<script>bad</script>";
  const markdown = renderMissionReport(report);
  assert(markdown.includes("Mission portable-workflow"));
  assert(!markdown.includes("<script>"));
  assert(markdown.includes("\\<script\\>"));
});
