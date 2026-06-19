#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const repoRoot = path.resolve(packageRoot, "../..");

const requiredRepoFiles = [
  "XCODE_ACP_BUAP.md",
  "BUAP_FULL.md",
  "personalization/PERSONALIZATION_HANDSHAKE.md",
  "personalization/BUDDY_LIL_BUDDY_PROFILE_SELECTION.md",
  "personalization/bmo-council-personality-profiles.json",
  "schemas/buap-personalization.schema.json"
];

const requiredPackageFiles = [
  "package.json",
  "tsconfig.json",
  "src/index.ts",
  "src/runtime.ts",
  "README.md"
];

for (const relativePath of requiredRepoFiles) {
  await fs.access(path.join(repoRoot, relativePath));
}

for (const relativePath of requiredPackageFiles) {
  await fs.access(path.join(packageRoot, relativePath));
}

const profilePack = JSON.parse(
  await fs.readFile(path.join(repoRoot, "personalization/bmo-council-personality-profiles.json"), "utf8")
);

if (profilePack.profile_pack_id !== "bmo-council-v1") {
  throw new Error(`Unexpected profile pack id: ${profilePack.profile_pack_id}`);
}

const profileIds = new Set((profilePack.profiles ?? []).map((profile) => profile.id));
for (const expected of ["bmo", "finn"]) {
  if (!profileIds.has(expected)) {
    throw new Error(`Missing expected profile: ${expected}`);
  }
}

const runtimeSource = await fs.readFile(path.join(packageRoot, "src/runtime.ts"), "utf8");
const runtimeMarkers = [
  "/buap read",
  "/buap patch",
  "/buap apply",
  "/buap run",
  "/buap ask",
  "/buap git status",
  "/buap git diff",
  "/buap mcp",
  "/buap mcp invoke",
  "session/request_permission",
  "fs/write_text_file",
  "terminal/create",
  "terminal/release",
  "terminal/wait_for_exit",
  "terminal/output",
  "BUAP_MODEL_BACKEND=openai-compatible"
];
for (const expected of runtimeMarkers) {
  if (!runtimeSource.includes(expected)) {
    throw new Error(`Runtime source missing expected marker: ${expected}`);
  }
}

const indexSource = await fs.readFile(path.join(packageRoot, "src/index.ts"), "utf8");
const indexMarkers = [
  "available_commands_update",
  "session/new",
  "session/prompt",
  "session/close",
  "session/cancel",
  "initialize",
  "advertisedCommands",
  "pendingClientRequests",
  "requestClient(method",
  "handleClientResponse"
];
for (const expected of indexMarkers) {
  if (!indexSource.includes(expected)) {
    throw new Error(`Index source missing expected marker: ${expected}`);
  }
}

const distDir = path.join(packageRoot, "dist");
await fs.access(distDir);

const distRuntime = await fs.readFile(path.join(distDir, "runtime.js"), "utf8");
const distIndex = await fs.readFile(path.join(distDir, "index.js"), "utf8");
const distMarkers = [
  ["runtime", distRuntime, "session/request_permission"],
  ["runtime", distRuntime, "fs/write_text_file"],
  ["runtime", distRuntime, "terminal/create"],
  ["runtime", distRuntime, "terminal/release"],
  ["runtime", distRuntime, "terminal/output"],
  ["runtime", distRuntime, "/buap apply"],
  ["runtime", distRuntime, "/buap run"],
  ["runtime", distRuntime, "/buap mcp invoke"],
  ["index", distIndex, "available_commands_update"],
  ["index", distIndex, "advertisedCommands"]
];
for (const [fileLabel, source, marker] of distMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Built dist/${fileLabel}.js missing expected marker: ${marker}`);
  }
}

const advertised = [
  "buap help",
  "buap profiles",
  "buap personalize",
  "buap read",
  "buap patch",
  "buap apply",
  "buap ask",
  "buap run",
  "buap git status",
  "buap git diff",
  "buap mcp",
  "buap mcp invoke"
];
const advertisedNames = (JSON.stringify(availableCommandsSnapshot(distRuntime)));
if (advertisedNames === "[]") {
  throw new Error("Could not parse built availableCommands() output.");
}
for (const command of advertised) {
  if (!advertisedNames.includes(`"name":"${command}"`)) {
    throw new Error(`Built availableCommands() missing advertised command: ${command}`);
  }
}

console.log("BUAP ACP smoke check passed");
console.log(JSON.stringify({
  repoRoot,
  packageRoot,
  profiles: profilePack.profiles.length,
  runtimeMarkers: runtimeMarkers.length,
  indexMarkers: indexMarkers.length,
  distMarkers: distMarkers.length,
  advertisedCommands: advertised.length
}, null, 2));

function availableCommandsSnapshot(source) {
  const match = source.match(/availableCommands\(\)\s*\{[\s\S]*?return\s+([A-Za-z_$][\w$]*);/);
  if (!match) return [];
  const literal = match[1];
  // The compiled file references the array by name; the array is defined right above as RUNTIME_COMMANDS.
  const arrayMatch = source.match(new RegExp(`const\\s+${literal}\\s*=\\s*(\\[[\\s\\S]*?\\]);`));
  if (!arrayMatch) return [];
  try {
    return JSON.parse(arrayMatch[1]
      .replace(/(\w+)\s*:/g, '"$1":')
      .replace(/'((?:\\'|[^'])*)'/g, (_, value) => JSON.stringify(value))
      .replace(/"input":\s*\{\s*"hint":\s*('[^']*')\s*\}/g, (_, hint) => `"input":{"hint":${hint}}`)
    );
  } catch {
    return [];
  }
}
