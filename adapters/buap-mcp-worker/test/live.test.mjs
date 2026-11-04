import test from "node:test";
import assert from "node:assert/strict";
import worker, { handleBuapMessage, remoteToolDefinitions } from "../index.mjs";

const token = "local-testing-token-with-no-production-access";
const env = { BUAP_MCP_TOKEN: token, BUAP_GITHUB_REPOS: "codysumpter-cloud/buddy-universal-agent-profile" };
const repo = "codysumpter-cloud/buddy-universal-agent-profile";
const sha = "a".repeat(40);
const rpc = (id, name, args) => ({ jsonrpc: "2.0", id, method: "tools/call",
  params: { name, arguments: args } });
function parse(message) {
  assert.equal(message?.result?.isError, false, JSON.stringify(message?.error || message?.result));
  return JSON.parse(message.result.content[0].text);
}
function mockAPI({ checkStatus = "success", checkCount = 1, mergeable = true, prState = "open", merged = false } = {}) {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, method: init.method, redirect: init.redirect });
    if (url.endsWith("/pulls/7/files?per_page=50")) return Response.json([{ filename: "src/index.mjs" }]);
    if (url.endsWith("/pulls/7")) return Response.json({
      number: 7, state: prState, merged, mergeable, head: { sha }, base: { sha: "b".repeat(40) },
      html_url: "https://github.com/" + repo + "/pull/7", changed_files: 1,
    });
    if (url.includes("/check-runs?")) return Response.json({
      total_count: checkCount,
      check_runs: checkCount === 0 ? [] : [{
        name: "Conformance", status: checkStatus === "pending" ? "in_progress" : "completed",
        conclusion: checkStatus === "pending" ? null : checkStatus,
        html_url: "https://github.com/" + repo + "/actions/runs/123",
      }],
    });
    if (url.endsWith("/repos/" + repo)) return Response.json({
      full_name: repo, archived: false, private: false, default_branch: "main",
      html_url: "https://github.com/" + repo,
    });
    return Response.json({ message: "not found" }, { status: 404 });
  };
  return { fetchImpl, seen };
}

test("BUAP advertises exactly two additional read-only live tools", async () => {
  const names = remoteToolDefinitions().map(x => x.name);
  assert.equal(names.length, 5);
  for (const n of ["buap_github_probe", "buap_pr_gate"]) {
    assert(names.includes(n));
    assert.equal(remoteToolDefinitions().find(x => x.name === n).annotations.readOnlyHint, true);
  }
  const list = await handleBuapMessage({ jsonrpc: "2.0", method: "tools/list", id: 1 }, env);
  assert(list.result.tools.some(t => t.name === "buap_pr_gate"));
  assert(!list.result.tools.some(t => t.name === "buap_github_create_pr"));
  const self = parse(await handleBuapMessage(rpc(2, "buap_self_test", {}), env));
  assert.equal(self.tool_count, 11);
  assert.equal(self.github_live_access, "not-tested-by-self-test");
});

test("live GitHub probe returns request-backed evidence, not a configured flag", async () => {
  const mock = mockAPI();
  const data = parse(await handleBuapMessage(rpc(7, "buap_github_probe", { repo }), env, mock.fetchImpl));
  assert.equal(data.repo, repo);
  assert.equal(data.connection, "live_github_request_succeeded");
  assert.equal(data.source_url, "https://github.com/" + repo);
  assert.equal(data.write_tools_enabled, false);
  assert.match(data.checked_at, /^20\d\d-/);
  assert.equal(mock.seen.length, 1);
  assert.equal(mock.seen[0].method, "GET");
  assert.equal(mock.seen[0].redirect, "error");
});

test("live probe enforces repository allowlist, strict arguments, and no network on rejection", async () => {
  const mock = mockAPI();
  const denied = await handleBuapMessage(rpc(8, "buap_github_probe", { repo: "example/private" }), env, mock.fetchImpl);
  assert.equal(denied.result.isError, true);
  const bad = await handleBuapMessage(rpc(9, "buap_github_probe", { repo, extra: true }), env, mock.fetchImpl);
  assert.equal(bad.error.code, -32602);
  const missing = await handleBuapMessage(rpc(10, "buap_pr_gate", { repo }), env, mock.fetchImpl);
  assert.equal(missing.error.code, -32602);
  assert.equal(mock.seen.length, 0);
});

test("PR gate inspects real PR metadata and GitHub checks but never grants merge permission", async () => {
  const mock = mockAPI();
  const data = parse(await handleBuapMessage(rpc(11, "buap_pr_gate", { repo, number: 7 }), env, mock.fetchImpl));
  assert.equal(data.kind, "live_github_pr_readiness");
  assert.equal(data.head_sha, sha);
  assert.equal(data.checks.total, 1);
  assert.equal(data.checks.all_reported_checks_pass, true);
  assert.equal(data.preliminary_review_ready, true);
  assert.equal(data.release_authorized, false);
  assert(data.independently_unverified.includes("required_reviews"));
  assert(data.independently_unverified.includes("deployment"));
  assert.equal(mock.seen.length, 3);
  assert(mock.seen.every(v => v.method === "GET"));
});

test("PR gate fails closed for failed, pending, missing or truncated checks and unresolved merges", async () => {
  for (const config of [
    { checkStatus: "failure" }, { checkStatus: "pending" }, { checkCount: 0 },
    { checkCount: 54 }, { mergeable: null }, { merged: true }, { prState: "closed" },
  ]) {
    const mock = mockAPI(config);
    const data = parse(await handleBuapMessage(rpc(12, "buap_pr_gate", { repo, number: 7 }), env, mock.fetchImpl));
    assert.equal(data.preliminary_review_ready, false, JSON.stringify(config));
    assert.equal(data.release_authorized, false);
  }
});

test("PR API errors never produce a passing receipt", async () => {
  const denied = await handleBuapMessage(rpc(13, "buap_pr_gate", { repo, number: 7 }), env,
    async () => Response.json({ token: "private-secret" }, { status: 403 }));
  assert.equal(denied.result.isError, true);
  assert(!JSON.stringify(denied).includes("private-secret"));
});

test("oversized streamed Unicode requests are rejected without content-length", async () => {
  const payload = new TextEncoder().encode("😀".repeat(20000));
  const request = new Request("https://buap-mcp.prismtek.dev/mcp", {
    method: "POST", duplex: "half",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: new ReadableStream({ start(ctrl) { ctrl.enqueue(payload); ctrl.close(); } }),
  });
  assert.equal(request.headers.get("content-length"), null);
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "payload_too_large" });
});
