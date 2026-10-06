import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkProject, compileProject, writeProject } from "../src/index.mjs";
import { resolveModuleGraph } from "../src/graph.mjs";
import { findSecretLikeStrings, mergePermissions } from "../src/validate.mjs";

const exampleConfig = new URL("../examples/repository/buap.config.json", import.meta.url).pathname;
const godotSkillPath = ".github/skills/godot-review/SKILL.md";

async function copiedExample() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "buap-test-"));
  const sourceRoot = path.dirname(exampleConfig);
  await fs.cp(sourceRoot, temp, { recursive: true });
  return { temp, configPath: path.join(temp, "buap.config.json") };
}

test("compiles deterministic repository outputs", async () => {
  const first = await compileProject(exampleConfig);
  const second = await compileProject(exampleConfig);
  assert.equal(first.sourceHash, second.sourceHash);
  assert.deepEqual([...first.outputs], [...second.outputs]);
  assert.match(first.outputs.get("AGENTS.md"), /Workspace writes are allowed/);
  assert.match(first.outputs.get(".buddy\/policy.yaml"), /default_profile: coding/);
});

test("emits narrow GitHub skills with valid frontmatter and provenance", async () => {
  const compiled = await compileProject(exampleConfig);
  const skill = compiled.outputs.get(godotSkillPath);
  assert.ok(skill);
  assert.match(skill, /^---\nname: godot-review\ndescription: ".+"\n---\n/);
  assert.match(skill, new RegExp(`source-sha256=${compiled.sourceHash}`));
  assert.match(skill, /Review the Godot change as rendered behavior/);
  assert.doesNotMatch(skill, /Operate as Buddy for/);
  assert.doesNotMatch(skill, /React changes in a real browser/);

  const manifest = JSON.parse(compiled.outputs.get(".buddy/manifest.json"));
  assert.equal(manifest.compiler, "@prismtek/buap-compiler@0.4.0");
  assert.ok(manifest.files[godotSkillPath].sha256);
  assert.ok(manifest.files[godotSkillPath].estimated_tokens > 0);
});

test("refuses unsafe or unbound GitHub skill definitions", async () => {
  const unsafe = await copiedExample();
  const unsafeConfig = JSON.parse(await fs.readFile(unsafe.configPath, "utf8"));
  unsafeConfig.githubSkills[0].name = "../escape";
  await fs.writeFile(unsafe.configPath, `${JSON.stringify(unsafeConfig, null, 2)}\n`);
  await assert.rejects(() => compileProject(unsafe.configPath), /lowercase kebab-case/);

  const missing = await copiedExample();
  const missingConfig = JSON.parse(await fs.readFile(missing.configPath, "utf8"));
  missingConfig.githubSkills = [{
    name: "missing-review",
    description: "A valid description without a matching canonical section.",
    profile: "review",
  }];
  await fs.writeFile(missing.configPath, `${JSON.stringify(missingConfig, null, 2)}\n`);
  await assert.rejects(() => compileProject(missing.configPath), /has no canonical sections/);
});

test("compiles first-class agent profiles with policy provenance", async () => {
  const { configPath } = await copiedExample();
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  config.agentProfiles = [{
    id: "atlas",
    displayName: "Atlas",
    nameSource: "self",
    relationshipRole: "buddy",
    kind: "primary",
    policyProfile: "coding",
    mission: "Steward repository work for the user.",
    goals: ["Keep work moving"],
    responsibilities: ["Plan", "Execute", "Verify"],
    memory: {
      namespace: "agents/atlas",
      shared_context: ["repository"],
      write_scopes: ["agents/atlas"],
      proactive_learning: true,
      life_profile_ref: ".buddy/life-profile.json"
    },
    execution: {
      preferred_targets: ["ide", "local_computer"],
      background_allowed: true,
      max_concurrent_tasks: 2
    },
    capabilities: {
      required: ["read"],
      optional: ["write", "test"],
      denied: ["release"]
    },
    autonomy: {
      proactive_research: true,
      create_tasks: true,
      schedule_tasks: true
    },
    actionRules: [
      { match: "repo.read", behavior: "allow" },
      { match: "repo.write", behavior: "preapproved" },
      { match: "*", behavior: "ask" }
    ],
    channels: ["chat", "ide"],
    schedules: []
  }];
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

  const compiled = await compileProject(configPath);
  const profile = JSON.parse(compiled.outputs.get(".buddy/agents/atlas/profile.json"));
  const index = JSON.parse(compiled.outputs.get(".buddy/agents/index.json"));

  assert.equal(profile.schema, "prismtek-agent-profile-v1");
  assert.equal(profile.display_name, "Atlas");
  assert.equal(profile.policy_profile, "coding");
  assert.equal(profile.policy_permissions.filesystem, "workspace-write");
  assert.equal(profile.memory.life_profile_ref, ".buddy/life-profile.json");
  assert.equal(index.agents[0].id, "atlas");
  assert.equal(index.agents[0].path, ".buddy/agents/atlas/profile.json");
  assert.ok(index.agents[0].profile_sha256);
});

test("build then check reports no drift", async () => {
  const { temp, configPath } = await copiedExample();
  await writeProject(configPath);
  const checked = await checkProject(configPath);
  assert.deepEqual(checked.drift, []);
  await fs.appendFile(path.join(temp, "generated", "AGENTS.md"), "manual edit\n");
  await fs.appendFile(path.join(temp, "generated", godotSkillPath), "manual skill edit\n");
  const drifted = await checkProject(configPath);
  assert.deepEqual(drifted.drift, [
    { path: "AGENTS.md", reason: "changed" },
    { path: godotSkillPath, reason: "changed" },
  ]);
});

test("detects cycles and missing modules", () => {
  const modules = new Map([
    ["a", { id: "a", imports: ["b"] }],
    ["b", { id: "b", imports: ["a"] }],
  ]);
  assert.throws(() => resolveModuleGraph(["a"], modules), /cyclic module dependency/);
  assert.throws(() => resolveModuleGraph(["missing"], modules), /missing imported module/);
});

test("requires explicit permission overrides", () => {
  assert.throws(() => mergePermissions([
    { id: "base", permissions: { network: "none" } },
    { id: "coding", permissions: { network: "allowlist" } },
  ]), /conflicting permission/);
  assert.deepEqual(mergePermissions([
    { id: "base", permissions: { network: "none" } },
    { id: "coding", permissions: { network: "allowlist" }, overrides: ["permissions.network"] },
  ]), { network: "allowlist" });
});

test("detects secret-like strings", () => {
  assert.equal(findSecretLikeStrings({ safe: "hello" }).length, 0);
  assert.equal(findSecretLikeStrings({ api_key: "sk-proj-abcdefghijklmnopqrstuvwxyz" }).length, 1);
});
