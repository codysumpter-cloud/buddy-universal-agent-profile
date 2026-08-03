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
