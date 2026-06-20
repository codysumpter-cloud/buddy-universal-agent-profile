#!/usr/bin/env node
import { detectAseprite, detectLibreSprite, type SpriteToolStatus } from "./index.js";

function help(): string {
  return [
    "Usage:",
    "  buap-hatch-pet doctor",
    "  buap-hatch-pet sprite-tool doctor",
    "",
    "Commands:",
    "  doctor              Show hatch-pet fallback tooling status.",
    "  sprite-tool doctor  Show LibreSprite/Aseprite CLI detection only."
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
  const [libreSprite, aseprite] = await Promise.all([detectLibreSprite(), detectAseprite()]);
  return [
    "BUAP Hatch-Pet Doctor",
    "",
    "Modes:",
    "- host-hatch-pet: preferred, Codex host runs official $hatch-pet.",
    "- manual-handoff: BUAP returns the exact host prompt and verify command.",
    "- pixel-art-fallback: Pixellab.ai generation plus LibreSprite/Aseprite repair/export tooling.",
    "",
    "Sprite tooling:",
    ...renderTool("LibreSprite", "libresprite", libreSprite),
    ...renderTool("Aseprite", "aseprite", aseprite),
    "",
    "Fallback safety:",
    "- Pixellab.ai can generate Buddy/Lil Buddy art when available in the Codex host.",
    "- LibreSprite/Aseprite can repair, slice, validate, and export spritesheets.",
    "- Codex pet packaging remains gated by verifyPetArtifact(); do not claim success until pet.json and a spritesheet/atlas exist."
  ].join("\n");
}

const args = process.argv.slice(2);
const command = args.join(" ");

if (command === "doctor" || command === "sprite-tool doctor") {
  console.log(await renderDoctor());
} else {
  console.log(help());
  process.exit(command ? 1 : 0);
}
