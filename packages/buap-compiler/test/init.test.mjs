import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { doctorProject, initProject } from "../src/index.mjs";

async function temporaryProject(name = "example-project") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "buap-init-"));
  await fs.writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify({ name, scripts: { test: "node --test" } }, null, 2)}\n`,
  );
  return root;
}

test("initializes a repository into deterministic root policy", async () => {
  const root = await temporaryProject("hello-buddy");
  const result = await initProject(root);
  assert.equal(result.projectName, "hello-buddy");
  assert.equal(result.outputCount, 9);
  assert.equal(result.overwritten.length, 0);

  for (const relative of [
    "buap.config.json",
    ".buap/install.json",
    ".buap/modules/base.json",
    ".buap/modules/coding.json",
    ".buap/modules/review.json",
    ".buap/modules/release.json",
    "AGENTS.md",
    "REVIEW.md",
    ".buddy/policy.yaml",
    ".buddy/manifest.json",
    ".buddy/life-profile.json",
  ]) {
    const stat = await fs.stat(path.join(root, relative));
    assert.ok(stat.isFile(), `${relative} should exist`);
  }

  const agents = await fs.readFile(path.join(root, "AGENTS.md"), "utf8");
  assert.match(agents, /hello-buddy/);
  assert.match(agents, /human-approved/);

  const install = JSON.parse(await fs.readFile(path.join(root, ".buap/install.json"), "utf8"));
  assert.equal(install.schema, "buap.install.v1");
  assert.equal(install.compilerVersion, "0.2.0");
  assert.equal(install.sourceHash, result.sourceHash);
});

test("doctor passes a clean install and reports optional runtime separately", async () => {
  const root = await temporaryProject();
  await initProject(root);
  const report = await doctorProject(root);
  assert.equal(report.ok, true);
  assert.equal(report.checks.find((item) => item.name === "generated-drift")?.ok, true);
  assert.equal(report.checks.find((item) => item.name === "buddy-mcp")?.required, false);
});

test("doctor fails generated drift", async () => {
  const root = await temporaryProject();
  await initProject(root);
  await fs.appendFile(path.join(root, "AGENTS.md"), "manual drift\n");
  const report = await doctorProject(root);
  assert.equal(report.ok, false);
  const drift = report.checks.find((item) => item.name === "generated-drift");
  assert.equal(drift?.ok, false);
  assert.match(drift?.detail ?? "", /AGENTS\.md:changed/);
});

test("init refuses managed-file collisions unless force is explicit", async () => {
  const root = await temporaryProject();
  await fs.writeFile(path.join(root, "AGENTS.md"), "existing instructions\n");
  await assert.rejects(() => initProject(root), /refusing to overwrite/);

  const result = await initProject(root, { force: true });
  assert.deepEqual(result.overwritten, ["AGENTS.md"]);
  assert.doesNotMatch(await fs.readFile(path.join(root, "AGENTS.md"), "utf8"), /existing instructions/);
});
