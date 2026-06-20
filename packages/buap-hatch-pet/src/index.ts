import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface HatchPetRequest {
  concept?: string;
  name?: string;
  profile?: "buddy" | "lil-buddy" | "bmo" | "custom";
  outputDir?: string;
}

export interface HatchPetPlan {
  installCommand: string;
  hostPrompt: string;
  expectedPetName: string;
  expectedPetsRoot: string;
  expectedPetDir: string;
  status: "ready-for-host" | "skill-installed" | "blocked";
  reason?: string;
}

export interface PetArtifactVerification {
  exists: boolean;
  petJson: boolean;
  spritesheet: boolean;
  errors: string[];
}

export interface SpriteToolStatus {
  appPath?: string;
  cliPath?: string;
  cliOnPath: boolean;
  appInstalled: boolean;
  helpWorks: boolean;
  version?: string;
  notes: string[];
}

const SPRITESHEET_CANDIDATES = [
  "spritesheet.webp",
  "spritesheet.png",
  "atlas.webp",
  "atlas.png"
];

const DEFAULT_BUDDY_CONCEPT =
  "A tiny tamagotchi-style pixel companion named Buddy, inspired by the BUAP Buddy profile: friendly, loyal, curious, warm, practical, lightly mischievous, and emotionally supportive. Design it as a cute retro desktop pet with a compact readable silhouette, expressive eyes, simple 64px-friendly pixel-art forms, and animations suitable for idle, thinking, working, celebrating, confused, sleepy, alert, walking, and error states. It should feel like a helpful little Prismtek sidekick, not a corporate mascot. Avoid logos, text, brand marks, or copyrighted characters.";

const BMO_CONCEPT =
  "A tiny tamagotchi-style pixel companion based on the BMO-style BUAP profile: playful, helpful, emotionally warm, game-console charm, curious helper energy, simple geometric body, expressive face, retro pixel-art readability, and friendly desktop companion behavior. Avoid copying any existing character exactly; make it original and Prismtek-compatible.";

const LIL_BUDDY_CONCEPT =
  "A tiny tamagotchi-style pixel worker companion named Lil Buddy: energetic, task-focused, eager, scout-like, helpful, cute, practical, and a little scrappy. It should look like a small animated helper that checks files, carries notes, reacts to progress, and reports back to Buddy. Retro pixel-art, readable at small size, no text, no logos.";

function codexHome(): string {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

async function executableExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function exactExecutableExists(filePath: string): Promise<boolean> {
  try {
    const parent = path.dirname(filePath);
    const base = path.basename(filePath);
    const entries = await fs.readdir(parent);
    if (!entries.includes(base)) return false;
    return executableExists(filePath);
  } catch {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findOnPath(command: string): Promise<string | undefined> {
  const pathValue = process.env.PATH || "";
  for (const entry of pathValue.split(path.delimiter)) {
    if (!entry) continue;
    const candidate = path.join(entry, command);
    if (await executableExists(candidate)) return candidate;
  }
  return undefined;
}

async function runTool(command: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: 10000,
      maxBuffer: 2 * 1024 * 1024
    });
    return { ok: true, output: `${stdout}\n${stderr}`.trim() };
  } catch (error) {
    const record = error as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
    return {
      ok: false,
      output: `${record.stdout?.toString?.() ?? ""}\n${record.stderr?.toString?.() ?? record.message ?? ""}`.trim()
    };
  }
}

async function detectSpriteTool(options: {
  appPath: string;
  pathCommands: string[];
  bundleExecutables: string[];
  label: string;
}): Promise<SpriteToolStatus> {
  const notes: string[] = [];
  const appInstalled = await fileExists(options.appPath);
  const fromPath = await firstDefined(options.pathCommands.map((command) => findOnPath(command)));
  const bundled = await firstDefined(
    options.bundleExecutables.map(async (name) => {
      const candidate = path.join(options.appPath, "Contents", "MacOS", name);
      return (await exactExecutableExists(candidate)) ? candidate : undefined;
    })
  );
  const cliPath = fromPath || bundled;
  const cliOnPath = Boolean(fromPath);

  if (appInstalled) notes.push(`${options.label} app is installed at ${options.appPath}.`);
  if (!cliPath) notes.push(`${options.label} executable was not found.`);
  if (cliPath && !cliOnPath) {
    notes.push(`${options.label} executable exists but is not on PATH.`);
    notes.push(`Optional alias: alias ${options.pathCommands[0]}="${cliPath}"`);
  }

  let helpWorks = false;
  let version: string | undefined;
  if (cliPath) {
    const help = await runTool(cliPath, ["--help"]);
    helpWorks = help.ok;
    if (help.ok) {
      notes.push(`${options.label} --help works.`);
      for (const marker of ["--batch", "--script", "--sheet", "--data", "--format", "--frame-range", "--sheet-type"]) {
        if (help.output.includes(marker)) notes.push(`${options.label} supports ${marker}.`);
      }
    } else {
      notes.push(`${options.label} --help failed: ${help.output || "unknown error"}`);
    }

    const versionResult = await runTool(cliPath, ["--version"]);
    if (versionResult.ok && versionResult.output) {
      version = versionResult.output.split("\n")[0]?.trim();
    }
  }

  return {
    appPath: appInstalled ? options.appPath : undefined,
    cliPath,
    cliOnPath,
    appInstalled,
    helpWorks,
    version,
    notes
  };
}

async function firstDefined<T>(promises: Array<Promise<T | undefined>>): Promise<T | undefined> {
  for (const promise of promises) {
    const value = await promise;
    if (value !== undefined) return value;
  }
  return undefined;
}

export async function detectLibreSprite(): Promise<SpriteToolStatus> {
  return detectSpriteTool({
    appPath: "/Applications/LibreSprite.app",
    pathCommands: ["libresprite"],
    bundleExecutables: ["LibreSprite", "libresprite"],
    label: "LibreSprite"
  });
}

export async function detectAseprite(): Promise<SpriteToolStatus> {
  return detectSpriteTool({
    appPath: "/Applications/Aseprite.app",
    pathCommands: ["aseprite"],
    bundleExecutables: ["aseprite", "Aseprite"],
    label: "Aseprite"
  });
}

function petsRoot(outputDir?: string): string {
  return path.resolve(outputDir || path.join(codexHome(), "pets"));
}

function sanitizePetId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "buddy";
}

function expectedPetName(request: HatchPetRequest): string {
  if (request.name?.trim()) return request.name.trim();
  if (request.profile === "lil-buddy") return "Lil Buddy";
  return "Buddy";
}

async function commandAvailable(command: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(command, args, { timeout: 10000, maxBuffer: 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

async function installedSkillsText(): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync("npx", ["skills", "list", "--json"], {
      timeout: 15000,
      maxBuffer: 4 * 1024 * 1024
    });
    return `${stdout}\n${stderr}`;
  } catch (error) {
    const record = error as { stdout?: Buffer | string; stderr?: Buffer | string };
    return `${record.stdout?.toString?.() ?? ""}\n${record.stderr?.toString?.() ?? ""}`;
  }
}

async function hatchPetSkillInstalled(): Promise<boolean> {
  const localSkill = path.join(codexHome(), "skills", "hatch-pet", "SKILL.md");
  try {
    await fs.access(localSkill);
    return true;
  } catch {
    return /hatch-pet/i.test(await installedSkillsText());
  }
}

export function buildBuddyPetConcept(request: HatchPetRequest): string {
  if (request.concept?.trim()) return request.concept.trim();
  if (request.profile === "custom") {
    throw new Error('profile="custom" requires concept="...".');
  }
  if (request.profile === "bmo") return BMO_CONCEPT;
  if (request.profile === "lil-buddy") return LIL_BUDDY_CONCEPT;
  return DEFAULT_BUDDY_CONCEPT;
}

export function buildHatchPetHostPrompt(request: HatchPetRequest): string {
  const name = expectedPetName(request);
  const concept = buildBuddyPetConcept(request);
  const root = petsRoot(request.outputDir);
  const expectedDir = path.join(root, sanitizePetId(name));
  return [
    "Use the installed `$hatch-pet` skill to create a Codex pet.",
    "",
    `Pet name: ${name}`,
    `Concept: ${concept}`,
    `Expected package root: ${root}`,
    `Expected package directory: ${expectedDir}`,
    "",
    "Requirements:",
    "- Generate a Codex-compatible pet package with `pet.json` and a spritesheet file.",
    "- Save the package under the Codex pets directory.",
    "- Do not claim success until the final pet files exist.",
    `- After hatching, report the generated package path so BUAP can verify it with \`/buap hatch-pet verify name="${name}"\`.`,
    "- Avoid logos, readable text, brand marks, or copyrighted characters.",
    "",
    "If the official hatch-pet skill cannot execute in this host, stop and report that BUAP should use the documented pixel-art-fallback path instead of inventing a package format."
  ].join("\n");
}

export async function planHatchPet(request: HatchPetRequest): Promise<HatchPetPlan> {
  let concept = "";
  try {
    concept = buildBuddyPetConcept(request);
  } catch (error) {
    return {
      installCommand: "$skill-installer hatch-pet",
      hostPrompt: "",
      expectedPetName: expectedPetName(request),
      expectedPetsRoot: petsRoot(request.outputDir),
      expectedPetDir: path.join(petsRoot(request.outputDir), sanitizePetId(expectedPetName(request))),
      status: "blocked",
      reason: error instanceof Error ? error.message : String(error)
    };
  }

  const name = expectedPetName(request);
  const root = petsRoot(request.outputDir);
  const npxAvailable = await commandAvailable("npx", ["skills", "--version"]);
  const installed = npxAvailable ? await hatchPetSkillInstalled() : false;
  const status: HatchPetPlan["status"] = installed ? "skill-installed" : "ready-for-host";
  const reason = npxAvailable
    ? installed
      ? "hatch-pet appears installed. BUAP will hand off execution to the Codex host skill system."
      : "hatch-pet was not detected locally. Install it in the Codex host before running the prompt."
    : "`npx skills` is not available. Use the Codex host skill installer if available, then run the host prompt.";

  return {
    installCommand: "$skill-installer hatch-pet",
    hostPrompt: buildHatchPetHostPrompt({ ...request, concept, name }),
    expectedPetName: name,
    expectedPetsRoot: root,
    expectedPetDir: path.join(root, sanitizePetId(name)),
    status,
    reason
  };
}

export async function verifyPetArtifact(petDir: string): Promise<PetArtifactVerification> {
  const resolved = path.resolve(petDir.replace(/^~(?=\/)/, os.homedir()));
  const errors: string[] = [];
  let exists = false;
  let petJson = false;
  let spritesheet = false;

  try {
    const stat = await fs.stat(resolved);
    exists = stat.isDirectory();
    if (!exists) errors.push(`Not a directory: ${resolved}`);
  } catch {
    errors.push(`Missing pet directory: ${resolved}`);
    return { exists, petJson, spritesheet, errors };
  }

  try {
    const stat = await fs.stat(path.join(resolved, "pet.json"));
    petJson = stat.isFile();
    if (!petJson) errors.push("pet.json is not a regular file.");
  } catch {
    errors.push("Missing pet.json.");
  }

  for (const candidate of SPRITESHEET_CANDIDATES) {
    try {
      const stat = await fs.stat(path.join(resolved, candidate));
      if (stat.isFile()) {
        spritesheet = true;
        break;
      }
    } catch {
      // Try the next common filename.
    }
  }
  if (!spritesheet) {
    errors.push(`Missing spritesheet file. Checked: ${SPRITESHEET_CANDIDATES.join(", ")}.`);
  }

  return { exists, petJson, spritesheet, errors };
}
