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

console.log("\nOptional Skills:");
const hatchPetSkill = path.join(process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex"), "skills", "hatch-pet", "SKILL.md");
fs.existsSync(hatchPetSkill)
  ? pass(`hatch-pet skill installed: ${hatchPetSkill}`)
  : warn(`hatch-pet skill missing optional: ${hatchPetSkill}`);
/^\s+run(?:\s|,)/m.test(commandOutput("npx", ["skills", "--help"]))
  ? pass("skills CLI supports non-interactive run")
  : warn("skills CLI does not advertise `run`; /buap hatch-pet live generation will be blocked until a runner is available");

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
