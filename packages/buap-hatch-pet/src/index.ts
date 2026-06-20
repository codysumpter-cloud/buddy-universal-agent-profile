import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface HatchPetOptions {
  concept: string;
  name?: string;
  outputDir?: string;
}

export interface HatchPetResult {
  petName: string;
  petPath: string;
}

type PetJson = {
  id?: string;
  displayName?: string;
  name?: string;
  description?: string;
};

type Candidate = {
  dir: string;
  petJsonPath: string;
  mtimeMs: number;
  metadata: PetJson;
};

function codexHome(): string {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function defaultPetsDir(): string {
  return path.join(codexHome(), "pets");
}

async function validateOptions(options: HatchPetOptions): Promise<{ concept: string; name?: string; outputDir?: string }> {
  const concept = options.concept?.trim();
  if (!concept) throw new Error("hatchPet requires a non-empty concept.");
  const name = options.name?.trim() || undefined;
  const outputDir = options.outputDir ? path.resolve(options.outputDir) : undefined;
  if (outputDir) await fs.mkdir(outputDir, { recursive: true });
  return { concept, name, outputDir };
}

async function runNpxSkills(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync("npx", ["skills", ...args], {
    cwd,
    timeout: Number(process.env.BUAP_HATCH_PET_TIMEOUT_MS || 30 * 60 * 1000),
    maxBuffer: 20 * 1024 * 1024
  });
  return { stdout, stderr };
}

async function skillsCliSupportsRun(): Promise<boolean> {
  try {
    const { stdout, stderr } = await runNpxSkills(["--help"]);
    return /^\s+run(?:\s|,)/m.test(`${stdout}\n${stderr}`);
  } catch {
    return false;
  }
}

function quotedPathsFromOutput(output: string): string[] {
  const paths = new Set<string>();
  const patterns = [
    /(?:petPath|pet_path|package|packagePath|output|path)["']?\s*[:=]\s*["']([^"'\n]+)["']/gi,
    /((?:\/|~\/)[^\s"'`]+(?:pet\.json|spritesheet\.webp|pets\/[^\s"'`]+))/gi
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(output))) paths.add(match[1]);
  }
  return [...paths].map((candidate) => candidate.replace(/^~(?=\/)/, os.homedir()));
}

async function safeStat(filePath: string): Promise<import("node:fs").Stats | null> {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

async function readPetJson(petJsonPath: string): Promise<Candidate | null> {
  try {
    const stat = await fs.stat(petJsonPath);
    if (!stat.isFile()) return null;
    const metadata = JSON.parse(await fs.readFile(petJsonPath, "utf8")) as PetJson;
    return {
      dir: path.dirname(petJsonPath),
      petJsonPath,
      mtimeMs: stat.mtimeMs,
      metadata
    };
  } catch {
    return null;
  }
}

async function scanPetDir(root: string): Promise<Candidate[]> {
  const stat = await safeStat(root);
  if (!stat) return [];
  if (stat.isFile() && path.basename(root) === "pet.json") {
    const candidate = await readPetJson(root);
    return candidate ? [candidate] : [];
  }
  if (!stat.isDirectory()) return [];

  const direct = await readPetJson(path.join(root, "pet.json"));
  const candidates = direct ? [direct] : [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nested = await readPetJson(path.join(root, entry.name, "pet.json"));
    if (nested) candidates.push(nested);
  }
  return candidates;
}

async function findGeneratedPet(startedAtMs: number, output: string, outputDir?: string): Promise<Candidate | null> {
  const roots = new Set<string>([defaultPetsDir()]);
  if (outputDir) roots.add(outputDir);

  for (const outputPath of quotedPathsFromOutput(output)) {
    const stat = await safeStat(outputPath);
    if (!stat) continue;
    if (stat.isDirectory()) roots.add(outputPath);
    if (stat.isFile() && path.basename(outputPath) === "pet.json") roots.add(outputPath);
    if (stat.isFile() && path.basename(outputPath) === "spritesheet.webp") roots.add(path.dirname(outputPath));
  }

  const candidates = (await Promise.all([...roots].map(scanPetDir))).flat();
  const fresh = candidates.filter((candidate) => candidate.mtimeMs >= startedAtMs - 5000);
  return (fresh.length ? fresh : candidates).sort((a, b) => b.mtimeMs - a.mtimeMs)[0] ?? null;
}

function renderPetName(candidate: Candidate): string {
  return candidate.metadata.displayName || candidate.metadata.name || candidate.metadata.id || path.basename(candidate.dir);
}

export async function hatchPet(options: HatchPetOptions): Promise<HatchPetResult> {
  const { concept, name, outputDir } = await validateOptions(options);
  const startedAtMs = Date.now();

  if (!(await skillsCliSupportsRun())) {
    throw new Error(
      [
        "The installed `skills` CLI does not support `skills run`, so BUAP cannot execute hatch-pet non-interactively from the ACP agent.",
        "Live hatching must be invoked by a skill-aware Codex host or a future skills CLI runner.",
        "Verified local fallback: `npx skills use https://github.com/openai/skills@hatch-pet --skill hatch-pet` can generate an instruction prompt, but it does not generate pet files."
      ].join("\n")
    );
  }

  await runNpxSkills(["add", "https://github.com/openai/skills", "--skill", "hatch-pet", "--agent", "codex", "--yes"]);

  const runArgs = ["run", "hatch-pet", "--concept", concept];
  if (name) runArgs.push("--name", name);
  if (outputDir) runArgs.push("--output", outputDir);

  const { stdout, stderr } = await runNpxSkills(runArgs);
  const candidate = await findGeneratedPet(startedAtMs, `${stdout}\n${stderr}`, outputDir);
  if (!candidate) {
    throw new Error(
      [
        "hatch-pet completed, but BUAP could not locate a generated pet.json.",
        `Checked ${outputDir ? `${outputDir} and ` : ""}${defaultPetsDir()}.`,
        "CLI output:",
        (stdout || stderr || "(no output)").slice(0, 4000)
      ].join("\n")
    );
  }

  return {
    petName: renderPetName(candidate),
    petPath: candidate.dir
  };
}
