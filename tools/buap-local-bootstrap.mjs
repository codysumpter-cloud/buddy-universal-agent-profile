#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const force = process.argv.includes("--force");
const buapHome = path.join(os.homedir(), ".buap");
const personalizationPath = path.join(buapHome, "personalization.json");
const acpLaunchCommand = `node ${path.join(repoRoot, "packages", "buap-acp-agent", "dist", "index.js")}`;

const defaultPersonalization = {
  user_display_name: "Cody",
  buddy_display_name: "Buddy",
  lil_buddy_display_name: "Lil Buddy",
  buddy_profile_id: "bmo",
  lil_buddy_profile_id: "finn",
  selected_profile_pack_id: "bmo-council-v1"
};

function writePersonalization() {
  fs.mkdirSync(buapHome, { recursive: true });
  if (fs.existsSync(personalizationPath) && !force) {
    console.log(`Kept existing personalization file: ${personalizationPath}`);
    console.log("Run with `--force` to overwrite it with defaults.");
    return;
  }

  fs.writeFileSync(
    personalizationPath,
    `${JSON.stringify(defaultPersonalization, null, 2)}\n`,
    "utf8"
  );
  console.log(`${force ? "Wrote" : "Created"} personalization file: ${personalizationPath}`);
}

function printExports() {
  console.log("\nRecommended environment exports:");
  console.log(`export BUAP_REPO_ROOT="${repoRoot}"`);
  console.log(`export BUAP_WORKSPACE_ROOT="${repoRoot}"`);
  console.log(`export BUAP_PERSONALIZATION_FILE="${personalizationPath}"`);
  console.log("export BUAP_MAX_READ_BYTES=20000");
  console.log("export BUAP_GIT_TIMEOUT_MS=10000");
  console.log("export BUAP_TERMINAL_OUTPUT_LIMIT=1048576");
  console.log("export BUAP_CLIENT_REQUEST_TIMEOUT_MS=300000");
  console.log("");
  console.log("# Optional OpenAI-compatible backend for /buap ask:");
  console.log("# export BUAP_MODEL_BACKEND=openai-compatible");
  console.log("# export BUAP_MODEL_BASE_URL=https://api.openai.com/v1");
  console.log("# export BUAP_MODEL_NAME=gpt-4.1-mini");
  console.log("# export BUAP_MODEL_API_KEY=...");
  console.log("# export BUAP_MODEL_TEMPERATURE=0.2");
}

console.log("BUAP Local Bootstrap");
writePersonalization();
printExports();
console.log("\nACP launch command:");
console.log(acpLaunchCommand);
console.log("\nNo shell profile was modified.");
