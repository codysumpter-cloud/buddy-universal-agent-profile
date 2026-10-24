/**
 * BUAP GitHub MCP API adapter. The host owns auth and human approvals.
 * No arbitrary URLs, shell execution, broad repository discovery or secrets in output.
 */
import { timingSafeEqual } from "node:crypto";

const REPO_RE = /^[a-z\d_.-]+\/[a-z\d_.-]+$/i;
const SHA_RE = /^[0-9a-f]{40}$/i;
const NAME_RE = /^[a-zA-Z0-9_.-]{1,150}$/;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const BODY_LIMIT = 18000;

function ensureRepo(repo, env) {
  if (typeof repo !== "string" || !REPO_RE.test(repo) || repo.includes("..")) {
    throw new Error("Repository must have a safe owner/name identifier.");
  }
  const approved = (env.BUAP_GITHUB_REPOS || "").split(",")
    .map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!approved.length || !approved.includes(repo.toLowerCase())) {
    throw new Error("Repository is not explicitly allowed by BUAP_GITHUB_REPOS.");
  }
  return repo;
}
function integer(n, min, max, name) {
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error("Invalid " + name + ".");
  return n;
}
function checkedPath(path) {
  if (typeof path !== "string" || path.length < 1 || path.length > 480 ||
      path.startsWith("/") || path.includes("\\") || path.includes("\0") ||
      path.split("/").some(s => !s || s === "." || s === "..")) {
    throw new Error("Invalid repository file path.");
  }
  return path.split("/").map(encodeURIComponent).join("/");
}
function checkedRef(ref) {
  if (typeof ref !== "string" || ref.length < 1 || ref.length > 150 ||
      !/^[a-zA-Z0-9._/-]+$/.test(ref) || ref.includes("..") ||
      ref.startsWith("/") || ref.endsWith("/") || ref.includes("//")) {
    throw new Error("Invalid GitHub branch, tag or ref.");
  }
  return ref;
}
function checkedSHA(sha) {
  if (typeof sha !== "string" || !SHA_RE.test(sha)) throw new Error("Expected a 40-character SHA.");
  return sha;
}
function safePreview(raw, max = BODY_LIMIT) {
  if (typeof raw !== "string") return "";
  return raw.slice(0, max);
}
function textLimit(value, name, max) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("Invalid " + name + ".");
  return value;
}
function compareSecret(got, expected) {
  if (typeof got !== "string" || typeof expected !== "string" || !expected ||
      Buffer.byteLength(got) !== Buffer.byteLength(expected)) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/** Hardcoded API origin, no redirects, bounded response, request timeout, no error-body reflection. */
export async function requestGitHub({
  env = process.env, fetchImpl = fetch, repo, method = "GET", path, body = undefined,
  search = null, timeoutMs = 10000,
}) {
  const name = ensureRepo(repo, env);
  if (!["GET", "POST"].includes(method)) throw new Error("Unsupported GitHub method.");
  if (typeof path !== "string" || !path.startsWith("/") ||
      path.includes("://") || path.includes("..") || path.includes("\\") ||
      path.includes("#") || path.includes("?") || path.includes("//")) {
    throw new Error("Invalid GitHub API path.");
  }
  integer(timeoutMs, 100, 30000, "request timeout");
  const url = new URL("https://api.github.com/repos/" + name + path);
  if (search) {
    for (const [key, value] of Object.entries(search)) {
      if (!NAME_RE.test(key)) throw new Error("Invalid GitHub parameter.");
      url.searchParams.set(key, String(value));
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "buap-github-mcp/0.1",
    };
    const token = (env.BUAP_GITHUB_TOKEN || env.GITHUB_TOKEN || "").trim();
    if (token) {
      if (/[\r\n]/.test(token) || token.length > 4096) throw new Error("Invalid GitHub credential.");
      headers.authorization = "Bearer " + token;
    }
    if (method === "POST") headers["content-type"] = "application/json";
    const res = await fetchImpl(url.toString(), {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error", signal: controller.signal,
    });
    if (!res.ok) {
      // Do not reflect untrusted server error bodies; they may echo private data.
      throw new Error("GitHub API returned HTTP " + res.status + ".");
    }
    if (Number(res.headers?.get?.("content-length") || 0) > MAX_RESPONSE_BYTES) {
      throw new Error("GitHub response too large.");
    }
    const raw = await res.text();
    if (Buffer.byteLength(raw) > MAX_RESPONSE_BYTES) throw new Error("GitHub response too large.");
    try { return JSON.parse(raw); }
    catch { throw new Error("GitHub response was not valid JSON."); }
  } catch (err) {
    if (controller.signal.aborted) throw new Error("GitHub API request timed out.");
    if (/^GitHub |^Invalid GitHub/.test(err?.message || "")) throw err;
    throw new Error("GitHub API connection failed; verify the host network and permissions.");
  } finally {
    clearTimeout(timer);
  }
}

export function capabilities(env = process.env) {
  const allowlist = (env.BUAP_GITHUB_REPOS || "").split(",").map(s => s.trim()).filter(Boolean);
  return {
    name: "buap-github",
    api_origin: "https://api.github.com",
    allowlisted_repositories: allowlist,
    authenticated: Boolean(env.BUAP_GITHUB_TOKEN || env.GITHUB_TOKEN),
    write_tools_enabled: env.BUAP_GITHUB_WRITE_ENABLED === "1" &&
      Boolean(env.BUAP_GITHUB_APPROVAL_CODE),
    note: "Configured does not prove GitHub connectivity. Probe an allowlisted repo.",
  };
}
export async function getRepository(repo, ctx = {}) {
  const j = await requestGitHub({ ...ctx, repo, path: "" });
  return { full_name: j.full_name, archived: j.archived, private: j.private,
    default_branch: j.default_branch, html_url: j.html_url, description: safePreview(j.description || "", 600) };
}
export async function readFile(repo, filePath, ref = "HEAD", ctx = {}) {
  checkedPath(filePath);
  const query = { ref: checkedRef(ref) };
  const j = await requestGitHub({ ...ctx, repo, path: "/contents/" + checkedPath(filePath), search: query });
  if (j?.type !== "file" || typeof j.content !== "string" || j.encoding !== "base64") {
    throw new Error("GitHub returned a directory, binary or unsupported content.");
  }
  if (j.size > 120000 || j.content.length > 180000) throw new Error("GitHub file too large for safe retrieval.");
  const content = Buffer.from(j.content.replace(/\s/g, ""), "base64").toString("utf8");
  if (content.includes("\0")) throw new Error("GitHub file appears to be binary.");
  return { path: j.path, repo, ref, blob_sha: j.sha, html_url: j.html_url, size: j.size,
    content: safePreview(content, 24000), truncated: content.length > 24000 };
}
export async function listPullRequests(repo, state = "open", ctx = {}) {
  if (!["open", "closed", "all"].includes(state)) throw new Error("Invalid PR state.");
  const j = await requestGitHub({ ...ctx, repo, path: "/pulls", search: { state, per_page: 15 } });
  if (!Array.isArray(j)) throw new Error("Unexpected GitHub PR list.");
  return j.slice(0, 15).map(p => ({
    number: p.number, title: safePreview(p.title, 300), state: p.state,
    draft: p.draft, html_url: p.html_url, head_sha: p.head?.sha, base: p.base?.ref,
  }));
}
export async function inspectPullRequest(repo, number, ctx = {}) {
  const n = integer(number, 1, 99999999, "pull request number");
  const [pr, files] = await Promise.all([
    requestGitHub({ ...ctx, repo, path: "/pulls/" + n }),
    requestGitHub({ ...ctx, repo, path: "/pulls/" + n + "/files", search: { per_page: 50 } }),
  ]);
  if (!Array.isArray(files)) throw new Error("Unexpected GitHub PR files response.");
  return { number: pr.number, title: safePreview(pr.title, 300), state: pr.state,
    merged: Boolean(pr.merged), mergeable: pr.mergeable, draft: pr.draft,
    head_sha: pr.head?.sha, base_sha: pr.base?.sha, html_url: pr.html_url,
    files: files.slice(0, 50).map(f => ({ filename: f.filename,
      status: f.status, additions: f.additions, deletions: f.deletions })),
    files_truncated: (pr.changed_files || 0) > 50,
  };
}
export async function getCommitChecks(repo, sha, ctx = {}) {
  const j = await requestGitHub({ ...ctx, repo,
    path: "/commits/" + checkedSHA(sha) + "/check-runs", search: { per_page: 50 } });
  if (!Array.isArray(j.check_runs)) throw new Error("Unexpected GitHub checks response.");
  return { sha, total: j.total_count, checks: j.check_runs.map(c => ({
    name: safePreview(c.name, 180), status: c.status, conclusion: c.conclusion,
    html_url: c.html_url,
  })), truncated: (j.total_count || 0) > 50 };
}

/**
 * Write gate: explicit repo allowlist, host write opt-in AND human-supplied
 * approval code, in addition to whatever approval policy the host enforces.
 * Does NOT merge, force push, deploy, edit files or bypass branch protection.
 */
export async function createPullRequest(repo, { title, head, base, body = "", draft = true, approval_code }, ctx = {}) {
  const env = ctx.env || process.env;
  ensureRepo(repo, env);
  if (env.BUAP_GITHUB_WRITE_ENABLED !== "1" ||
      !compareSecret(approval_code, env.BUAP_GITHUB_APPROVAL_CODE || "")) {
    throw new Error("GitHub write requires explicit host enablement and human approval code.");
  }
  textLimit(title, "pull request title", 200);
  textLimit(head, "head branch", 150);
  textLimit(base, "base branch", 150);
  checkedRef(head); checkedRef(base);
  if (typeof body !== "string" || body.length > 16000 || typeof draft !== "boolean") {
    throw new Error("Invalid pull request description or draft flag.");
  }
  const j = await requestGitHub({ ...ctx, repo, path: "/pulls", method: "POST",
    body: { title, head, base, body, draft } });
  return { number: j.number, html_url: j.html_url, state: j.state,
    draft: j.draft, head_sha: j.head?.sha };
}
