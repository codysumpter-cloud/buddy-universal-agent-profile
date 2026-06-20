#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const full = process.argv.includes("--full");

const requiredRepoFiles = [
  ["BUAP_FULL.md", "BUAP_FULL.md"],
  ["XCODE_ACP_BUAP.md", "XCODE_ACP_BUAP.md"],
  ["SIRI_BUAP.md", "SIRI_BUAP.md"],
  ["CODEX_PET_BUAP.md", "CODEX_PET_BUAP.md"],
  ["AGENTS.md", "AGENTS.md"],
  ["CODEX.md", "CODEX.md"],
  ["personalization handshake", "personalization/PERSONALIZATION_HANDSHAKE.md"],
  ["profile selection", "personalization/BUDDY_LIL_BUDDY_PROFILE_SELECTION.md"],
  ["personalization profile pack", "personalization/bmo-council-personality-profiles.json"]
];

const requiredAcpFiles = [
  ["package.json", "packages/buap-acp-agent/package.json"],
  ["src/index.ts", "packages/buap-acp-agent/src/index.ts"],
  ["src/runtime.ts", "packages/buap-acp-agent/src/runtime.ts"],
  ["smoke script", "packages/buap-acp-agent/scripts/smoke.mjs"],
  ["local smoke script", "packages/buap-acp-agent/scripts/local-smoke-check.mjs"],
  ["local install guide", "packages/buap-acp-agent/docs/local-install-and-xcode-smoke.md"],
  ["hatch-pet package", "packages/buap-hatch-pet/package.json"]
];

const buildOutputFiles = [
  ["dist/index.js", "packages/buap-acp-agent/dist/index.js"],
  ["dist/runtime.js", "packages/buap-acp-agent/dist/runtime.js"]
];

const requiredPluginFiles = [
  ["marketplace manifest", ".claude-plugin/marketplace.json"],
  ["Claude plugin manifest", "plugins/buap/.claude-plugin/plugin.json"],
  ["Codex plugin manifest", "plugins/buap/.codex-plugin/plugin.json"],
  ["lil-buddy subagent", "plugins/buap/agents/lil-buddy.md"],
  ["repo-audit skill", "plugins/buap/skills/buap-repo-audit/SKILL.md"],
  ["fix-pr-checks skill", "plugins/buap/skills/buap-fix-pr-checks/SKILL.md"],
  ["migrate-repo skill", "plugins/buap/skills/buap-migrate-repo/SKILL.md"],
  ["libresprite-buddy skill", "plugins/buap/skills/libresprite-buddy/SKILL.md"],
  ["buap-audit command", "plugins/buap/commands/buap-audit.md"],
  ["buap-handoff command", "plugins/buap/commands/buap-handoff.md"],
  ["Claude hooks manifest", "plugins/buap/hooks/hooks.json"],
  ["Codex hooks manifest", "plugins/buap/hooks.json"],
  ["safety guard hook", "plugins/buap/hooks/buap-safety-guard.mjs"],
  ["session reminder hook", "plugins/buap/hooks/buap-session-reminder.mjs"],
  ["Codex safety guard hook", "plugins/buap/hooks/buap-codex-safety-guard.mjs"],
  ["Codex session reminder hook", "plugins/buap/hooks/buap-codex-session-reminder.mjs"]
];

const optionalEnv = [
  "BUAP_REPO_ROOT",
  "BUAP_WORKSPACE_ROOT",
  "BUAP_PERSONALIZATION_FILE",
  "BUAP_MODEL_BACKEND",
  "BUAP_MODEL_BASE_URL",
  "BUAP_MODEL_NAME",
  "BUAP_MODEL_API_KEY"
];

let failures = 0;
let warnings = 0;

function pass(message) {
  console.log(`✅ ${message}`);
}

function warn(message) {
  warnings += 1;
  console.log(`⚠️ ${message}`);
}

function fail(message) {
  failures += 1;
  console.log(`❌ ${message}`);
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function absoluteExists(absolutePath) {
  return fs.existsSync(absolutePath);
}

function executableOnPath(command) {
  for (const entry of (process.env.PATH || "").split(path.delimiter)) {
    if (!entry) continue;
    const candidate = path.join(entry, command);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Try the next PATH entry.
    }
  }
  return "";
}

function exactExecutable(absolutePath) {
  try {
    const parent = path.dirname(absolutePath);
    const base = path.basename(absolutePath);
    if (!fs.readdirSync(parent).includes(base)) return "";
    fs.accessSync(absolutePath, fs.constants.X_OK);
    return absolutePath;
  } catch {
    return "";
  }
}

function toolHelpWorks(cliPath) {
  if (!cliPath) return "unknown";
  try {
    execFileSync(cliPath, ["--help"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10000 });
    return "works";
  } catch {
    return "fails";
  }
}

function spriteToolStatus({ label, command, appPath, executableNames }) {
  const pathExecutable = executableOnPath(command);
  let bundledExecutable = "";
  for (const name of executableNames) {
    bundledExecutable = exactExecutable(path.join(appPath, "Contents", "MacOS", name));
    if (bundledExecutable) break;
  }
  const cliPath = pathExecutable || bundledExecutable;
  console.log(`${label} app: ${absoluteExists(appPath) ? "present" : "missing"}`);
  console.log(`${label} executable: ${cliPath || "missing"}`);
  console.log(`${label} CLI help: ${toolHelpWorks(cliPath)}`);
  console.log(`${label} on PATH: ${pathExecutable ? "yes" : "no"}`);
  if (cliPath && !pathExecutable) {
    console.log(`${label} direct command: ${cliPath} --help`);
    console.log(`${label} optional alias: alias ${command}="${cliPath}"`);
  }
}

function runVersion(label, command, args) {
  try {
    const output = execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    pass(`${label} ${output}`);
  } catch (error) {
    fail(`${label} unavailable (${error.message})`);
  }
}

function runOptionalVersion(label, command, args) {
  try {
    const output = execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    pass(`${label} ${output || "available"}`);
  } catch (error) {
    warn(`${label} unavailable optional (${error.message})`);
  }
}

function commandOutput(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    return `${error.stdout?.toString?.() ?? ""}\n${error.stderr?.toString?.() ?? ""}`;
  }
}

function runPackageCheck(command, args) {
  const packageRoot = path.join(repoRoot, "packages", "buap-acp-agent");
  const rendered = [command, ...args].join(" ");
  try {
    execFileSync(command, args, {
      cwd: packageRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    pass(rendered);
  } catch (error) {
    fail(`${rendered} failed`);
    const stdout = error.stdout?.toString?.().trim();
    const stderr = error.stderr?.toString?.().trim();
    if (stdout) console.log(stdout);
    if (stderr) console.log(stderr);
  }
}

console.log("BUAP Doctor");

console.log("\nRepo:");
if (path.basename(repoRoot) === "buddy-universal-agent-profile" && exists("README.md")) {
  pass(`repo root ${repoRoot}`);
} else {
  fail(`not running from buddy-universal-agent-profile (${repoRoot})`);
}
for (const [label, relativePath] of requiredRepoFiles) {
  exists(relativePath) ? pass(label) : fail(`${label} missing (${relativePath})`);
}

console.log("\nTools:");
runVersion("node", "node", ["--version"]);
runVersion("npm", "npm", ["--version"]);
runVersion("git", "git", ["--version"]);
runOptionalVersion("npx skills", "npx", ["skills", "--version"]);

console.log("\nACP Agent:");
for (const [label, relativePath] of requiredAcpFiles) {
  exists(relativePath) ? pass(label) : fail(`${label} missing (${relativePath})`);
}
for (const [label, relativePath] of buildOutputFiles) {
  exists(relativePath) ? pass(`build output ${label}`) : warn(`build output ${label} missing; run npm run build`);
}

console.log("\nClaude Code plugin:");
for (const [label, relativePath] of requiredPluginFiles) {
  exists(relativePath) ? pass(label) : fail(`${label} missing (${relativePath})`);
}

console.log("\nPersonalization:");
const configuredPersonalization = process.env.BUAP_PERSONALIZATION_FILE;
const defaultPersonalization = path.join(process.env.HOME || "", ".buap", "personalization.json");
if (configuredPersonalization) {
  fs.existsSync(configuredPersonalization)
    ? pass(`BUAP_PERSONALIZATION_FILE exists: ${configuredPersonalization}`)
    : warn(`BUAP_PERSONALIZATION_FILE points to missing optional file: ${configuredPersonalization}`);
} else if (fs.existsSync(defaultPersonalization)) {
  pass(`default personalization exists: ${defaultPersonalization}`);
} else {
  warn(`default personalization missing optional: ${defaultPersonalization}`);
}

console.log("\nBUAP memory:");
const defaultVaultPath = "/Users/prismtek/Prismtek/knowledge-vault";
const configuredVaultPath = process.env.BUAP_OBSIDIAN_VAULT || process.env.KNOWLEDGE_VAULT_PATH || "";
const vaultPath = configuredVaultPath || defaultVaultPath;
const whatYouKnowPath = path.join(vaultPath, "99-System", "BUAP", "WHAT_YOU_KNOW_ABOUT_ME.md");
const hatchContextPath = path.join(vaultPath, "99-System", "BUAP", "BUAP_HATCH_CONTEXT.md");
const profilePairingPath = path.join(vaultPath, "99-System", "BUAP", "BUAP_PROFILE_PAIRING.md");
const toolingContextPath = path.join(vaultPath, "99-System", "BUAP", "BUAP_TOOLING_CONTEXT.md");
const repoHatchContextPath = "personalization/BUAP_HATCH_CONTEXT.md";
const repoMemoryPointerPath = "personalization/WHAT_YOU_KNOW_ABOUT_ME_POINTER.md";

console.log(`Obsidian vault path: ${vaultPath}`);
console.log(`Obsidian vault source: ${configuredVaultPath ? "configured" : "default Cody path"}`);
absoluteExists(vaultPath)
  ? pass("Obsidian vault path detected")
  : warn("Obsidian vault path missing; BUAP still runs, but Obsidian is strongly recommended for the complete experience");
absoluteExists(whatYouKnowPath)
  ? pass(`WHAT_YOU_KNOW_ABOUT_ME.md present: ${whatYouKnowPath}`)
  : warn(`WHAT_YOU_KNOW_ABOUT_ME.md missing: ${whatYouKnowPath}`);
absoluteExists(hatchContextPath)
  ? pass(`BUAP_HATCH_CONTEXT.md present: ${hatchContextPath}`)
  : warn(`BUAP_HATCH_CONTEXT.md missing: ${hatchContextPath}`);
absoluteExists(profilePairingPath)
  ? pass(`BUAP_PROFILE_PAIRING.md present: ${profilePairingPath}`)
  : warn(`BUAP_PROFILE_PAIRING.md missing: ${profilePairingPath}`);
absoluteExists(toolingContextPath)
  ? pass(`BUAP_TOOLING_CONTEXT.md present: ${toolingContextPath}`)
  : warn(`BUAP_TOOLING_CONTEXT.md missing: ${toolingContextPath}`);
pass("Buddy profile: bmo");
pass("Lil Buddy profile: finn");
console.log("Recommendation: ask first-time users whether they have an Obsidian vault; strongly recommend Obsidian for durable BUAP memory, personalization, project continuity, and hatch-pet context.");

console.log("\nBUAP hatch context:");
absoluteExists(hatchContextPath)
  ? pass("primary vault hatch context present")
  : warn("primary vault hatch context missing");
exists(repoHatchContextPath)
  ? pass(`repo fallback hatch context present: ${repoHatchContextPath}`)
  : warn(`repo fallback hatch context missing: ${repoHatchContextPath}`);
exists(repoMemoryPointerPath)
  ? pass(`repo memory pointer present: ${repoMemoryPointerPath}`)
  : warn(`repo memory pointer missing: ${repoMemoryPointerPath}`);
console.log("PixelLab/LibreSprite fallback: optional; detected below when local tooling exists");

console.log("\nOptional Skills:");
const hatchPetSkill = path.join(process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex"), "skills", "hatch-pet", "SKILL.md");
fs.existsSync(hatchPetSkill)
  ? pass(`hatch-pet skill installed: ${hatchPetSkill}`)
  : warn(`hatch-pet skill missing optional: ${hatchPetSkill}`);
/^\s+run(?:\s|,)/m.test(commandOutput("npx", ["skills", "--help"]))
  ? warn("skills CLI advertises `run`, but BUAP hatch-pet still uses host handoff plus verification")
  : pass("skills CLI has no `run`; BUAP hatch-pet correctly uses host handoff plus verification");

console.log("\nHatch-pet modes:");
pass("host-hatch-pet: preferred Codex host skill path");
pass("manual-handoff: BUAP returns host prompt and /buap hatch-pet verify command");
warn("pixel-art-fallback: Pixellab.ai is a Codex/MCP host capability; verify it in the active Codex tool list before using it");

console.log("\nSprite tooling:");
// Stable conformance marker: LibreSprite executable
spriteToolStatus({
  label: "LibreSprite",
  command: "libresprite",
  appPath: "/Applications/LibreSprite.app",
  executableNames: ["LibreSprite", "libresprite"]
});
spriteToolStatus({
  label: "Aseprite",
  command: "aseprite",
  appPath: "/Applications/Aseprite.app",
  executableNames: ["aseprite", "Aseprite"]
});

console.log("\nPixelLab + LibreSprite fallback:");
// Optional capability: missing PixelLab/LibreSprite must warn, never fail.
{
  const home = process.env.HOME || "";
  const pixelLabConfigPath = path.join(home, ".codex", "config.toml");
  const pixelLabAdapterPath = path.join(
    home,
    "Library",
    "Application Support",
    "LibreSprite",
    "scripts",
    "PixelLab.js"
  );
  const asepriteExtensionPath = path.join(
    home,
    "Library",
    "Application Support",
    "LibreSprite",
    "PixelLab-Aseprite-extension"
  );
  const libreSpriteCliPath = "/Applications/LibreSprite.app/Contents/MacOS/libresprite";

  // Safe substring scan only: never print config contents or tokens.
  const configPresent = fs.existsSync(pixelLabConfigPath);
  let mcpEntry = "missing";
  if (configPresent) {
    try {
      const lower = fs.readFileSync(pixelLabConfigPath, "utf8").toLowerCase();
      const hasPixelLab = lower.includes("pixellab") || lower.includes("pixflux");
      const hasMcp = lower.includes("mcp");
      mcpEntry = hasPixelLab && hasMcp ? "present" : hasPixelLab || hasMcp ? "unknown" : "missing";
    } catch {
      mcpEntry = "unknown";
    }
  }

  console.log(`PixelLab MCP config: ${configPresent ? "present" : "missing"}`);
  console.log(`PixelLab MCP config path: ${pixelLabConfigPath}`);
  console.log(`PixelLab MCP entry: ${mcpEntry}`);
  console.log("Token safety: secrets redacted; config contents not printed");
  console.log("API probe: skipped, would spend credits; no credits spent");
  console.log(`LibreSprite PixelLab JS adapter: ${fs.existsSync(pixelLabAdapterPath) ? "present" : "missing"}`);
  console.log(`LibreSprite PixelLab JS adapter path: ${pixelLabAdapterPath}`);
  console.log("Adapter capabilities: balance check, Pixflux image generation");
  console.log(`Aseprite PixelLab extension reference: ${fs.existsSync(asepriteExtensionPath) ? "present" : "missing"}`);
  console.log(`Aseprite PixelLab extension reference path: ${asepriteExtensionPath}`);
  console.log("Runtime note: Lua-based Aseprite code; reference only for LibreSprite");
  console.log(`LibreSprite CLI path: ${libreSpriteCliPath}`);

  if (configPresent) {
    pass("PixelLab MCP config present (optional)");
  } else {
    warn("PixelLab MCP config missing optional; pixellab-libresprite-fallback unavailable");
  }
  if (fs.existsSync(pixelLabAdapterPath)) {
    pass("LibreSprite PixelLab JS adapter present (optional)");
  } else {
    warn("LibreSprite PixelLab JS adapter missing optional");
  }
  if (!fs.existsSync(asepriteExtensionPath)) {
    warn("Aseprite PixelLab extension reference missing optional (reference only)");
  }
}

console.log("\nBUAP profile pairing:");
pass("Buddy profile: bmo");
pass("Lil Buddy profile: finn");
pass("Lil Buddy is the implementation worker: emulated worker pattern (true subagent in Claude Code plugin)");

console.log("\nEnvironment:");
for (const name of optionalEnv) {
  const value = process.env[name];
  if (value) {
    pass(`${name}: set`);
  } else {
    warn(`${name}: missing optional`);
  }
}

if (full) {
  console.log("\nFull package checks:");
  runPackageCheck("npm", ["run", "smoke"]);
  runPackageCheck("npm", ["run", "build"]);
  runPackageCheck("npm", ["run", "smoke:launch"]);
} else {
  console.log("\nFull package checks:");
  warn("skipped; run `node tools/buap-doctor.mjs --full` to include package smoke/build/launch checks");
}

console.log("\nResult:");
if (failures > 0) {
  console.log(`FAIL (${failures} required check${failures === 1 ? "" : "s"} failed, ${warnings} warning${warnings === 1 ? "" : "s"})`);
  process.exit(1);
}

console.log(`PASS (${warnings} warning${warnings === 1 ? "" : "s"})`);
