import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkProject, compileProject, writeProject } from "../src/index.mjs";
import { resolveModuleGraph } from "../src/graph.mjs";
import { findSecretLikeStrings, mergePermissions } from "../src/validate.mjs";

const exampleConfig = new URL("../examples/repository/buap.config.json", import.meta.url).pathname;

test("compiles deterministic repository outputs", async () => {
  const first = await compileProject(exampleConfig);
  const second = await compileProject(exampleConfig);
  assert.equal(first.sourceHash, second.sourceHash);
  assert.deepEqual([...first.outputs], [...second.outputs]);
  assert.match(first.outputs.get("AGENTS.md"), /Workspace writes are allowed/);
  assert.match(first.outputs.get(".buddy\/policy.yaml"), /default_profile: coding/);
});

test("build then check reports no drift", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "buap-test-"));
  const sourceRoot = path.dirname(exampleConfig);
  await fs.cp(sourceRoot, temp, { recursive: true });
  const configPath = path.join(temp, "buap.config.json");
  await writeProject(configPath);
  const checked = await checkProject(configPath);
  assert.deepEqual(checked.drift, []);
  await fs.appendFile(path.join(temp, "generated", "AGENTS.md"), "manual edit\n");
  const drifted = await checkProject(configPath);
  assert.deepEqual(drifted.drift, [{ path: "AGENTS.md", reason: "changed" }]);
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
