import assert from "node:assert/strict";
import test from "node:test";
import { compileLifeProfile } from "../src/life-profile.mjs";

test("compiles a deterministic safe default life profile", () => {
  const profile = compileLifeProfile([], {}, "abc");
  assert.equal(profile.schema, "prismtek-agent-life-profile-v1");
  assert.equal(profile.constitution.immutable, true);
  assert.equal(profile.constitution.learned_state_may_not_expand_permissions, true);
  assert.deepEqual(profile.reinforcement.allowed_authorities, ["human", "host", "verifier"]);
});

test("merges module additions and requires explicit scalar overrides", () => {
  const profile = compileLifeProfile([
    { id: "base", life: { affect: { drives: { focus: { initial: 0.7, min: 0, max: 1 } } } } },
    { id: "repo", life: { agent: { id: "repo-buddy" } }, overrides: ["life.agent.id"] },
  ], {}, "abc");
  assert.equal(profile.agent.id, "repo-buddy");
  assert.equal(profile.affect.drives.focus.initial, 0.7);
  assert.deepEqual(profile.source_modules, ["base", "repo"]);

  assert.throws(() => compileLifeProfile([
    { id: "bad", life: { agent: { id: "other" } } },
  ], {}, "abc"), /explicit override/);
});
