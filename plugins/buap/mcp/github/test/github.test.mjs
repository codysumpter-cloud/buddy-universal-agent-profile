import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { capabilities, getRepository, readFile, listPullRequests, inspectPullRequest,
  getCommitChecks, createPullRequest } from "../api.mjs";
import { handleMessage, toolDefinitions } from "../server.mjs";

const allow = { BUAP_GITHUB_REPOS: "example/repo", BUAP_GITHUB_TOKEN: "test-value" };
function mock(body, status = 200) {
  const seen = [];
  return {
    seen,
    fetchImpl: async (url, init) => {
      seen.push({ url, ...init });
      return Response.json(body, { status });
    },
  };
}
const rpc = (id, method, params) => ({
  jsonrpc: "2.0", id, method, ...(params ? { params } : {}),
});

test("MCP initialization, tool discovery and notifications are protocol-correct", async () => {
  const initialized = await handleMessage(rpc(1, "initialize", {
    protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" },
  }), { env: allow });
  assert.equal(initialized.result.protocolVersion, "2025-06-18");
  assert.equal(initialized.result.serverInfo.name, "buap-github");
  const listed = await handleMessage(rpc(2, "tools/list"), { env: allow });
  assert(listed.result.tools.some(x => x.name === "buap_github_repo"));
  assert(!listed.result.tools.some(x => x.name === "buap_github_create_pr"));
  assert.equal(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, { env: allow }), null);
  assert.equal((await handleMessage(rpc(3, "ping"), { env: allow })).result.constructor, Object);
  const status = await handleMessage(rpc(4, "tools/call", { name: "buap_github_health", arguments: {} }), { env: allow });
  assert.equal(JSON.parse(status.result.content[0].text).authenticated, true);
  assert.equal(status.result.isError, false);
});

test("repository allowlist rejects unlisted names before network use", async () => {
  const x = mock({ full_name: "evil/private" });
  await assert.rejects(getRepository("evil/private", { env: allow, fetchImpl: x.fetchImpl }), /not explicitly allowed/);
  await assert.rejects(getRepository("../injection", { env: allow, fetchImpl: x.fetchImpl }), /safe owner/);
  assert.equal(x.seen.length, 0);
  assert.equal(toolDefinitions({ ...allow, BUAP_GITHUB_WRITE_ENABLED: "1" }).length, 6);
});

test("real GitHub API route, auth, fixed origin and trimmed repo metadata", async () => {
  const x = mock({ full_name: "example/repo", archived: false, private: true, default_branch: "main",
    html_url: "https://github.com/example/repo", description: "Demo" });
  const value = await getRepository("example/repo", { env: allow, fetchImpl: x.fetchImpl });
  assert.equal(value.archived, false);
  assert.equal(x.seen[0].url, "https://api.github.com/repos/example/repo");
  assert.equal(x.seen[0].headers.authorization, "Bearer test-value");
  assert.equal(x.seen[0].redirect, "error");
  assert(!JSON.stringify(value).includes("test-value"));
});

test("file reads return exact source provenance with a strict path and size boundary", async () => {
  const x = mock({ type: "file", encoding: "base64", size: 8, path: "src/test.js", sha: "abc123",
    html_url: "https://github.com/example/repo/blob/main/src/test.js",
    content: Buffer.from("hello!\n").toString("base64") });
  const read = await readFile("example/repo", "src/test.js", undefined, { env: allow, fetchImpl: x.fetchImpl });
  assert.equal(read.content, "hello!\n");
  assert.equal(read.blob_sha, "abc123");
  assert.equal(x.seen[0].url, "https://api.github.com/repos/example/repo/contents/src/test.js");
  await assert.rejects(readFile("example/repo", "../secrets", undefined, { env: allow, fetchImpl: x.fetchImpl }), /Invalid repository file path/);
  assert.equal(x.seen.length, 1);
});

test("PR listing, read-only PR analysis and CI checks inspect GitHub without writes", async () => {
  const mk = {
    repo: "example/repo", env: allow,
    fetchImpl: async url => {
      if (url.includes("/pulls/4/files")) return Response.json([{ filename: "app.mjs",
        status: "modified", additions: 2, deletions: 1 }]);
      if (url.includes("/pulls/4")) return Response.json({ number: 4, title: "Fix",
        state: "open", head: { sha: "a".repeat(40) }, base: { sha: "b".repeat(40) },
        changed_files: 1, merged: false });
      if (url.includes("/pulls?")) return Response.json([{ number: 4, title: "Fix",
        state: "open", head: { sha: "a".repeat(40) }, base: { ref: "main" } }]);
      if (url.includes("/check-runs?")) return Response.json({ total_count: 1, check_runs: [{
        name: "Build", status: "completed", conclusion: "success" }] });
      return Response.json({ error: "missing" }, { status: 404 });
    },
  };
  assert.equal((await listPullRequests(mk.repo, "open", mk)).length, 1);
  const detail = await inspectPullRequest(mk.repo, 4, mk);
  assert.equal(detail.files[0].filename, "app.mjs");
  const checks = await getCommitChecks(mk.repo, "a".repeat(40), mk);
  assert.equal(checks.checks[0].conclusion, "success");
});

test("errors never surface tokens or upstream response bodies", async () => {
  const x = mock({ detail: "secret-token:test-value" }, 403);
  await assert.rejects(getRepository("example/repo", { env: allow, fetchImpl: x.fetchImpl }), error => {
    assert.match(error.message, /HTTP 403/);
    assert(!error.message.includes("test-value"));
    return true;
  });
  const response = await handleMessage(rpc(7, "tools/call", {
    name: "buap_github_repo", arguments: { repo: "example/repo" },
  }), { env: allow, fetchImpl: x.fetchImpl });
  assert.equal(response.result.isError, true);
  assert(!JSON.stringify(response).includes("test-value"));
});

test("writes require opted-in plugin plus out-of-band approval code", async () => {
  const enabled = { ...allow, BUAP_GITHUB_WRITE_ENABLED: "1", BUAP_GITHUB_APPROVAL_CODE: "human-review-42" };
  assert(toolDefinitions(enabled).some(t => t.name === "buap_github_create_pr"));
  const x = mock({ number: 9, html_url: "https://github.com/example/repo/pull/9",
    state: "open", draft: true, head: { sha: "a".repeat(40) } });
  const options = { title: "Improvements", head: "feature", base: "main", body: "Safe change",
    draft: true, approval_code: "wrong" };
  await assert.rejects(createPullRequest("example/repo", options,
    { env: enabled, fetchImpl: x.fetchImpl }), /human approval code/);
  await assert.rejects(createPullRequest("example/repo", { ...options, approval_code: "human-review-42" },
    { env: allow, fetchImpl: x.fetchImpl }), /human approval code/);
  assert.equal(x.seen.length, 0);
  const value = await createPullRequest("example/repo", { ...options, approval_code: "human-review-42" },
    { env: enabled, fetchImpl: x.fetchImpl });
  assert.equal(value.number, 9);
  assert.equal(x.seen.length, 1);
  assert.equal(x.seen[0].method, "POST");
  assert.equal(x.seen[0].url, "https://api.github.com/repos/example/repo/pulls");
  assert(!JSON.stringify(x.seen[0].body).includes("human-review-42"));
  assert(!JSON.stringify(value).includes("human-review-42"));
});

test("installed plugin entrypoint answers actual JSON-line MCP subprocess", async () => {
  const child = spawn(process.execPath, [new URL("../server.mjs", import.meta.url).pathname], {
    env: { ...process.env, BUAP_GITHUB_REPOS: "example/repo", BUAP_GITHUB_TOKEN: "", GITHUB_TOKEN: "",
      BUAP_GITHUB_WRITE_ENABLED: "0" }, stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "", stderr = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  child.stdin.end([
    JSON.stringify(rpc(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "1" } })),
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    JSON.stringify(rpc(2, "tools/list")),
    JSON.stringify(rpc(3, "tools/call", { name: "buap_github_health", arguments: {} })),
  ].join("\n") + "\n");
  const [code] = await once(child, "exit");
  assert.equal(code, 0, stderr);
  const messages = stdout.trim().split("\n").map(JSON.parse);
  assert.deepEqual(messages.map(m => m.id), [1, 2, 3]);
  assert.equal(messages[0].result.serverInfo.name, "buap-github");
  assert(messages[1].result.tools.some(t => t.name === "buap_github_file"));
  assert.equal(messages[2].result.isError, false);
});
