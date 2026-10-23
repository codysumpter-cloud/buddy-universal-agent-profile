/**
 * BUAP <-> Hermes API Server bridge.
 * Hermes owns the execution, skills, memory, delegation, tools and its gateway.
 * This adapter never claims those subsystems exist in BUAP itself.
 * Localhost-only by default; remote endpoint requires HTTPS + explicit hostname allowlist.
 */
export const HERMES_FEATURES = Object.freeze([
  {id:"agent_loop",status:"delegated",requires:"Hermes API Server"},
  {id:"providers_and_fallback",status:"host-managed",requires:"Hermes configuration"},
  {id:"terminal_files_and_checkpoints",status:"host-managed",requires:"Hermes toolsets and approval policy"},
  {id:"web_search_and_extract",status:"host-managed",requires:"Hermes web toolset and provider"},
  {id:"browser_automation",status:"host-managed",requires:"Hermes browser backend"},
  {id:"skills_and_learning",status:"host-managed",requires:"Hermes skills and filesystem"},
  {id:"persistent_sessions_and_recall",status:"host-managed",requires:"Hermes gateway and state store"},
  {id:"cron_and_delivery",status:"host-managed",requires:"Hermes cron and gateway configuration"},
  {id:"subagent_delegation",status:"host-managed",requires:"Hermes delegate_task toolset"},
  {id:"mcp_and_plugins",status:"host-managed",requires:"Hermes MCP and plugin settings"},
  {id:"voice_and_tts",status:"host-managed",requires:"Hermes voice/messaging configuration"},
  {id:"vision_and_image_generation",status:"host-managed",requires:"Hermes multimodal toolsets"},
  {id:"messaging_gateway_and_bot_mode",status:"host-managed",requires:"Hermes gateway service and platform auth"},
  {id:"api_server",status:"bridged",requires:"API_SERVER_ENABLED and API_SERVER_KEY"},
  {id:"acp_editor_host",status:"buap-native",requires:"BUAP ACP agent host"}
]);

function truthy(value) { return value === "1" || value === "true"; }
function isLoopback(hostname) { return ["127.0.0.1","localhost","[::1]"].includes(hostname.toLowerCase()); }

export function hermesConfig(env = process.env) {
  const baseUrl = (env.BUAP_HERMES_BASE_URL || "http://127.0.0.1:8642/v1").trim();
  const apiKey = env.BUAP_HERMES_API_KEY || "";
  const model = (env.BUAP_HERMES_MODEL_NAME || "hermes-agent").trim();
  const remoteEnabled = truthy(env.BUAP_HERMES_ALLOW_REMOTE);
  const allowedHosts = (env.BUAP_HERMES_ALLOWED_HOSTS || "").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
  return {baseUrl,apiKey,model,remoteEnabled,allowedHosts};
}

export function validateHermesConfig(config, {requireKey = true} = {}) {
  let url;
  try { url = new URL(config.baseUrl); }
  catch { throw new Error("Invalid BUAP_HERMES_BASE_URL."); }
  if (url.username || url.password || url.search || url.hash) throw new Error("Hermes URL must not contain credentials, query or fragment.");
  if (url.pathname.replace(/\/$/, "") !== "/v1") throw new Error("Hermes URL must end in /v1.");
  if (!config.model || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(config.model)) throw new Error("Invalid Hermes model name.");
  const local = isLoopback(url.hostname);
  if (local) {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Hermes local URL must use HTTP(S).");
  } else {
    if (!config.remoteEnabled || url.protocol !== "https:" || !config.allowedHosts.includes(url.hostname.toLowerCase())) {
      throw new Error("Remote Hermes requires HTTPS, BUAP_HERMES_ALLOW_REMOTE=1 and an exact hostname in BUAP_HERMES_ALLOWED_HOSTS.");
    }
  }
  if (requireKey && !config.apiKey) throw new Error("Hermes API key is missing (BUAP_HERMES_API_KEY).");
  return url.href.replace(/\/$/, "");
}

function authHeaders(config) {
  return {"content-type":"application/json",authorization:"Bearer " + config.apiKey};
}

async function requestHermes(config, route, {method = "GET", payload, fetchImpl = fetch, timeoutMs = 120000} = {}) {
  const base = validateHermesConfig(config);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) throw new Error("Hermes timeout must be 1000–300000 ms.");
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response = await fetchImpl(base + "/" + route, {
      method,headers:authHeaders(config),
      ...(payload !== undefined ? {body:JSON.stringify(payload)} : {}),
      signal:controller.signal,
      redirect:"error"
    });
    // Do not reflect server error bodies; a remote proxy might echo tokens or prompt content.
    if (!response.ok) throw new Error("Hermes request failed with HTTP " + response.status + ".");
    const size = Number(response.headers?.get?.("content-length") || 0);
    if (size > 4*1024*1024) throw new Error("Hermes response exceeds 4 MiB limit.");
    const text = await response.text();
    if (Buffer.byteLength(text,"utf8") > 4*1024*1024) throw new Error("Hermes response exceeds 4 MiB limit.");
    try { return JSON.parse(text); }
    catch { throw new Error("Hermes returned invalid JSON."); }
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Hermes request timed out.");
    if (error instanceof Error && /^(Hermes|Remote)/.test(error.message)) throw error;
    throw new Error("Hermes connection failed. Check the local API server, URL and authorization.");
  } finally { clearTimeout(timer); }
}

/** Read-only API handshake; proves the model endpoint, not availability of Hermes toolsets. */
export async function probeHermes(config = hermesConfig(), options = {}) {
  const json = await requestHermes(config,"models",options);
  if (!Array.isArray(json?.data)) throw new Error("Hermes /models response is not compatible.");
  return {reachable:true,models:json.data.map(x=>String(x.id||"")).filter(Boolean).slice(0,32),toolsetsVerified:false};
}

function extractContent(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter(x=>x?.type === "text" && typeof x.text === "string").map(x=>x.text).join("\n");
  return "";
}

/** Send ONE message to Hermes. All tools/memory/scheduled jobs remain in Hermes; no implicit retries. */
export async function askHermes({prompt,systemContext = "",config = hermesConfig(),fetchImpl = fetch,timeoutMs = 120000} = {}) {
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 100000) throw new Error("Hermes prompt must be nonempty and at most 100000 characters.");
  if (typeof systemContext !== "string" || systemContext.length > 32000) throw new Error("BUAP system context exceeds 32000 characters.");
  const messages = [
    ...(systemContext ? [{role:"system",content:systemContext}] : []),
    {role:"user",content:prompt}
  ];
  const json = await requestHermes(config,"chat/completions",{
    method:"POST",payload:{model:config.model,stream:false,messages},fetchImpl,timeoutMs
  });
  const content = extractContent(json?.choices?.[0]?.message?.content).trim();
  if (!content) throw new Error("Hermes returned no assistant text. Check Hermes execution logs.");
  return {text:content,model:json.model || config.model,usage:json.usage || null,completionId:json.id || null};
}

export function hermesStatus(env = process.env) {
  const config = hermesConfig(env);
  let endpointValid = false, issue = null;
  try { validateHermesConfig(config,{requireKey:false}); endpointValid=true; }
  catch (error) { issue = error instanceof Error ? error.message : String(error); }
  return {
    configured: Boolean(config.apiKey && endpointValid),
    endpointValid, keyPresent:Boolean(config.apiKey),
    model:config.model, baseUrl: endpointValid ? config.baseUrl : null,
    issue, apiReachable:"not_checked", toolsetsVerified:false,
    capabilities:HERMES_FEATURES
  };
}
