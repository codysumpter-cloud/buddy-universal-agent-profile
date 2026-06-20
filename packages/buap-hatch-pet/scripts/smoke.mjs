#!/usr/bin/env node
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import {
  buildBuddyPetConcept,
  buildHatchPetHostPrompt,
  detectAseprite,
  detectAsepriteExtensionReference,
  detectLibreSprite,
  detectPixelLabAdapter,
  detectPixelLabMcp,
  planHatchPet,
  verifyPetArtifact
} from "../dist/index.js";

for (const [name, value] of Object.entries({
  buildBuddyPetConcept,
  buildHatchPetHostPrompt,
  detectAseprite,
  detectAsepriteExtensionReference,
  detectLibreSprite,
  detectPixelLabAdapter,
  detectPixelLabMcp,
  planHatchPet,
  verifyPetArtifact
})) {
  if (typeof value !== "function") throw new Error(`${name} export is missing.`);
}

const concept = buildBuddyPetConcept({ profile: "buddy" });
if (!concept.includes("Prismtek sidekick")) {
  throw new Error("Default Buddy concept did not include expected BUAP cues.");
}

const plan = await planHatchPet({
  profile: "buddy",
  name: "Buddy",
  outputDir: path.join(os.tmpdir(), "buap-hatch-pet-smoke")
});
if (!plan.hostPrompt.includes("$hatch-pet") || !plan.expectedPetDir.endsWith("buddy")) {
  throw new Error("Hatch plan did not include expected host prompt or pet directory.");
}

for (const [label, status] of Object.entries({
  LibreSprite: await detectLibreSprite(),
  Aseprite: await detectAseprite()
})) {
  for (const field of ["cliOnPath", "appInstalled", "helpWorks", "notes"]) {
    if (!(field in status)) throw new Error(`${label} detector missing field: ${field}`);
  }
  if (!Array.isArray(status.notes)) throw new Error(`${label} detector notes must be an array.`);
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "buap-hatch-pet-"));
const petDir = path.join(tempRoot, "buddy");
try {
  await mkdir(petDir);
  await writeFile(path.join(petDir, "pet.json"), JSON.stringify({ id: "buddy", displayName: "Buddy" }));
  await writeFile(path.join(petDir, "spritesheet.webp"), "placeholder");
  const verification = await verifyPetArtifact(petDir);
  if (!verification.exists || !verification.petJson || !verification.spritesheet || verification.errors.length) {
    throw new Error(`Expected fake pet artifact to verify: ${JSON.stringify(verification)}`);
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

// PixelLab + LibreSprite fallback detectors must return their documented shapes
// without ever throwing and without spending PixelLab credits.
const pixelLabMcp = await detectPixelLabMcp();
if (typeof pixelLabMcp.configPresent !== "boolean") {
  throw new Error("detectPixelLabMcp() must return a boolean configPresent.");
}
if (!["present", "missing", "unknown"].includes(pixelLabMcp.mcpEntry)) {
  throw new Error(`detectPixelLabMcp() returned an invalid mcpEntry: ${pixelLabMcp.mcpEntry}`);
}
const pixelLabAdapter = await detectPixelLabAdapter();
if (typeof pixelLabAdapter.present !== "boolean") {
  throw new Error("detectPixelLabAdapter() must return a boolean present.");
}
const asepriteExtension = await detectAsepriteExtensionReference();
if (typeof asepriteExtension.present !== "boolean") {
  throw new Error("detectAsepriteExtensionReference() must return a boolean present.");
}

// The rendered doctor output must include the fallback section and the BUAP
// pairing, and must never leak token-looking strings.
const here = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(here, "..", "dist", "cli.js");
const doctorOutput = execFileSync("node", [cliPath, "doctor"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});
for (const required of [
  "PixelLab + LibreSprite fallback:",
  "PixelLab MCP config:",
  "PixelLab MCP entry:",
  "Adapter capabilities: balance check, Pixflux image generation",
  "API probe: skipped, would spend credits",
  "Buddy profile: bmo",
  "Lil Buddy profile: finn"
]) {
  if (!doctorOutput.includes(required)) {
    throw new Error(`Doctor output missing required line: ${required}`);
  }
}
for (const tokenPattern of [/\bsk-[A-Za-z0-9]/, /token\s*=/i, /\b[0-9a-f]{32,}\b/]) {
  if (tokenPattern.test(doctorOutput)) {
    throw new Error(`Doctor output contains a token-looking string matching ${tokenPattern}.`);
  }
}

if (process.env.BUAP_HATCH_PET_LIVE === "1") {
  console.log("BUAP_HATCH_PET_LIVE is set, but this package no longer runs hatch-pet directly. Paste the hostPrompt into a Codex chat with $hatch-pet loaded.");
}

console.log("buap-hatch-pet smoke passed: planner, verifier, and PixelLab/LibreSprite fallback detectors work without live generation or credit spend.");
