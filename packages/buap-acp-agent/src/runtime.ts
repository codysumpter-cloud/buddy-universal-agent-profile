import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type PersonalizationState = {
  user_display_name?: string;
  buddy_display_name?: string;
  lil_buddy_display_name?: string;
  buddy_profile_id: string;
  lil_buddy_profile_id: string;
  selected_profile_pack_id: string;
  updated_at?: string;
};

export type Profile = {
  id: string;
  display_name?: string;
  role?: string;
  best_for?: string[];
  personality?: string;
  moves?: string[];
  passive?: string;
  default_slot_recommendation?: string;
};

export type ProfilePack = {
  profile_pack_id?: string;
  profiles?: Profile[];
};

export type LoadedBuap = {
  repoRoot: string;
  files: Record<string, string>;
  profilePack: ProfilePack;
};

export type SessionState = {
  sessionId: string;
  cwd?: string;
  mcpServers: unknown[];
  createdAt: string;
};

type RuntimeArgs = {
  text: string;
  state: PersonalizationState;
  profilePack: ProfilePack;
  buap: LoadedBuap;
  session?: SessionState;
};

type RuntimeResult = {
  handled: boolean;
  response: string;
};

function workspaceRoot(buap: LoadedBuap, session?: SessionState): string {
  return path.resolve(session?.cwd || process.env.BUAP_WORKSPACE_ROOT || buap.repoRoot);
}

function assertSafeRelativePath(workspace: string, requested: string): string {
  if (!requested || requested.trim() === "") {
    throw new Error("Missing `path=` value.");
  }

  if (path.isAbsolute(requested)) {
    throw new Error("Use a workspace-relative path, not an absolute path.");
  }

  const resolved = path.resolve(workspace, requested);
  const normalizedWorkspace = workspace.endsWith(path.sep) ? workspace : `${workspace}${path.sep}`;
  if (resolved !== workspace && !resolved.startsWith(normalizedWorkspace)) {
    throw new Error(`Blocked path outside workspace: ${requested}`);
  }

  return resolved;
}

function parseKeyValues(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /(path|find|replace|prompt|cmd|max_bytes)=("([^"]*)"|'([^']*)'|([^\s]+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input))) {
    result[match[1]] = match[3] ?? match[4] ?? match[5] ?? "";
  }
  return result;
}

function stripCommandPrefix(input: string, command: string): string {
  const index = input.toLowerCase().indexOf(command);
  if (index < 0) return input.trim();
  return input.slice(index + command.length).trim();
}

function truncateMiddle(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  const head = Math.floor(maxChars * 0.65);
  const tail = Math.floor(maxChars * 0.25);
  return `${value.slice(0, head)}\n\n...[truncated ${value.length - head - tail} chars]...\n\n${value.slice(-tail)}`;
}

async function readWorkspaceFile(args: RuntimeArgs): Promise<string> {
  const values = parseKeyValues(args.text);
  const workspace = workspaceRoot(args.buap, args.session);
  const relativePath = values.path || stripCommandPrefix(args.text, "/buap read");
  const absolutePath = assertSafeRelativePath(workspace, relativePath);
  const maxBytes = Number(values.max_bytes || process.env.BUAP_MAX_READ_BYTES || 20000);
  const stat = await fs.stat(absolutePath);

  if (!stat.isFile()) {
    throw new Error(`Not a regular file: ${relativePath}`);
  }

  if (stat.size > maxBytes) {
    throw new Error(`File is ${stat.size} bytes, over max read limit ${maxBytes}. Re-run with max_bytes=... if intentional.`);
  }

  const content = await fs.readFile(absolutePath, "utf8");
  return [
    `Lil Buddy read \`${relativePath}\` from workspace \`${workspace}\`.`,
    "",
    "```text",
    content,
    "```"
  ].join("\n");
}

function buildSimplePatch(relativePath: string, before: string, after: string): string {
  return [
    `diff --git a/${relativePath} b/${relativePath}`,
    `--- a/${relativePath}`,
    `+++ b/${relativePath}`,
    "@@",
    ...before.split("\n").map((line) => `-${line}`),
    ...after.split("\n").map((line) => `+${line}`)
  ].join("\n");
}

async function proposePatch(args: RuntimeArgs): Promise<string> {
  const values = parseKeyValues(args.text);
  const workspace = workspaceRoot(args.buap, args.session);
  const relativePath = values.path;
  const find = values.find;
  const replace = values.replace;

  if (!relativePath || !find) {
    return [
      "Patch proposal needs `path=` and `find=`. Optional `replace=` defaults to empty string.",
      "",
      "Example:",
      "",
      "```text",
      "/buap patch path=README.md find=\"old text\" replace=\"new text\"",
      "```"
    ].join("\n");
  }

  const absolutePath = assertSafeRelativePath(workspace, relativePath);
  const content = await fs.readFile(absolutePath, "utf8");
  if (!content.includes(find)) {
    throw new Error(`Could not find requested text in ${relativePath}. No patch proposed.`);
  }

  const next = content.replace(find, replace ?? "");
  const patch = buildSimplePatch(relativePath, find, replace ?? "");

  return [
    "Buddy prepared a patch proposal only. It did not write to disk.",
    "",
    "Lil Buddy report:",
    "",
    "```json",
    JSON.stringify(
      {
        status: "done",
        summary: `Prepared replacement patch for ${relativePath}.`,
        actions_taken: ["read target file", "confirmed search text exists", "generated patch proposal"],
        evidence: [relativePath],
        risks_or_permissions: ["No file write performed. Apply through editor review or an explicit future write tool."],
        next_recommended_command: "Review and apply the proposed diff from the editor UI."
      },
      null,
      2
    ),
    "```",
    "",
    "```diff",
    patch,
    "```",
    "",
    `Resulting file size if applied: ${Buffer.byteLength(next, "utf8")} bytes.`
  ].join("\n");
}

function profileById(profilePack: ProfilePack, id: string): Profile | undefined {
  return profilePack.profiles?.find((profile) => profile.id === id);
}

function compactBuapContext(args: RuntimeArgs): string {
  const buddyProfile = profileById(args.profilePack, args.state.buddy_profile_id);
  const lilBuddyProfile = profileById(args.profilePack, args.state.lil_buddy_profile_id);
  const xcodeProfile = args.buap.files["XCODE_ACP_BUAP.md"] ?? "";
  const fullProfile = args.buap.files["BUAP_FULL.md"] ?? "";

  return [
    "You are Buddy running inside BUAP ACP.",
    `User display name: ${args.state.user_display_name ?? "unknown"}`,
    `Main Buddy display name: ${args.state.buddy_display_name ?? "Buddy"}`,
    `Lil Buddy display name: ${args.state.lil_buddy_display_name ?? "Lil Buddy"}`,
    `Main Buddy profile: ${buddyProfile?.display_name ?? args.state.buddy_profile_id} ${buddyProfile?.role ? `(${buddyProfile.role})` : ""}`,
    `Lil Buddy profile: ${lilBuddyProfile?.display_name ?? args.state.lil_buddy_profile_id} ${lilBuddyProfile?.role ? `(${lilBuddyProfile.role})` : ""}`,
    "",
    "ACP adapter profile:",
    truncateMiddle(xcodeProfile, 5000),
    "",
    "BUAP full profile excerpt:",
    truncateMiddle(fullProfile, 5000)
  ].join("\n");
}

async function modelAnswer(args: RuntimeArgs): Promise<string> {
  const promptFromValue = parseKeyValues(args.text).prompt;
  const userPrompt = promptFromValue || stripCommandPrefix(args.text, "/buap ask");
  const backend = process.env.BUAP_MODEL_BACKEND || "mock";

  if (backend !== "openai-compatible") {
    return [
      "Model backend is not configured yet, so Buddy stayed in safe local mode.",
      "",
      "To enable an OpenAI-compatible backend, set:",
      "",
      "```bash",
      "BUAP_MODEL_BACKEND=openai-compatible",
      "BUAP_MODEL_BASE_URL=https://api.openai.com/v1",
      "BUAP_MODEL_NAME=gpt-4.1-mini",
      "BUAP_MODEL_API_KEY=...",
      "```",
      "",
      "Then retry:",
      "",
      "```text",
      `/buap ask ${userPrompt || "summarize this workspace"}`,
      "```"
    ].join("\n");
  }

  const baseUrl = process.env.BUAP_MODEL_BASE_URL;
  const model = process.env.BUAP_MODEL_NAME;
  const apiKey = process.env.BUAP_MODEL_API_KEY;

  if (!baseUrl || !model || !apiKey) {
    throw new Error("OpenAI-compatible backend requires BUAP_MODEL_BASE_URL, BUAP_MODEL_NAME, and BUAP_MODEL_API_KEY.");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: compactBuapContext(args) },
        { role: "user", content: userPrompt || "Introduce yourself and explain available BUAP ACP commands." }
      ],
      temperature: Number(process.env.BUAP_MODEL_TEMPERATURE || 0.2)
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Model backend failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return json.choices?.[0]?.message?.content?.trim() || "Model backend returned no message content.";
}

async function gitReadOnly(args: RuntimeArgs): Promise<string> {
  const workspace = workspaceRoot(args.buap, args.session);
  const lower = args.text.toLowerCase();
  const values = parseKeyValues(args.text);
  const timeout = Number(process.env.BUAP_GIT_TIMEOUT_MS || 10000);

  let gitArgs: string[];
  let title: string;

  if (lower.includes("/buap git diff")) {
    title = "git diff";
    gitArgs = ["diff", "--"];
    if (values.path) {
      const absolutePath = assertSafeRelativePath(workspace, values.path);
      gitArgs.push(path.relative(workspace, absolutePath));
    }
  } else {
    title = "git status --short --branch";
    gitArgs = ["status", "--short", "--branch"];
  }

  const { stdout, stderr } = await execFileAsync("git", gitArgs, {
    cwd: workspace,
    timeout,
    maxBuffer: 1024 * 1024
  });

  return [
    `Lil Buddy ran read-only \`${title}\` in \`${workspace}\`.`,
    "",
    "```text",
    stdout || stderr || "(no output)",
    "```"
  ].join("\n");
}

function renderMcpStatus(args: RuntimeArgs): string {
  const servers = args.session?.mcpServers ?? [];
  return [
    "ACP session MCP context:",
    "",
    "```json",
    JSON.stringify({ count: servers.length, servers }, null, 2),
    "```",
    "",
    "This BUAP package records MCP server config passed by the ACP client. Direct MCP tool execution should be added only after client capability and permission handling is wired."
  ].join("\n");
}

function renderHelp(): string {
  return [
    "BUAP ACP commands:",
    "",
    "- `/buap profiles` — list BMO council profile IDs",
    "- `/buap personalize user=\"Cody\" buddy=\"Buddy\" lil_buddy=\"Finn\" buddy_profile=bmo lil_buddy_profile=finn`",
    "- `/buap read path=README.md [max_bytes=20000]` — read a workspace file safely",
    "- `/buap patch path=README.md find=\"old\" replace=\"new\"` — propose a diff only; no file write",
    "- `/buap ask prompt=\"...\"` — ask the configured model backend, or get backend setup instructions",
    "- `/buap git status` — read-only git status",
    "- `/buap git diff [path=README.md]` — read-only git diff",
    "- `/buap mcp` — show MCP server config passed by the ACP client",
    "",
    "Destructive actions remain blocked until explicit ACP/editor permission handling is implemented."
  ].join("\n");
}

export async function handleRuntimeCommand(args: RuntimeArgs): Promise<RuntimeResult> {
  const lower = args.text.trim().toLowerCase();

  if (lower.includes("/buap help")) return { handled: true, response: renderHelp() };
  if (lower.includes("/buap read")) return { handled: true, response: await readWorkspaceFile(args) };
  if (lower.includes("/buap patch")) return { handled: true, response: await proposePatch(args) };
  if (lower.includes("/buap ask")) return { handled: true, response: await modelAnswer(args) };
  if (lower.includes("/buap git status") || lower.includes("/buap git diff")) {
    return { handled: true, response: await gitReadOnly(args) };
  }
  if (lower.includes("/buap mcp")) return { handled: true, response: renderMcpStatus(args) };

  return { handled: false, response: "" };
}
