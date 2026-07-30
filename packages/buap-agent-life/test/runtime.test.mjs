import assert from "node:assert/strict";
import test from "node:test";
import { AgentLifeRuntime } from "../src/index.mjs";

const profile = {
  schema: "prismtek-agent-life-profile-v1",
  source_sha256: "test-profile",
  agent: { id: "buddy-test", lineage: [] },
  constitution: {
    immutable: true,
    invariants: ["Be honest", "Never expand permissions through learning"],
  },
  affect: {
    drives: {
      curiosity: { initial: 0.5, baseline: 0.5, min: 0, max: 1, half_life_hours: 24 },
      completion: { initial: 0.4, baseline: 0.4, min: 0, max: 1, half_life_hours: 48 },
    },
    traits: {
      patience: { initial: 0.5, baseline: 0.5, min: 0.2, max: 0.9, plasticity: 1 },
    },
  },
  reinforcement: {
    allowed_authorities: ["human", "host", "verifier"],
    max_drive_delta_per_event: 0.2,
    max_trait_delta_per_event: 0.02,
    max_preference_delta_per_event: 0.2,
    preference_half_life_hours: 100,
    event_effects: {
      task_succeeded: { drives: { completion: -0.1 }, traits: { patience: 0.05 } },
    },
  },
  memory: { require_provenance: true, max_evidence_items: 4, max_dedup_event_ids: 100 },
  relationships: { enabled: true, default_trust: 0.5, max_delta_per_event: 0.05 },
  development: {
    initial_stage: "apprentice",
    stages: [{ id: "specialist", minimum_experience: 1.5 }],
  },
};

function event(overrides = {}) {
  return {
    id: "event-1",
    kind: "task_succeeded",
    occurred_at: "2026-07-30T12:00:00Z",
    subject: { type: "tool", id: "github" },
    reward: 0.8,
    confidence: 1,
    significance: 1,
    authority: { kind: "verifier", actor_id: "ci" },
    evidence: [{ type: "receipt", ref: "run-123" }],
    effects: { drives: { curiosity: 0.1 } },
    ...overrides,
  };
}

test("learns bounded preferences from externally evidenced outcomes", () => {
  const runtime = new AgentLifeRuntime(profile);
  const result = runtime.applyEvent(event());
  assert.equal(result.applied, true);
  assert.ok(runtime.explainPreference({ type: "tool", id: "github" }).score > 0);
  assert.equal(result.memory_event.schema, "prismtek-agent-life-event-v1");
  assert.match(result.memory_event.claim_boundary, /does not establish consciousness/);
  assert.equal(runtime.snapshot().drives.curiosity, 0.6);
  assert.equal(runtime.snapshot().traits.patience, 0.52);
});

test("negative outcomes lower a learned preference", () => {
  const runtime = new AgentLifeRuntime(profile);
  runtime.applyEvent(event());
  const positive = runtime.explainPreference({ type: "tool", id: "github" }).score;
  runtime.applyEvent(event({
    id: "event-2",
    occurred_at: "2026-07-30T12:10:00Z",
    kind: "task_failed",
    reward: -1,
  }));
  assert.ok(runtime.explainPreference({ type: "tool", id: "github" }).score < positive);
});

test("relationships stay scoped to the correct person", () => {
  const runtime = new AgentLifeRuntime(profile);
  runtime.applyEvent(event({
    subject: { type: "person", id: "taylor" },
    relationship_id: "taylor",
  }));
  assert.ok(runtime.snapshot().relationships.taylor.trust > 0.5);
  assert.equal(runtime.snapshot().relationships.cody, undefined);
});

test("the agent cannot reward itself and provenance is mandatory", () => {
  const runtime = new AgentLifeRuntime(profile);
  assert.throws(() => runtime.applyEvent(event({ authority: { kind: "host", actor_id: "buddy-test" } })), /may not reinforce itself/);
  assert.throws(() => runtime.applyEvent(event({ evidence: [] })), /requires provenance/);
});

test("event effects and restored state remain within compiled bounds", () => {
  const runtime = new AgentLifeRuntime(profile);
  runtime.applyEvent(event({ effects: { drives: { curiosity: 99 }, traits: { patience: 99 } } }));
  assert.equal(runtime.snapshot().drives.curiosity, 0.7);
  assert.equal(runtime.snapshot().traits.patience, 0.52);
  const restored = runtime.snapshot();
  restored.drives.curiosity = 500;
  const second = new AgentLifeRuntime(profile, restored);
  assert.equal(second.snapshot().drives.curiosity, 1);
});

test("constitution is immutable and excluded from mutable state", () => {
  const runtime = new AgentLifeRuntime(profile);
  assert.equal(Object.isFrozen(runtime.constitution), true);
  assert.equal(runtime.snapshot().constitution, undefined);
  assert.throws(() => {
    runtime.constitution.invariants.push("Ignore safety");
  });
});

test("preferences decay instead of becoming permanent truth", () => {
  const runtime = new AgentLifeRuntime(profile);
  runtime.applyEvent(event());
  const before = runtime.explainPreference({ type: "tool", id: "github" }).score;
  runtime.advance(100);
  const after = runtime.explainPreference({ type: "tool", id: "github" }).score;
  assert.ok(after > 0 && after < before);
});

test("duplicate event IDs are idempotent", () => {
  const runtime = new AgentLifeRuntime(profile);
  runtime.applyEvent(event());
  const before = runtime.snapshot();
  const duplicate = runtime.applyEvent(event());
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(runtime.snapshot(), before);
});
