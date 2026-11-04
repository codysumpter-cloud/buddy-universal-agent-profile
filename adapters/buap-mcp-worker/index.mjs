import { timingSafeEqual } from "node:crypto";
import { handleMessage as handleGithubMessage } from "../../plugins/buap/mcp/github/server.mjs";

/**
 * Remote, read-only BUAP MCP transport. The canonical GitHub implementation
 * remains plugins/buap/mcp/github/{server,api}.mjs. No independent GitHub API.
 *
 * Cloudflare Access protects the hostname; a separately provisioned, private
 * BUAP_MCP_TOKEN authenticates requests at the Worker as defense in depth.
 */
const VERSION = "0.1.0";
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

export function remoteToolDefinitions() { return META_TOOLS; }
export function readOnlyEnv(env = {}) {
  return { ...env, BUAP_GITHUB_WRITE_ENABLED: "0", BUAP_GITHUB_APPROVAL_CODE: "" };
}
const success = (id, data) => ({
  jsonrpc: "2.0", id,
  result: { content: [{ type: "text", text: JSON.stringify(data) }], isError: false },
});
const failure = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

export async function handleBuapMessage(message, env = {}, fetchImpl = fetch) {
  if (!message || typeof message !== "object" || Array.isArray(message) ||
      message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return failure(message?.id ?? null, -32600, "Invalid JSON-RPC request.");
  }
  if (!Object.hasOwn(message, "id")) return null; // MCP notification
  const id = message.id;
  if (message.method === "tools/list") {
    const base = await handleGithubMessage(message, { env: readOnlyEnv(env), fetchImpl });
    return { ...base, result: { tools: [...META_TOOLS, ...base.result.tools] } };
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
          implemented: ["BUAP protocol", "read-only GitHub MCP", "portable profile contract"],
          host_managed_not_implicitly_connected: ["agent workers", "memory", "REA", "Hermes", "cloud compute", "scheduled jobs"],
          github_allowlist: String(env.BUAP_GITHUB_REPOS || "").split(",").map(s => s.trim()).filter(Boolean),
          github_authenticated: Boolean(env.BUAP_GITHUB_TOKEN),
          write_tools_enabled: false,
        });
      }
      return success(id, {
        protocol: "2025-06-18", transport: "stateless-streamable-http", service: "buap",
        tool_count: META_TOOLS.length + 6,
        github_allowlist_configured: Boolean(env.BUAP_GITHUB_REPOS),
        github_live_access: "not-tested-by-self-test",
        write_tools_enabled: false,
      });
    }
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
    try { raw = await request.text(); } catch { return json({ error: "bad_request" }, 400); }
    if (raw.length > MAX_BODY) return json({ error: "payload_too_large" }, 413);
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
