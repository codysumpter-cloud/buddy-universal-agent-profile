#!/usr/bin/env node
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildBuddyPetConcept,
  buildHatchPetHostPrompt,
  detectAseprite,
  detectLibreSprite,
  planHatchPet,
  verifyPetArtifact
} from "../dist/index.js";

for (const [name, value] of Object.entries({
  buildBuddyPetConcept,
  buildHatchPetHostPrompt,
  detectAseprite,
  detectLibreSprite,
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

if (process.env.BUAP_HATCH_PET_LIVE === "1") {
  console.log("BUAP_HATCH_PET_LIVE is set, but this package no longer runs hatch-pet directly. Paste the hostPrompt into a Codex chat with $hatch-pet loaded.");
}

console.log("buap-hatch-pet smoke passed: planner and verifier work without live generation.");
