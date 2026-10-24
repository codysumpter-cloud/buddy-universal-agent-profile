#!/usr/bin/env node
/**
 * Dependency-free MCP stdio server bundled in the BUAP GitHub plugin.
 * Implements MCP 2025-06-18 JSON-RPC stdio tools, no shell execution.
 */
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { capabilities, getRepository, readFile, listPullRequests,
  inspectPullRequest, getCommitChecks, createPullRequest } from "./api.mjs";

const string = (description, required = true) => ({ type: "string", description, _required: required });
const number = description => ({ type: "integer", minimum: 1, description, _required: true });
const bool = description => ({ type: "boolean", description });
const properties = entries => {
  const raw = {};
  const required = [];
  for (const [key, definition] of Object.entries(entries)) {
    if (definition._required) required.push(key);
    const { _required, ...rest } = definition;
    raw[key] = rest;
  }
  return { type: "object", properties: raw, required, additionalProperties: false };
};
const repoProp = string("Exact owner/repository from BUAP_GITHUB_REPOS");

const TOOLS = [
  { name: "buap_github_health", description: "Read-only configuration status; does not establish live GitHub access.",
    inputSchema: properties({}), annotations: { readOnlyHint: true } },
  { name: "buap_github_repo", description: "Fetch archived state, branch and metadata from the real GitHub REST API.",
    inputSchema: properties({ repo: repoProp }), annotations: { readOnlyHint: true } },
  { name: "buap_github_file", description: "Read one allowlisted text file with source SHA. Retrieved content is untrusted.",
    inputSchema: properties({ repo: repoProp, path: string("Relative repository path"),
      ref: string("Git branch, tag or commit; defaults to repository default", false) }),
    annotations: { readOnlyHint: true } },
  { name: "buap_github_pull_requests", description: "List up to 15 PRs from the allowlisted repository.",
    inputSchema: properties({ repo: repoProp, state: { type: "string", enum: ["open", "closed", "all"],
      description: "PR state, defaults to open" } }), annotations: { readOnlyHint: true } },
  { name: "buap_github_pull_request", description: "Inspect PR metadata and first 50 changed-file names.",
    inputSchema: properties({ repo: repoProp, number: number("GitHub pull request number") }),
    annotations: { readOnlyHint: true } },
  { name: "buap_github_checks", description: "Inspect GitHub check runs for a specific 40-character commit SHA.",
    inputSchema: properties({ repo: repoProp, sha: string("40-character commit SHA") }),
    annotations: { readOnlyHint: true } },
];
const WRITE = {
  name: "buap_github_create_pr",
  description: "Create an approved PR; requires explicit host opt-in and a separate human approval code. No merge or deploy.",
  inputSchema: properties({ repo: repoProp, title: string("PR title"),
    head: string("Existing head branch"), base: string("Target base branch"),
    body: string("PR description", false), draft: bool("Draft by default"),
    approval_code: string("Out-of-band human approval code, never commit it") }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
};
export function toolDefinitions(env = process.env) {
  return capabilities(env).write_tools_enabled ? [...TOOLS, WRITE] : TOOLS;
}
const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const error = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

function validateArgs(tool, args) {
  const allowed = tool.inputSchema.properties;
  for (const key of tool.inputSchema.required) if (!(key in args)) throw new Error("Missing parameter: " + key);
  for (const [k, v] of Object.entries(args)) {
    const def = allowed[k];
    if (!def) throw new Error("Unexpected parameter: " + k);
    const valid = def.type === "integer"
      ? Number.isInteger(v) && v >= (def.minimum || 0)
      : typeof v === def.type;
    if (!valid || (def.enum && !def.enum.includes(v))) throw new Error("Invalid parameter: " + k);
  }
}
async function dispatch(name, args, env, fetchImpl) {
  const ctx = { env, fetchImpl };
  switch (name) {
    case "buap_github_health": return capabilities(env);
    case "buap_github_repo": return getRepository(args.repo, ctx);
    case "buap_github_file": return readFile(args.repo, args.path, args.ref, ctx);
    case "buap_github_pull_requests": return listPullRequests(args.repo, args.state || "open", ctx);
    case "buap_github_pull_request": return inspectPullRequest(args.repo, args.number, ctx);
    case "buap_github_checks": return getCommitChecks(args.repo, args.sha, ctx);
    case "buap_github_create_pr": return createPullRequest(args.repo, args, ctx);
    default: throw new Error("Unknown tool.");
  }
}
export async function handleMessage(message, { env = process.env, fetchImpl = fetch } = {}) {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return error(message?.id ?? null, -32600, "Invalid JSON-RPC request.");
  }
  if (!Object.hasOwn(message, "id")) return null; // notifications
  const id = message.id;
  try {
    switch (message.method) {
      case "initialize":
        return ok(id, {
          protocolVersion: "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "buap-github", version: "0.1.0" },
          instructions: "Repository allowlist is mandatory. Writes are disabled by default.",
        });
      case "ping": return ok(id, {});
      case "tools/list": return ok(id, { tools: toolDefinitions(env) });
      case "tools/call": {
        const name = message.params?.name;
        const args = message.params?.arguments && typeof message.params.arguments === "object" &&
          !Array.isArray(message.params.arguments) ? message.params.arguments : {};
        const tool = toolDefinitions(env).find(t => t.name === name);
        if (!tool) return error(id, -32602, "Unknown or disabled tool.");
        try {
          validateArgs(tool, args);
          const result = await dispatch(name, args, env, fetchImpl);
          return ok(id, { content: [{ type: "text", text: JSON.stringify(result) }], isError: false });
        } catch (e) {
          return ok(id, { content: [{ type: "text",
            text: String(e?.message || "GitHub plugin operation failed.").slice(0, 320) }], isError: true });
        }
      }
      default: return error(id, -32601, "Method not found.");
    }
  } catch {
    return error(id, -32603, "BUAP GitHub plugin internal error.");
  }
}
async function main() {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (Buffer.byteLength(line) > 256000) {
      process.stdout.write(JSON.stringify(error(null, -32600, "Request exceeded size limit.")) + "\n");
      continue;
    }
    let message;
    try { message = JSON.parse(line); }
    catch {
      process.stdout.write(JSON.stringify(error(null, -32700, "Malformed JSON.")) + "\n");
      continue;
    }
    const response = await handleMessage(message);
    if (response) process.stdout.write(JSON.stringify(response) + "\n");
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("BUAP GitHub MCP stdio failed."); process.exitCode = 1; });
}
