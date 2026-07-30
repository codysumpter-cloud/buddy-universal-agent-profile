import assert from "node:assert/strict";
import test from "node:test";
import { compileProject } from "../src/index.mjs";

const exampleConfig = new URL("../examples/repository/buap.config.json", import.meta.url).pathname;

test("emits a manifest-bound agent life profile", async () => {
  const compiled = await compileProject(exampleConfig);
  const content = compiled.outputs.get(".buddy/life-profile.json");
  assert.ok(content, "life profile output exists");
  const profile = JSON.parse(content);
  assert.equal(profile.schema, "prismtek-agent-life-profile-v1");
  assert.equal(profile.source_sha256, compiled.sourceHash);
  assert.equal(profile.constitution.immutable, true);
  assert.equal(profile.constitution.learned_state_may_not_expand_permissions, true);
  assert.deepEqual(profile.reinforcement.allowed_authorities, ["human", "host", "verifier"]);
});
