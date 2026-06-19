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

console.log("BUAP ACP smoke check passed");
console.log(JSON.stringify({ repoRoot, packageRoot, profiles: profilePack.profiles.length }, null, 2));
