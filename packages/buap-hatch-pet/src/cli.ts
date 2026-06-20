#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import {
  detectAseprite,
  detectAsepriteExtensionReference,
  detectLibreSprite,
  detectPixelLabAdapter,
  detectPixelLabMcp,
  verifyPetArtifact,
  PIXELLAB_ASEPRITE_EXTENSION_PATH,
  PIXELLAB_LIBRESPRITE_ADAPTER_PATH,
  PIXELLAB_MCP_CONFIG_PATH,
  type SpriteToolStatus
} from "./index.js";

function help(): string {
  return [
    "Usage:",
    "  buap-hatch-pet doctor",
    "  buap-hatch-pet sprite-tool doctor",
    "  buap-hatch-pet verify --name Buddy",
    "  buap-hatch-pet verify --path /absolute/path/to/pet",
    "",
    "Commands:",
    "  doctor              Show hatch-pet fallback tooling status.",
    "  sprite-tool doctor  Show LibreSprite/Aseprite CLI detection only.",
    "  verify              Verify pet.json plus spritesheet/atlas files."
  ].join("\n");
}

function statusWord(value: boolean, yes: string, no: string): string {
  return value ? yes : no;
}

function renderTool(label: string, commandName: string, status: SpriteToolStatus): string[] {
  const lines = [
    `${label} app: ${statusWord(status.appInstalled, "present", "missing")}`,
    `${label} executable: ${status.cliPath || "missing"}`,
    `${label} CLI help: ${status.cliPath ? statusWord(status.helpWorks, "works", "fails") : "unknown"}`,
    `${label} on PATH: ${statusWord(status.cliOnPath, "yes", "no")}`
  ];
  if (status.version) lines.push(`${label} version: ${status.version}`);
  if (status.cliPath && !status.cliOnPath) {
    lines.push(`${label} direct command: ${status.cliPath} --help`);
    lines.push(`${label} optional alias: alias ${commandName}="${status.cliPath}"`);
  }
  for (const note of status.notes) lines.push(`- ${note}`);
  return lines;
}

async function renderDoctor(): Promise<string> {
  const [libreSprite, aseprite, pixelLabMcp, pixelLabAdapter, asepriteExtension] = await Promise.all([
    detectLibreSprite(),
    detectAseprite(),
    detectPixelLabMcp(),
    detectPixelLabAdapter(),
    detectAsepriteExtensionReference()
  ]);
  return [
    "BUAP Hatch-Pet Doctor",
    "",
    "Modes:",
    "- host-hatch-pet: preferred, Codex host runs official $hatch-pet.",
    "- manual-handoff: BUAP returns the exact host prompt and verify command.",
    "- pixellab-libresprite-fallback: Pixellab.ai (Pixflux) generation plus LibreSprite/Aseprite repair/export tooling.",
    "",
    "Sprite tooling:",
    ...renderTool("LibreSprite", "libresprite", libreSprite),
    ...renderTool("Aseprite", "aseprite", aseprite),
    "",
    "PixelLab + LibreSprite fallback:",
    `PixelLab MCP config: ${pixelLabMcp.configPresent ? "present" : "missing"}`,
    `PixelLab MCP config path: ${PIXELLAB_MCP_CONFIG_PATH}`,
    `PixelLab MCP entry: ${pixelLabMcp.mcpEntry}`,
    "Token safety: secrets redacted; config contents not printed",
    "API probe: skipped, would spend credits",
    `LibreSprite PixelLab JS adapter: ${pixelLabAdapter.present ? "present" : "missing"}`,
    `LibreSprite PixelLab JS adapter path: ${PIXELLAB_LIBRESPRITE_ADAPTER_PATH}`,
    "Adapter capabilities: balance check, Pixflux image generation",
    `Aseprite PixelLab extension reference: ${asepriteExtension.present ? "present" : "missing"}`,
    `Aseprite PixelLab extension reference path: ${PIXELLAB_ASEPRITE_EXTENSION_PATH}`,
    "Runtime note: Lua-based Aseprite code; reference only for LibreSprite",
    "",
    "BUAP profile pairing:",
    "Buddy profile: bmo",
    "Lil Buddy profile: finn",
    "Lil Buddy is the implementation worker",
    "",
    "Fallback safety:",
    "- Pixellab.ai (Pixflux) can generate Buddy/Lil Buddy art when available in the Codex host.",
    "- LibreSprite/Aseprite can repair, slice, validate, and export spritesheets.",
    "- The doctor never calls the PixelLab API and never spends credits.",
    "- Codex pet packaging remains gated by verifyPetArtifact(); do not claim success until pet.json and a spritesheet/atlas exist."
  ].join("\n");
}

function parseFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1];
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

function petDirFromName(name: string): string {
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "buddy";
  return path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "pets", id);
}

const args = process.argv.slice(2);
const command = args.join(" ");

if (command === "doctor" || command === "sprite-tool doctor") {
  console.log(await renderDoctor());
} else if (args[0] === "verify") {
  const petDir = parseFlag("path") || petDirFromName(parseFlag("name") || "Buddy");
  const result = await verifyPetArtifact(petDir);
  console.log(`BUAP Hatch-Pet Verify: ${result.exists && result.petJson && result.spritesheet ? "passed" : "blocked"}`);
  console.log(`Pet directory: ${petDir}`);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.exists && result.petJson && result.spritesheet ? 0 : 1);
} else {
  console.log(help());
  process.exit(command ? 1 : 0);
}
