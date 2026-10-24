import assert from "node:assert/strict";
import test from "node:test";
import { xerjConfig, validateXerjConfig, probeXerj, searchXerj, bindXerjSearchCapability } from "../src/index.mjs";

const config = {
  url: "http://127.0.0.1:9200", auth: "", indexes: ["buap-code"],
  allowRemote: false, allowedHosts: [],
};
function fake(hits = [], status = 200) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return Response.json({ hits: { total: { value: hits.length, relation: "eq" }, hits } }, { status });
    },
  };
}

test("configuration is opt-in and uses XERJ's environment variable names", () => {
  assert.deepEqual(xerjConfig({ BUAP_XERJ_INDEXES: "buap-code, docs", XERJ_AUTH: "ApiKey abc" }), {
    url: "http://127.0.0.1:9200", auth: "ApiKey abc", indexes: ["buap-code", "docs"],
    allowRemote: false, allowedHosts: [],
  });
  assert.throws(() => validateXerjConfig(xerjConfig({})), /BUAP_XERJ_INDEXES/);
});

test("rejects SSRF-friendly endpoints and nonallowlisted indexes", async () => {
  for (const url of ["http://example.com", "http://127.0.0.1:9200/extra", "http://user:pass@localhost:9200", "file:///tmp/a"]) {
    assert.throws(() => validateXerjConfig({ ...config, url }), /XERJ|Remote/);
  }
  assert.throws(() => validateXerjConfig({ ...config, indexes: ["foo*"] }), /BUAP_XERJ_INDEXES/);
  assert.throws(() => validateXerjConfig({ ...config, auth: "ApiKey secret\r\nOther: evil" }), /XERJ_AUTH/);
  const mock = fake();
  await assert.rejects(searchXerj({ index: "other", field: "body", text: "hello", config, fetchImpl: mock.fetchImpl }), /allowlist/);
  assert.equal(mock.calls.length, 0);
});

test("remote access requires TLS, explicit allowlist and API key", () => {
  const remote = { ...config, url: "https://search.example.com", allowRemote: true, allowedHosts: ["search.example.com"] };
  assert.throws(() => validateXerjConfig(remote), /XERJ_AUTH/);
  assert.equal(validateXerjConfig({ ...remote, auth: "ApiKey test-key" }), "https://search.example.com");
  assert.throws(() => validateXerjConfig({ ...remote, url: "http://search.example.com", auth: "ApiKey test-key" }), /Remote/);
  assert.throws(() => validateXerjConfig({ ...remote, url: "https://other.example.com", auth: "ApiKey test-key" }), /Remote/);
});

test("uses XERJ's documented ES search contract without writes", async () => {
  const mock = fake([{ _id: "42", _score: 0.75, _source: { body: "A passage", ax_path: "src/foo.mjs" } }]);
  const result = await searchXerj({ index: "buap-code", field: "body", text: "policy provenance", config, fetchImpl: mock.fetchImpl });
  assert.deepEqual(result, { index: "buap-code", hits: [{
    id: "42", score: 0.75, passage: "A passage", source_path: "src/foo.mjs", source_line: null,
  }] });
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].url, "http://127.0.0.1:9200/buap-code/_search");
  assert.equal(mock.calls[0].init.method, "POST");
  assert.equal(mock.calls[0].init.redirect, "error");
  const payload = JSON.parse(mock.calls[0].init.body);
  assert.deepEqual(payload.query, { match: { body: "policy provenance" } });
  assert.equal(payload.size, 5);
});

test("clamps invalid search input before making any requests", async () => {
  const mock = fake();
  for (const args of [{ field: "bad;field", text: "ok" }, { field: "body", text: "" }, { field: "body", text: "ok", size: 500 }]) {
    await assert.rejects(searchXerj({ index: "buap-code", config, fetchImpl: mock.fetchImpl, ...args }), /XERJ/);
  }
  assert.equal(mock.calls.length, 0);
});

test("redacts server errors and rejects malformed responses", async () => {
  const failures = async () => Response.json({ error: "ApiKey leaked-secret" }, { status: 403 });
  await assert.rejects(searchXerj({ index: "buap-code", field: "body", text: "test", config, fetchImpl: failures }), error => {
    assert.match(error.message, /HTTP 403/);
    assert.doesNotMatch(error.message, /leaked-secret/);
    return true;
  });
  await assert.rejects(probeXerj({ index: "buap-code", config, fetchImpl: async () => Response.json({ ok: true }) }), /no search hits array/);
});

test("capability binding requires a successful live search check and declared BUAP capability", async () => {
  const mock = fake([]);
  const bindings = [];
  const runtime = { bindCapability: (...args) => bindings.push(args) };
  const checked = await bindXerjSearchCapability(runtime, { index: "buap-code", config, fetchImpl: mock.fetchImpl });
  assert.deepEqual(checked, { reachable: true, index: "buap-code", searchVerified: true, corpusHubVerified: false });
  assert.deepEqual(bindings, [["xerj_search", { evidence_ref: "xerj:search:buap-code" }]]);
  await assert.rejects(bindXerjSearchCapability(runtime, {
    index: "buap-code", config, fetchImpl: async () => Response.json({ error: "offline" }, { status: 502 }),
  }), /HTTP 502/);
  assert.equal(bindings.length, 1);
});
