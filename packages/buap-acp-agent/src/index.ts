#!/usr/bin/env node
import { createInterface } from "node:readline";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const PROTOCOL_VERSION = 1;
const AGENT_NAME = "buap-acp-agent";
const AGENT_TITLE = "Buddy Universal Agent Profile";
const AGENT_VERSION = "0.1.0";

const REQUIRED_BUAP_FILES = [
  "XCODE_ACP_BUAP.md",
  "BUAP_FULL.md",
  "personalization/PERSONALIZATION_HANDSHAKE.md",
  "personalization/BUDDY_LIL_BUDDY_PROFILE_SELECTION.md",
  "personalization/bmo-council-personality-profiles.json",
  "schemas/buap-personalization.schema.json"
];

type RequestId = string | number | null;

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: RequestId;
  method?: string;
  params?: Record<string, unknown>;
};

type PersonalizationState = {
  user_display_name?: string;
  buddy_display_name?: string;
  lil_buddy_display_name?: string;
  buddy_profile_id: string;
  lil_buddy_profile_id: string;
  selected_profile_pack_id: string;
  updated_at?: string;
};

type SessionState = {
  sessionId: string;
  cwd?: string;
  mcpServers: unknown[];
  createdAt: string;
};

type Profile = {
  id: string;
  display_name?: string;
  role?: string;
  best_for?: string[];
  default_slot_recommendation?: string;
};

type ProfilePack = {
  profile_pack_id?: string;
  profiles?: Profile[];
};

type LoadedBuap = {
  repoRoot: string;
  files: Record<string, string>;
  profilePack: ProfilePack;
};

const sessions = new Map<string, SessionState>();
let clientCapabilities: Record<string, unknown> = {};

function dirnameFromImportMeta(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

function resolveRepoRoot(): string {
  if (process.env.BUAP_REPO_ROOT) {
    return path.resolve(process.env.BUAP_REPO_ROOT);
  }

  const here = dirnameFromImportMeta();
  return path.resolve(here, "../../..");
}

async function readText(repoRoot: string, relativePath: string): Promise<string> {
  return fs.readFile(path.join(repoRoot, relativePath), "utf8");
}

async function loadBuap(): Promise<LoadedBuap> {
  const repoRoot = resolveRepoRoot();
  const files: Record<string, string> = {};

  for (const relativePath of REQUIRED_BUAP_FILES) {
    files[relativePath] = await readText(repoRoot, relativePath);
  }

  const profilePack = JSON.parse(
    files["personalization/bmo-council-personality-profiles.json"]
  ) as ProfilePack;

  return { repoRoot, files, profilePack };
}

function defaultPersonalization(profilePack: ProfilePack): PersonalizationState {
  return {
    buddy_profile_id: "bmo",
    lil_buddy_profile_id: "finn",
    selected_profile_pack_id: profilePack.profile_pack_id ?? "bmo-council-v1"
  };
}

function personalizationPath(): string | null {
  return process.env.BUAP_PERSONALIZATION_FILE
    ? path.resolve(process.env.BUAP_PERSONALIZATION_FILE)
    : null;
}

async function loadPersonalization(profilePack: ProfilePack): Promise<PersonalizationState> {
  const fallback = defaultPersonalization(profilePack);
  const configuredPath = personalizationPath();
  if (!configuredPath) return fallback;

  try {
    const raw = await fs.readFile(configuredPath, "utf8");
    return { ...fallback, ...(JSON.parse(raw) as Partial<PersonalizationState>) };
  } catch (error) {
    return fallback;
  }
}

async function savePersonalization(state: PersonalizationState): Promise<void> {
  const configuredPath = personalizationPath();
  if (!configuredPath) return;

  await fs.mkdir(path.dirname(configuredPath), { recursive: true });
  await fs.writeFile(configuredPath, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function hasFirstRunNames(state: PersonalizationState): boolean {
  return Boolean(
    state.user_display_name &&
      state.buddy_display_name &&
      state.lil_buddy_display_name
  );
}

function extractTextContent(prompt: unknown): string {
  if (!Array.isArray(prompt)) return "";

  return prompt
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const typed = block as Record<string, unknown>;
      if (typed.type === "text" && typeof typed.text === "string") return typed.text;
      if (typed.type === "resource") {
        const resource = typed.resource as Record<string, unknown> | undefined;
        const uri = typeof resource?.uri === "string" ? resource.uri : "embedded resource";
        const text = typeof resource?.text === "string" ? resource.text : "";
        return text ? `\n[${uri}]\n${text}` : `\n[${uri}]`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function parseKeyValues(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /(user|buddy|lil_buddy|buddy_profile|lil_buddy_profile|profile_pack)=("([^"]*)"|'([^']*)'|([^\s]+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input))) {
    result[match[1]] = match[3] ?? match[4] ?? match[5] ?? "";
  }
  return result;
}

function applyPersonalizationCommand(
  text: string,
  current: PersonalizationState,
  profilePack: ProfilePack
): PersonalizationState | null {
  if (!text.toLowerCase().includes("/buap personalize")) return null;

  const values = parseKeyValues(text);
  const next: PersonalizationState = {
    ...current,
    user_display_name: values.user || current.user_display_name,
    buddy_display_name: values.buddy || current.buddy_display_name,
    lil_buddy_display_name: values.lil_buddy || current.lil_buddy_display_name,
    buddy_profile_id: values.buddy_profile || current.buddy_profile_id || "bmo",
    lil_buddy_profile_id: values.lil_buddy_profile || current.lil_buddy_profile_id || "finn",
    selected_profile_pack_id:
      values.profile_pack || current.selected_profile_pack_id || profilePack.profile_pack_id || "bmo-council-v1",
    updated_at: new Date().toISOString()
  };

  return next;
}

function profileById(profilePack: ProfilePack, id: string): Profile | undefined {
  return profilePack.profiles?.find((profile) => profile.id === id);
}

function renderProfile(profile: Profile | undefined, fallbackId: string): string {
  if (!profile) return fallbackId;
  const role = profile.role ? ` — ${profile.role}` : "";
  return `${profile.display_name ?? profile.id}${role}`;
}

function renderProfileList(profilePack: ProfilePack): string {
  const profiles = profilePack.profiles ?? [];
  return profiles
    .map((profile) => {
      const bestFor = profile.best_for?.length ? ` Best for: ${profile.best_for.join(", ")}.` : "";
      return `- \`${profile.id}\` — ${profile.display_name ?? profile.id}${profile.role ? `, ${profile.role}` : ""}.${bestFor}`;
    })
    .join("\n");
}

function renderFirstRun(profilePack: ProfilePack): string {
  const profiles = renderProfileList(profilePack);
  return [
    "Before I lock in your setup, what should I call you, what do you want your main Buddy to be called, and what do you want your Lil Buddy to be called?",
    "",
    "Reply in this ACP chat with:",
    "",
    "```text",
    "/buap personalize user=\"Cody\" buddy=\"Buddy\" lil_buddy=\"Finn\" buddy_profile=bmo lil_buddy_profile=finn",
    "```",
    "",
    "Defaults if you just want the classic setup:",
    "",
    "- Main Buddy profile: `bmo`",
    "- Lil Buddy profile: `finn`",
    "",
    "Available profile IDs:",
    profiles
  ].join("\n");
}

function renderOnline(state: PersonalizationState, profilePack: ProfilePack): string {
  const buddyProfile = renderProfile(profileById(profilePack, state.buddy_profile_id), state.buddy_profile_id);
  const lilBuddyProfile = renderProfile(
    profileById(profilePack, state.lil_buddy_profile_id),
    state.lil_buddy_profile_id
  );

  return [
    `**${state.buddy_display_name ?? "Buddy"} is online.**`,
    "",
    `User: ${state.user_display_name ?? "unknown"}`,
    `Main Buddy: ${state.buddy_display_name ?? "Buddy"} (${buddyProfile})`,
    `Lil Buddy: ${state.lil_buddy_display_name ?? "Lil Buddy"} (${lilBuddyProfile})`,
    "",
    "Lil Buddy report:",
    "",
    "```json",
    JSON.stringify(
      {
        status: "done",
        summary: "BUAP ACP agent booted, loaded personalization/profile defaults, and is ready for editor-scoped work.",
        actions_taken: [
          "loaded BUAP prompt files",
          "loaded BMO council profile pack",
          "negotiated ACP session lifecycle"
        ],
        evidence: REQUIRED_BUAP_FILES,
        risks_or_permissions: [
          "This first package does not bypass editor file, terminal, MCP, source-control, or permission boundaries.",
          "Tool execution should be added only through ACP client capabilities."
        ],
        next_recommended_command: "Wire an LLM/tool backend behind Buddy and route file operations through ACP client capabilities."
      },
      null,
      2
    ),
    "```"
  ].join("\n");
}

async function renderPromptResponse(
  text: string,
  state: PersonalizationState,
  profilePack: ProfilePack
): Promise<{ response: string; state: PersonalizationState }> {
  const commandState = applyPersonalizationCommand(text, state, profilePack);
  if (commandState) {
    await savePersonalization(commandState);
    return {
      state: commandState,
      response: [
        "Personalization saved for this BUAP ACP agent.",
        "",
        renderOnline(commandState, profilePack)
      ].join("\n")
    };
  }

  if (text.trim().toLowerCase().includes("/buap profiles")) {
    return { state, response: renderProfileList(profilePack) };
  }

  if (!hasFirstRunNames(state)) {
    return { state, response: renderFirstRun(profilePack) };
  }

  return { state, response: renderOnline(state, profilePack) };
}

function send(message: unknown): void {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function sendResponse(id: RequestId | undefined, result: unknown): void {
  if (id === undefined) return;
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id: RequestId | undefined, code: number, message: string): void {
  if (id === undefined) return;
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function sendSessionUpdate(sessionId: string, update: Record<string, unknown>): void {
  send({
    jsonrpc: "2.0",
    method: "session/update",
    params: { sessionId, update }
  });
}

function makeSessionId(): string {
  return `sess_${crypto.randomBytes(8).toString("hex")}`;
}

async function handleMessage(
  message: JsonRpcMessage,
  buap: LoadedBuap,
  personalization: { value: PersonalizationState }
): Promise<void> {
  if (message.jsonrpc !== "2.0" || !message.method) {
    sendError(message.id, -32600, "Invalid JSON-RPC 2.0 ACP message");
    return;
  }

  switch (message.method) {
    case "initialize": {
      clientCapabilities = (message.params?.clientCapabilities as Record<string, unknown>) ?? {};
      sendResponse(message.id, {
        protocolVersion: PROTOCOL_VERSION,
        agentCapabilities: {
          loadSession: false,
          promptCapabilities: {
            embeddedContext: true
          },
          sessionCapabilities: {
            close: {}
          },
          _meta: {
            buap: {
              profile: "XCODE_ACP_BUAP.md",
              defaultBuddyProfile: "bmo",
              defaultLilBuddyProfile: "finn"
            }
          }
        },
        agentInfo: {
          name: AGENT_NAME,
          title: AGENT_TITLE,
          version: AGENT_VERSION
        },
        authMethods: []
      });
      return;
    }

    case "session/new": {
      const sessionId = makeSessionId();
      sessions.set(sessionId, {
        sessionId,
        cwd: typeof message.params?.cwd === "string" ? message.params.cwd : undefined,
        mcpServers: Array.isArray(message.params?.mcpServers) ? message.params.mcpServers : [],
        createdAt: new Date().toISOString()
      });
      sendResponse(message.id, { sessionId });
      return;
    }

    case "session/close": {
      const sessionId = String(message.params?.sessionId ?? "");
      sessions.delete(sessionId);
      sendResponse(message.id, {});
      return;
    }

    case "session/cancel": {
      sendResponse(message.id, { stopReason: "cancelled" });
      return;
    }

    case "session/prompt": {
      const sessionId = String(message.params?.sessionId ?? "");
      if (!sessions.has(sessionId)) {
        sendError(message.id, -32001, `Unknown ACP session: ${sessionId}`);
        return;
      }

      const promptText = extractTextContent(message.params?.prompt);
      const messageId = `msg_${crypto.randomBytes(6).toString("hex")}`;

      sendSessionUpdate(sessionId, {
        sessionUpdate: "plan",
        entries: [
          {
            content: "Load BUAP and selected Buddy/Lil Buddy profiles",
            priority: "high",
            status: "completed"
          },
          {
            content: "Confirm first-run personalization before doing app/editor work",
            priority: "high",
            status: hasFirstRunNames(personalization.value) ? "completed" : "pending"
          },
          {
            content: "Stay inside ACP client capabilities for file, terminal, MCP, and source-control operations",
            priority: "high",
            status: "completed"
          }
        ]
      });

      const rendered = await renderPromptResponse(promptText, personalization.value, buap.profilePack);
      personalization.value = rendered.state;

      sendSessionUpdate(sessionId, {
        sessionUpdate: "agent_message_chunk",
        messageId,
        content: {
          type: "text",
          text: rendered.response
        }
      });

      sendResponse(message.id, { stopReason: "end_turn" });
      return;
    }

    case "buap/status": {
      sendResponse(message.id, {
        repoRoot: buap.repoRoot,
        loadedFiles: Object.keys(buap.files),
        profilePack: buap.profilePack.profile_pack_id,
        personalization: personalization.value,
        clientCapabilities
      });
      return;
    }

    default:
      sendError(message.id, -32601, `Unsupported ACP method: ${message.method}`);
  }
}

async function main(): Promise<void> {
  const buap = await loadBuap();
  const personalization = { value: await loadPersonalization(buap.profilePack) };
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

  process.stderr.write(`${AGENT_NAME} ready; repo=${buap.repoRoot}\n`);

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let message: JsonRpcMessage;
    try {
      message = JSON.parse(trimmed) as JsonRpcMessage;
    } catch (error) {
      sendError(null, -32700, "Parse error: ACP stdio messages must be newline-delimited JSON-RPC");
      return;
    }

    void handleMessage(message, buap, personalization).catch((error: unknown) => {
      const text = error instanceof Error ? error.message : String(error);
      sendError(message.id, -32000, text);
    });
  });
}

void main().catch((error: unknown) => {
  const text = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${AGENT_NAME} failed to start:\n${text}\n`);
  process.exitCode = 1;
});
