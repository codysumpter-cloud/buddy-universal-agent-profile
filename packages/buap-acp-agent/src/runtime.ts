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

export type AcpClientBridge = {
  clientCapabilities: Record<string, unknown>;
  sendSessionUpdate(sessionId: string, update: Record<string, unknown>): void;
  requestClient(method: string, params: Record<string, unknown>): Promise<unknown>;
};

type RuntimeArgs = {
  text: string;
  state: PersonalizationState;
  profilePack: ProfilePack;
  buap: LoadedBuap;
  session?: SessionState;
  client?: AcpClientBridge;
};

type RuntimeResult = {
  handled: boolean;
  response: string;
};

type PermissionOutcome =
  | { outcome?: "cancelled" }
  | { outcome?: "selected"; optionId?: string };

type FsReadResult = { content?: string };
type TerminalCreateResult = { terminalId?: string };
type TerminalOutputResult = {
  output?: string;
  truncated?: boolean;
  exitStatus?: { exitCode?: number | null; signal?: string | null };
};
type TerminalWaitResult = { exitCode?: number | null; signal?: string | null };

const RUNTIME_COMMANDS = [
  { name: "buap help", description: "Show BUAP ACP runtime commands." },
  { name: "buap read", description: "Read a workspace file safely.", input: { hint: "path=README.md [max_bytes=20000]" } },
  { name: "buap patch", description: "Prepare a diff proposal without writing files.", input: { hint: "path=README.md find=\"old\" replace=\"new\"" } },
  { name: "buap apply", description: "Ask permission, then write through ACP fs/write_text_file.", input: { hint: "path=README.md find=\"old\" replace=\"new\"" } },
  { name: "buap run", description: "Ask permission, then run through ACP terminal/create.", input: { hint: "cmd=\"npm\" args=\"test\"" } },
  { name: "buap ask", description: "Ask the configured model backend.", input: { hint: "prompt=\"summarize this workspace\"" } },
  { name: "buap git status", description: "Show read-only Git status." },
  { name: "buap git diff", description: "Show read-only Git diff.", input: { hint: "[path=README.md]" } },
  { name: "buap mcp", description: "Show MCP server config passed by the ACP client." }
];

export function availableCommands(): Array<Record<string, unknown>> {
  return RUNTIME_COMMANDS;
}

function workspaceRoot(buap: LoadedBuap, session?: SessionState): string {
  return path.resolve(session?.cwd || process.env.BUAP_WORKSPACE_ROOT || buap.repoRoot);
}

function assertSafeRelativePath(workspace: string, requested: string): string {
  if (!requested || requested.trim() === "") throw new Error("Missing `path=` value.");
  if (path.isAbsolute(requested)) throw new Error("Use a workspace-relative path, not an absolute path.");
  const resolved = path.resolve(workspace, requested);
  const normalizedWorkspace = workspace.endsWith(path.sep) ? workspace : `${workspace}${path.sep}`;
  if (resolved !== workspace && !resolved.startsWith(normalizedWorkspace)) {
    throw new Error(`Blocked path outside workspace: ${requested}`);
  }
  return resolved;
}

function parseKeyValues(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /(path|find|replace|prompt|cmd|args|max_bytes|server|tool|payload)=("([^"]*)"|'([^']*)'|([^\s]+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input))) result[match[1]] = match[3] ?? match[4] ?? match[5] ?? "";
  return result;
}

function splitArgs(input: string | undefined): string[] {
  if (!input) return [];
  const args: string[] = [];
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input))) args.push(match[1] ?? match[2] ?? match[3] ?? "");
  return args.filter(Boolean);
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

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function fsCapabilities(client?: AcpClientBridge): { read: boolean; write: boolean } {
  const fsCaps = client?.clientCapabilities?.fs as Record<string, unknown> | undefined;
  return { read: fsCaps?.readTextFile === true, write: fsCaps?.writeTextFile === true };
}

function terminalSupported(client?: AcpClientBridge): boolean {
  return client?.clientCapabilities?.terminal === true;
}

function sendToolCall(args: RuntimeArgs, toolCallId: string, update: Record<string, unknown>): void {
  if (!args.session || !args.client) return;
  args.client.sendSessionUpdate(args.session.sessionId, { sessionUpdate: "tool_call", toolCallId, ...update });
}

function sendToolCallUpdate(args: RuntimeArgs, toolCallId: string, update: Record<string, unknown>): void {
  if (!args.session || !args.client) return;
  args.client.sendSessionUpdate(args.session.sessionId, { sessionUpdate: "tool_call_update", toolCallId, ...update });
}

async function requestToolPermission(args: RuntimeArgs, toolCallId: string, title: string, kind: string, rawInput: Record<string, unknown>): Promise<boolean> {
  if (!args.session || !args.client) return false;
  sendToolCall(args, toolCallId, { title, kind, status: "pending", rawInput });
  const result = (await args.client.requestClient("session/request_permission", {
    sessionId: args.session.sessionId,
    toolCall: { toolCallId, title, kind, status: "pending", rawInput },
    options: [
      { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
      { optionId: "reject-once", name: "Reject", kind: "reject_once" }
    ]
  })) as { outcome?: PermissionOutcome };
  const allowed = result.outcome?.outcome === "selected" && result.outcome.optionId === "allow-once";
  if (!allowed) {
    sendToolCallUpdate(args, toolCallId, {
      status: "failed",
      content: [{ type: "content", content: { type: "text", text: `Permission was not granted for ${title}.` } }],
      rawOutput: result
    });
  }
  return allowed;
}

async function readFileContent(args: RuntimeArgs, workspace: string, relativePath: string, absolutePath: string, maxBytes: number): Promise<{ content: string; source: "client_fs" | "local_fs" }> {
  if (args.session && args.client && fsCapabilities(args.client).read) {
    const result = (await args.client.requestClient("fs/read_text_file", { sessionId: args.session.sessionId, path: absolutePath })) as FsReadResult;
    if (typeof result.content === "string") return { content: result.content, source: "client_fs" };
  }
  const stat = await fs.stat(absolutePath);
  if (!stat.isFile()) throw new Error(`Not a regular file: ${relativePath}`);
  if (stat.size > maxBytes) throw new Error(`File is ${stat.size} bytes, over max read limit ${maxBytes}. Re-run with max_bytes=... if intentional.`);
  return { content: await fs.readFile(absolutePath, "utf8"), source: "local_fs" };
}

async function readWorkspaceFile(args: RuntimeArgs): Promise<string> {
  const values = parseKeyValues(args.text);
  const workspace = workspaceRoot(args.buap, args.session);
  const relativePath = values.path || stripCommandPrefix(args.text, "/buap read");
  const absolutePath = assertSafeRelativePath(workspace, relativePath);
  const maxBytes = Number(values.max_bytes || process.env.BUAP_MAX_READ_BYTES || 20000);
  const toolCallId = randomId("read");
  sendToolCall(args, toolCallId, { title: `Read ${relativePath}`, kind: "read", status: "in_progress", locations: [{ path: absolutePath }], rawInput: { relativePath, maxBytes } });
  const { content, source } = await readFileContent(args, workspace, relativePath, absolutePath, maxBytes);
  sendToolCallUpdate(args, toolCallId, { status: "completed", content: [{ type: "content", content: { type: "text", text: `Read ${relativePath} via ${source}.` } }], rawOutput: { source, bytes: Buffer.byteLength(content, "utf8") } });
  return [`Lil Buddy read \`${relativePath}\` from workspace \`${workspace}\` via \`${source}\`.`, "", "```text", content, "```"].join("\n");
}

function buildSimplePatch(relativePath: string, before: string, after: string): string {
  return [`diff --git a/${relativePath} b/${relativePath}`, `--- a/${relativePath}`, `+++ b/${relativePath}`, "@@", ...before.split("\n").map((line) => `-${line}`), ...after.split("\n").map((line) => `+${line}`)].join("\n");
}

async function buildPatchData(args: RuntimeArgs): Promise<{ workspace: string; relativePath: string; absolutePath: string; find: string; replace: string; content: string; next: string; source: "client_fs" | "local_fs" }> {
  const values = parseKeyValues(args.text);
  const workspace = workspaceRoot(args.buap, args.session);
  const relativePath = values.path;
  const find = values.find;
  const replace = values.replace ?? "";
  if (!relativePath || !find) throw new Error("Patch/apply needs `path=` and `find=`. Optional `replace=` defaults to empty string.");
  const absolutePath = assertSafeRelativePath(workspace, relativePath);
  const { content, source } = await readFileContent(args, workspace, relativePath, absolutePath, Number(process.env.BUAP_MAX_READ_BYTES || 20000));
  if (!content.includes(find)) throw new Error(`Could not find requested text in ${relativePath}. No patch proposed.`);
  return { workspace, relativePath, absolutePath, find, replace, content, next: content.replace(find, replace), source };
}

async function proposePatch(args: RuntimeArgs): Promise<string> {
  try {
    const patchData = await buildPatchData(args);
    const patch = buildSimplePatch(patchData.relativePath, patchData.find, patchData.replace);
    const toolCallId = randomId("patch");
    sendToolCall(args, toolCallId, {
      title: `Propose patch for ${patchData.relativePath}`,
      kind: "edit",
      status: "completed",
      locations: [{ path: patchData.absolutePath }],
      content: [{ type: "diff", path: patchData.absolutePath, oldText: patchData.find, newText: patchData.replace }],
      rawInput: { path: patchData.relativePath, find: patchData.find, replace: patchData.replace },
      rawOutput: { source: patchData.source, resultingBytes: Buffer.byteLength(patchData.next, "utf8") }
    });
    return [
      "Buddy prepared a patch proposal only. It did not write to disk.",
      "",
      "Lil Buddy report:",
      "",
      "```json",
      JSON.stringify({ status: "done", summary: `Prepared replacement patch for ${patchData.relativePath}.`, actions_taken: ["read target file", "confirmed search text exists", "generated patch proposal"], evidence: [patchData.relativePath], risks_or_permissions: ["No file write performed. Apply with `/buap apply ...` to trigger ACP permission + editor-mediated write."], next_recommended_command: "Review the proposed diff, then run `/buap apply` with the same arguments if you want the client to write it." }, null, 2),
      "```",
      "",
      "```diff",
      patch,
      "```",
      "",
      `Resulting file size if applied: ${Buffer.byteLength(patchData.next, "utf8")} bytes.`
    ].join("\n");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Patch/apply needs")) {
      return [error.message, "", "Example:", "", "```text", "/buap patch path=README.md find=\"old text\" replace=\"new text\"", "```"].join("\n");
    }
    throw error;
  }
}

async function applyPatchThroughClient(args: RuntimeArgs): Promise<string> {
  if (!args.session || !args.client) return "Apply is blocked because this ACP client bridge is unavailable. Use `/buap patch` to generate a diff proposal instead.";
  if (!fsCapabilities(args.client).write) return ["Apply is blocked because the ACP client did not advertise `fs.writeTextFile`.", "", "Run `/buap patch ...` to generate a diff proposal, then apply it through the editor manually."].join("\n");
  const patchData = await buildPatchData(args);
  const toolCallId = randomId("apply");
  const allowed = await requestToolPermission(args, toolCallId, `Apply patch to ${patchData.relativePath}`, "edit", { path: patchData.absolutePath, oldText: patchData.find, newText: patchData.replace, source: patchData.source });
  if (!allowed) return `Apply blocked: permission was not granted for \`${patchData.relativePath}\`.`;
  sendToolCallUpdate(args, toolCallId, { status: "in_progress", content: [{ type: "diff", path: patchData.absolutePath, oldText: patchData.find, newText: patchData.replace }] });
  await args.client.requestClient("fs/write_text_file", { sessionId: args.session.sessionId, path: patchData.absolutePath, content: patchData.next });
  sendToolCallUpdate(args, toolCallId, { status: "completed", rawOutput: { path: patchData.absolutePath, resultingBytes: Buffer.byteLength(patchData.next, "utf8") } });
  return [`Applied patch to \`${patchData.relativePath}\` through ACP client filesystem write.`, "", "Lil Buddy report:", "", "```json", JSON.stringify({ status: "done", summary: `Applied editor-mediated write to ${patchData.relativePath}.`, actions_taken: ["read target file", "requested permission", "received allow-once", "called fs/write_text_file"], evidence: [patchData.relativePath], risks_or_permissions: ["Write was performed through ACP client capability after permission."], next_recommended_command: `/buap git diff path=${patchData.relativePath}` }, null, 2), "```"].join("\n");
}

function profileById(profilePack: ProfilePack, id: string): Profile | undefined {
  return profilePack.profiles?.find((profile) => profile.id === id);
}

function compactBuapContext(args: RuntimeArgs): string {
  const buddyProfile = profileById(args.profilePack, args.state.buddy_profile_id);
  const lilBuddyProfile = profileById(args.profilePack, args.state.lil_buddy_profile_id);
  const xcodeProfile = args.buap.files["XCODE_ACP_BUAP.md"] ?? "";
  const fullProfile = args.buap.files["BUAP_FULL.md"] ?? "";
  return ["You are Buddy running inside BUAP ACP.", `User display name: ${args.state.user_display_name ?? "unknown"}`, `Main Buddy display name: ${args.state.buddy_display_name ?? "Buddy"}`, `Lil Buddy display name: ${args.state.lil_buddy_display_name ?? "Lil Buddy"}`, `Main Buddy profile: ${buddyProfile?.display_name ?? args.state.buddy_profile_id} ${buddyProfile?.role ? `(${buddyProfile.role})` : ""}`, `Lil Buddy profile: ${lilBuddyProfile?.display_name ?? args.state.lil_buddy_profile_id} ${lilBuddyProfile?.role ? `(${lilBuddyProfile.role})` : ""}`, "", "ACP adapter profile:", truncateMiddle(xcodeProfile, 5000), "", "BUAP full profile excerpt:", truncateMiddle(fullProfile, 5000)].join("\n");
}

async function modelAnswer(args: RuntimeArgs): Promise<string> {
  const promptFromValue = parseKeyValues(args.text).prompt;
  const userPrompt = promptFromValue || stripCommandPrefix(args.text, "/buap ask");
  const backend = process.env.BUAP_MODEL_BACKEND || "mock";
  if (backend !== "openai-compatible") return ["Model backend is not configured yet, so Buddy stayed in safe local mode.", "", "To enable an OpenAI-compatible backend, set:", "", "```bash", "BUAP_MODEL_BACKEND=openai-compatible", "BUAP_MODEL_BASE_URL=https://api.openai.com/v1", "BUAP_MODEL_NAME=gpt-4.1-mini", "BUAP_MODEL_API_KEY=...", "```", "", "Then retry:", "", "```text", `/buap ask ${userPrompt || "summarize this workspace"}`, "```"].join("\n");
  const baseUrl = process.env.BUAP_MODEL_BASE_URL;
  const model = process.env.BUAP_MODEL_NAME;
  const apiKey = process.env.BUAP_MODEL_API_KEY;
  if (!baseUrl || !model || !apiKey) throw new Error("OpenAI-compatible backend requires BUAP_MODEL_BASE_URL, BUAP_MODEL_NAME, and BUAP_MODEL_API_KEY.");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: [{ role: "system", content: compactBuapContext(args) }, { role: "user", content: userPrompt || "Introduce yourself and explain available BUAP ACP commands." }], temperature: Number(process.env.BUAP_MODEL_TEMPERATURE || 0.2) }) });
  if (!response.ok) throw new Error(`Model backend failed: ${response.status} ${await response.text()}`);
  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
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
    if (values.path) gitArgs.push(path.relative(workspace, assertSafeRelativePath(workspace, values.path)));
  } else {
    title = "git status --short --branch";
    gitArgs = ["status", "--short", "--branch"];
  }
  const { stdout, stderr } = await execFileAsync("git", gitArgs, { cwd: workspace, timeout, maxBuffer: 1024 * 1024 });
  return [`Lil Buddy ran read-only \`${title}\` in \`${workspace}\`.`, "", "```text", stdout || stderr || "(no output)", "```"].join("\n");
}

async function runTerminalCommand(args: RuntimeArgs): Promise<string> {
  if (!args.session || !args.client) return "Run is blocked because this ACP client bridge is unavailable.";
  if (!terminalSupported(args.client)) return "Run is blocked because the ACP client did not advertise terminal support.";
  const values = parseKeyValues(args.text);
  const raw = stripCommandPrefix(args.text, "/buap run");
  const command = values.cmd || raw.split(/\s+/)[0];
  const commandArgs = splitArgs(values.args || raw.slice(command.length).trim());
  const workspace = workspaceRoot(args.buap, args.session);
  if (!command) return ["Run needs `cmd=`, for example:", "", "```text", "/buap run cmd=\"npm\" args=\"test\"", "```"].join("\n");
  const toolCallId = randomId("run");
  const allowed = await requestToolPermission(args, toolCallId, `Run ${command} ${commandArgs.join(" ")}`.trim(), "execute", { command, args: commandArgs, cwd: workspace });
  if (!allowed) return `Run blocked: permission was not granted for \`${command}\`.`;
  sendToolCallUpdate(args, toolCallId, { status: "in_progress", content: [{ type: "content", content: { type: "text", text: `Starting terminal command: ${command} ${commandArgs.join(" ")}`.trim() } }] });
  const created = (await args.client.requestClient("terminal/create", { sessionId: args.session.sessionId, command, args: commandArgs, cwd: workspace, outputByteLimit: Number(process.env.BUAP_TERMINAL_OUTPUT_LIMIT || 1048576) })) as TerminalCreateResult;
  if (!created.terminalId) throw new Error("ACP terminal/create did not return a terminalId.");
  sendToolCallUpdate(args, toolCallId, { content: [{ type: "terminal", terminalId: created.terminalId }] });
  const exit = (await args.client.requestClient("terminal/wait_for_exit", { sessionId: args.session.sessionId, terminalId: created.terminalId })) as TerminalWaitResult;
  const output = (await args.client.requestClient("terminal/output", { sessionId: args.session.sessionId, terminalId: created.terminalId })) as TerminalOutputResult;
  await args.client.requestClient("terminal/release", { sessionId: args.session.sessionId, terminalId: created.terminalId });
  const ok = (exit.exitCode ?? output.exitStatus?.exitCode ?? 0) === 0;
  sendToolCallUpdate(args, toolCallId, { status: ok ? "completed" : "failed", rawOutput: { exit, output } });
  return [`Terminal command completed: \`${command} ${commandArgs.join(" ")}\`.`, "", "```text", output.output || "(no output)", "```", "", `Exit: ${JSON.stringify(exit)}${output.truncated ? " (output truncated)" : ""}`].join("\n");
}

function renderMcpStatus(args: RuntimeArgs): string {
  const servers = args.session?.mcpServers ?? [];
  const values = parseKeyValues(args.text);
  if (args.text.toLowerCase().includes("/buap mcp invoke")) return ["MCP invocation is not executed yet.", "", "Lil Buddy report:", "", "```json", JSON.stringify({ status: "blocked", summary: "MCP server config is visible from ACP session context, but MCP-over-ACP invocation is not wired in this package yet.", requested: { server: values.server, tool: values.tool, payload: values.payload }, actions_taken: ["inspected ACP session MCP server config", "blocked direct MCP execution"], evidence: servers, risks_or_permissions: ["Direct MCP tool calls can mutate external systems; this requires explicit ACP/MCP permission handling first."], next_recommended_command: "/buap mcp" }, null, 2), "```"].join("\n");
  return ["ACP session MCP context:", "", "```json", JSON.stringify({ count: servers.length, servers }, null, 2), "```", "", "Direct MCP tool execution should be added only after ACP/MCP capability and permission handling is wired."].join("\n");
}

function renderHelp(): string {
  return [
    "BUAP ACP commands:",
    "",
    "- `/buap profiles` — list BMO council profile IDs",
    "- `/buap personalize user=\"Cody\" buddy=\"Buddy\" lil_buddy=\"Finn\" buddy_profile=bmo lil_buddy_profile=finn`",
    "- `/buap read path=README.md [max_bytes=20000]` — read a workspace file safely",
    "- `/buap patch path=README.md find=\"old\" replace=\"new\"` — propose a diff only; no file write",
    "- `/buap apply path=README.md find=\"old\" replace=\"new\"` — request permission and write through ACP fs/write_text_file",
    "- `/buap run cmd=\"npm\" args=\"test\"` — request permission and run through ACP terminal/create",
    "- `/buap ask prompt=\"...\"` — ask the configured model backend, or get backend setup instructions",
    "- `/buap git status` — read-only git status",
    "- `/buap git diff [path=README.md]` — read-only git diff",
    "- `/buap mcp` — show MCP server config passed by the ACP client",
    "- `/buap mcp invoke server=\"...\" tool=\"...\" payload=\"{}\"` — currently reports a blocked MCP invocation plan",
    "",
    "Destructive actions require ACP client capabilities plus explicit permission."
  ].join("\n");
}

export async function handleRuntimeCommand(args: RuntimeArgs): Promise<RuntimeResult> {
  const lower = args.text.trim().toLowerCase();
  if (lower.includes("/buap help")) return { handled: true, response: renderHelp() };
  if (lower.includes("/buap read")) return { handled: true, response: await readWorkspaceFile(args) };
  if (lower.includes("/buap patch")) return { handled: true, response: await proposePatch(args) };
  if (lower.includes("/buap apply")) return { handled: true, response: await applyPatchThroughClient(args) };
  if (lower.includes("/buap run")) return { handled: true, response: await runTerminalCommand(args) };
  if (lower.includes("/buap ask")) return { handled: true, response: await modelAnswer(args) };
  if (lower.includes("/buap git status") || lower.includes("/buap git diff")) return { handled: true, response: await gitReadOnly(args) };
  if (lower.includes("/buap mcp")) return { handled: true, response: renderMcpStatus(args) };
  return { handled: false, response: "" };
}
