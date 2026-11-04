import { timingSafeEqual } from "node:crypto";
import { handleMessage as handleGithubMessage } from "../../plugins/buap/mcp/github/server.mjs";

/**
 * Remote, read-only BUAP MCP transport. The canonical GitHub implementation
 * remains plugins/buap/mcp/github/{server,api}.mjs. No independent GitHub API.
 *
 * Cloudflare Access protects the hostname; a separately provisioned, private
 * BUAP_MCP_TOKEN authenticates requests at the Worker as defense in depth.
 */
const VERSION = "0.2.0";
const MAX_BODY = 65536;
const META_TOOLS = Object.freeze([
  {
    name: "buap_self_test",
    description: "Verify BUAP remote MCP protocol and configured capabilities; no external writes.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "buap_manifest",
    description: "Read the canonical BUAP profile, orchestration, and policy contract references.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "buap_capabilities",
    description: "Report implemented BUAP tools and explicitly distinguish host-managed integrations.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
]);
const LIVE_TOOLS = Object.freeze([
  {
    name: "buap_github_probe",
    description: "Perform a real, read-only GitHub repository request against an explicitly allowlisted repo. Returns timestamped connection evidence, not merely configuration.",
    inputSchema: { type: "object", properties: {
      repo: { type: "string", description: "Exact allowlisted owner/repository." },
    }, required: ["repo"], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "buap_pr_gate",
    description: "Inspect an allowlisted GitHub PR and actual check runs. Return evidence and blockers; never merge or imply approval, security reviews or deployment are complete.",
    inputSchema: { type: "object", properties: {
      repo: { type: "string", description: "Exact allowlisted owner/repository." },
      number: { type: "integer", minimum: 1, description: "Existing pull request number." },
    }, required: ["repo", "number"], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
]);
const manifest = Object.freeze({
  repository: "codysumpter-cloud/buddy-universal-agent-profile",
  roles: { buddy: "user-facing orchestrator", lil_buddy: "implementation worker" },
  profile_contract: "contracts/prismtek-agent-profile-v1.md",
  orchestration: "standards/orchestration.md",
  safety: "safety/destructive-actions.md",
  runtime: "standards/runtime-contract.md",
  github_mcp: "plugins/buap/mcp/github/server.mjs",
  distinction: "BUAP is the portable profile and policy contract, not a self-running subagent.",
});

export function remoteToolDefinitions() { return [...META_TOOLS, ...LIVE_TOOLS]; }
export function readOnlyEnv(env = {}) {
  return { ...env, BUAP_GITHUB_WRITE_ENABLED: "0", BUAP_GITHUB_APPROVAL_CODE: "" };
}
const success = (id, data) => ({
  jsonrpc: "2.0", id,
  result: { content: [{ type: "text", text: JSON.stringify(data) }], isError: false },
});
const failure = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });


function canonicalResult(call) {
  if (call?.error || call?.result?.isError) return null;
  const text = call?.result?.content?.[0]?.text;
  return typeof text === "string" ? JSON.parse(text) : null;
}

function validLiveArgs(name, args) {
  if (!args || typeof args !== "object" || Array.isArray(args) ||
      typeof args.repo !== "string" || !args.repo.trim()) return false;
  const keys = Object.keys(args).sort().join(",");
  if (name === "buap_github_probe") return keys === "repo";
  return keys === "number,repo" && Number.isSafeInteger(args.number) &&
    args.number >= 1 && args.number <= 99999999;
}

function githubCall(id, name, args, env, fetchImpl) {
  return handleGithubMessage(
    { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } },
    { env: readOnlyEnv(env), fetchImpl },
  );
}

async function liveGithubTool(id, name, args, env, fetchImpl) {
  if (!validLiveArgs(name, args)) return failure(id, -32602, "Invalid arguments.");
  const first = await githubCall(id, name === "buap_github_probe"
    ? "buap_github_repo" : "buap_github_pull_request",
    name === "buap_github_probe" ? { repo: args.repo } : args, env, fetchImpl);
  if (first?.error || first?.result?.isError) return first;
  let result;
  try { result = canonicalResult(first); }
  catch { return failure(id, -32603, "GitHub result validation failed."); }
  if (!result) return failure(id, -32603, "GitHub result missing.");
  if (name === "buap_github_probe") {
    return success(id, {
      connection: "live_github_request_succeeded",
      checked_at: new Date().toISOString(),
      repo: result.full_name, default_branch: result.default_branch,
      archived: result.archived, private: result.private,
      source_url: result.html_url,
      write_tools_enabled: false,
      limitation: "Repository metadata success does not establish PR write or deployment permission.",
    });
  }
  if (typeof result.head_sha !== "string" || !/^[a-f0-9]{40}$/i.test(result.head_sha)) {
    return failure(id, -32603, "PR head revision unavailable.");
  }
  const checkCall = await githubCall(id, "buap_github_checks",
    { repo: args.repo, sha: result.head_sha }, env, fetchImpl);
  if (checkCall?.error || checkCall?.result?.isError) return checkCall;
  let checks;
  try { checks = canonicalResult(checkCall); }
  catch { return failure(id, -32603, "GitHub checks validation failed."); }
  if (!checks || !Array.isArray(checks.checks)) return failure(id, -32603, "GitHub checks missing.");
  const passing = new Set(["success", "neutral", "skipped"]);
  const total = Number.isInteger(checks.total) ? checks.total : checks.checks.length;
  const truncated = checks.truncated === true || total > checks.checks.length;
  const allChecksPass = total > 0 && !truncated && checks.checks.every(c =>
    c.status === "completed" && passing.has(c.conclusion));
  const open = result.state === "open" && result.merged !== true;
  // This is deliberately a READINESS REPORT, not merge authorization.
  return success(id, {
    kind: "live_github_pr_readiness",
    checked_at: new Date().toISOString(),
    repo: args.repo, number: result.number,
    source_url: result.html_url, head_sha: result.head_sha, base_sha: result.base_sha,
    pr_state: result.state, merged: result.merged, mergeable: result.mergeable,
    checks: {
      total, inspected: checks.checks.length, truncated,
      all_reported_checks_pass: allChecksPass,
      blockers: checks.checks.filter(c => c.status !== "completed" ||
        !passing.has(c.conclusion)).map(c => ({
          name: c.name, status: c.status, conclusion: c.conclusion, url: c.html_url,
        })),
    },
    preliminary_review_ready: open && result.mergeable === true && allChecksPass,
    independently_unverified: ["required_reviews", "branch_protection", "licensing",
      "security", "deployment", "human_release_approval"],
    release_authorized: false,
    note: "Passing CI is not permission to merge or deploy.",
  });
}

export async function handleBuapMessage(message, env = {}, fetchImpl = fetch) {
  if (!message || typeof message !== "object" || Array.isArray(message) ||
      message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return failure(message?.id ?? null, -32600, "Invalid JSON-RPC request.");
  }
  if (!Object.hasOwn(message, "id")) return null; // MCP notification
  const id = message.id;
  if (message.method === "tools/list") {
    const base = await handleGithubMessage(message, { env: readOnlyEnv(env), fetchImpl });
    return { ...base, result: { tools: [...remoteToolDefinitions(), ...base.result.tools] } };
  }
  if (message.method === "initialize") {
    const base = await handleGithubMessage(message, { env: readOnlyEnv(env), fetchImpl });
    if (!base.result) return base;
    return { ...base, result: { ...base.result, serverInfo: { name: "buap", version: VERSION },
      instructions: "BUAP portable agent profiles and guarded GitHub inspection. Stateless HTTP; read-only. Host permissions and approvals remain authoritative." } };
  }
  if (message.method === "tools/call") {
    const name = message.params?.name;
    if (META_TOOLS.some(t => t.name === name)) {
      const args = message.params?.arguments ?? {};
      if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).length) {
        return success(id, { error: "This BUAP tool accepts no arguments." });
      }
      if (name === "buap_manifest") return success(id, manifest);
      if (name === "buap_capabilities") {
        return success(id, {
          implemented: ["BUAP protocol", "read-only GitHub MCP", "portable profile contract", "live GitHub connectivity probe", "PR CI readiness report"],
          host_managed_not_implicitly_connected: ["agent workers", "memory", "REA", "Hermes", "cloud compute", "scheduled jobs"],
          github_allowlist: String(env.BUAP_GITHUB_REPOS || "").split(",").map(s => s.trim()).filter(Boolean),
          github_authenticated: Boolean(env.BUAP_GITHUB_TOKEN),
          write_tools_enabled: false,
        });
      }
      return success(id, {
        protocol: "2025-06-18", transport: "stateless-streamable-http", service: "buap",
        tool_count: remoteToolDefinitions().length + 6,
        github_allowlist_configured: Boolean(env.BUAP_GITHUB_REPOS),
        github_live_access: "not-tested-by-self-test",
        write_tools_enabled: false,
      });
    }
  }
  if (message.method === "tools/call" && LIVE_TOOLS.some(t => t.name === message.params?.name)) {
    return liveGithubTool(id, message.params.name, message.params.arguments, env, fetchImpl);
  }
  return handleGithubMessage(message, { env: readOnlyEnv(env), fetchImpl });
}

function authorized(header, secret) {
  if (!secret || typeof secret !== "string" || !header?.startsWith("Bearer ")) return false;
  const incoming = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return incoming.length === expected.length && timingSafeEqual(incoming, expected);
}
function json(data, status = 200, extras = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store",
      "x-content-type-options": "nosniff", ...extras },
  });
}

async function boundedBody(request) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  let count = 0;
  const parts = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    count += value.byteLength;
    if (count > MAX_BODY) {
      await reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(count);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz" && request.method === "GET") {
      return json({ service: "buap", transport: "streamable-http", ready: Boolean(env.BUAP_MCP_TOKEN) });
    }
    if (url.pathname !== "/mcp") return json({ error: "not_found" }, 404);
    if (!env.BUAP_MCP_TOKEN) return json({ error: "not_configured" }, 503);
    if (!authorized(request.headers.get("authorization"), env.BUAP_MCP_TOKEN)) {
      return json({ error: "unauthorized" }, 401, { "www-authenticate": "Bearer" });
    }
    if (request.method === "GET" || request.method === "DELETE") {
      return new Response(null, { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
    }
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
      return json({ error: "expected_application_json" }, 415);
    }
    const declared = Number(request.headers.get("content-length") || "0");
    if (declared > MAX_BODY) return json({ error: "payload_too_large" }, 413);
    let raw;
    try { raw = await boundedBody(request); }
    catch { return json({ error: "bad_request" }, 400); }
    if (raw === null) return json({ error: "payload_too_large" }, 413);
    let message;
    try { message = JSON.parse(raw); } catch {
      return json(failure(null, -32700, "Malformed JSON."));
    }
    try {
      const result = await handleBuapMessage(message, env);
      return result === null ? new Response(null, { status: 202,
        headers: { "cache-control": "no-store" } }) : json(result);
    } catch {
      return json(failure(message?.id ?? null, -32603, "BUAP MCP internal error."));
    }
  },
};
