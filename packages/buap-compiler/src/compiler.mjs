import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { readStructuredFile } from "./parser.mjs";
import { resolveModuleGraph } from "./graph.mjs";
import { compileLifeProfile } from "./life-profile.mjs";
import {
  estimateTokens,
  findSecretLikeStrings,
  interpolate,
  mergePermissions,
  validateModuleShape,
  validateProviderFields,
} from "./validate.mjs";
import {
  digest,
  renderGitHubSkill,
  renderMarkdown,
  renderYaml,
  stableStringify,
} from "./targets.mjs";

const COMPILER_VERSION = "0.4.0";
const GITHUB_SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TARGET_PATHS = {
  "agents-md": "AGENTS.md",
  "review-md": "REVIEW.md",
  policy: ".buddy/policy.yaml",
  claims: ".buddy/claims.yaml",
  codex: ".buddy/providers/codex.yaml",
  "copilot-review": ".buddy/providers/copilot-review.yaml",
  buddy: ".buddy/providers/buddy.yaml",
  life: ".buddy/life-profile.json",
  manifest: ".buddy/manifest.json",
};

async function discoverModuleFiles(moduleDir) {
  const entries = await fs.readdir(moduleDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(json|ya?ml)$/i.test(entry.name))
    .map((entry) => path.join(moduleDir, entry.name))
    .sort();
}

function uniqueSections(modules, target) {
  const byId = new Map();
  for (const module of modules) {
    for (const section of module.sections ?? []) {
      const targets = section.targets ?? ["agents-md", "review-md", "codex", "copilot-review", "buddy"];
      if (!targets.includes(target)) continue;
      if (byId.has(section.id) && !(module.overrides ?? []).includes(`sections.${section.id}`)) {
        throw new Error(`duplicate section ${section.id} in target ${target}; add an explicit override`);
      }
      byId.set(section.id, section);
    }
  }
  return [...byId.values()];
}

function mergeObjects(modules, field) {
  const result = {};
  for (const module of modules) Object.assign(result, module[field] ?? {});
  return result;
}

function targetModules(config, modulesById, profileName) {
  const profile = config.profiles?.[profileName];
  if (!profile) throw new Error(`missing profile ${profileName}`);
  return resolveModuleGraph(profile.entrypoints ?? [], modulesById);
}

function titleFromName(name) {
  return name.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function githubSkillPath(name) {
  return `.github/skills/${name}/SKILL.md`;
}

function githubSkills(config, resolvedProfiles) {
  const definitions = config.githubSkills ?? [];
  if (!Array.isArray(definitions)) throw new Error("githubSkills must be an array");
  const seen = new Set();
  return definitions.map((definition, index) => {
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      throw new Error(`githubSkills[${index}] must be an object`);
    }
    const name = String(definition.name ?? "");
    if (!GITHUB_SKILL_NAME.test(name)) {
      throw new Error(`githubSkills[${index}].name must be lowercase kebab-case`);
    }
    if (seen.has(name)) throw new Error(`duplicate GitHub skill name ${name}`);
    seen.add(name);
    const description = String(definition.description ?? "").trim();
    if (!description || description.length > 1024 || /[\r\n]/.test(description)) {
      throw new Error(`githubSkills.${name}.description must be one line between 1 and 1024 characters`);
    }
    const profileName = String(definition.profile ?? "review");
    const profile = resolvedProfiles[profileName];
    if (!profile) throw new Error(`githubSkills.${name} references missing profile ${profileName}`);
    const license = definition.license === undefined ? undefined : String(definition.license).trim();
    if (license !== undefined && (!license || /[\r\n]/.test(license))) {
      throw new Error(`githubSkills.${name}.license must be a non-empty single line`);
    }
    const title = String(definition.title ?? titleFromName(name)).trim();
    if (!title || /[\r\n]/.test(title)) {
      throw new Error(`githubSkills.${name}.title must be a non-empty single line`);
    }
    const target = `github-skill:${name}`;
    const sections = uniqueSections(profile.modules, target);
    if (!sections.length) {
      throw new Error(`githubSkills.${name} has no canonical sections targeting ${target}`);
    }
    return {
      name,
      description,
      license,
      title,
      profile: profileName,
      path: githubSkillPath(name),
      sections,
    };
  });
}

export async function loadProject(configPath) {
  const absoluteConfig = path.resolve(configPath);
  const config = await readStructuredFile(absoluteConfig);
  const root = path.dirname(absoluteConfig);
  const moduleDir = path.resolve(root, config.moduleDir ?? "modules");
  const outDir = path.resolve(root, config.outDir ?? "generated");
  const modulesById = new Map();
  const errors = [];

  for (const filePath of await discoverModuleFiles(moduleDir)) {
    const module = await readStructuredFile(filePath);
    const shapeErrors = validateModuleShape(module, filePath);
    errors.push(...shapeErrors, ...validateProviderFields(module));
    if (module.id) {
      if (modulesById.has(module.id)) errors.push(`duplicate module id ${module.id}`);
      modulesById.set(module.id, { ...module, __file: filePath });
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return { config, root, moduleDir, outDir, modulesById };
}

export async function compileProject(configPath) {
  const project = await loadProject(configPath);
  const { config, modulesById } = project;
  const variables = { ...(config.variables ?? {}) };
  const resolvedProfiles = {};

  for (const profileName of Object.keys(config.profiles ?? {}).sort()) {
    const modules = targetModules(config, modulesById, profileName);
    const profileVariables = {};
    for (const module of modules) Object.assign(profileVariables, module.variables ?? {});
    const interpolated = modules.map((module) => interpolate(module, { ...profileVariables, ...variables }, module.__file));
    const permissionSet = mergePermissions(interpolated);
    resolvedProfiles[profileName] = {
      modules: interpolated,
      permissions: permissionSet,
      claims: mergeObjects(interpolated, "claims"),
      security: mergeObjects(interpolated, "security"),
      providers: Object.fromEntries(
        ["codex", "copilot-review", "buddy"].map((provider) => [provider, mergeObjects(interpolated.map((item) => ({ providers: item.providers?.[provider] ?? {} })), "providers")]),
      ),
    };
    resolvedProfiles[profileName].providers = {
      codex: Object.assign({}, ...interpolated.map((item) => item.providers?.codex ?? {})),
      "copilot-review": Object.assign({}, ...interpolated.map((item) => item.providers?.["copilot-review"] ?? {})),
      buddy: Object.assign({}, ...interpolated.map((item) => item.providers?.buddy ?? {})),
    };
  }

  const sourceSnapshot = {
    compilerVersion: COMPILER_VERSION,
    config: { ...config, outDir: undefined },
    profiles: Object.fromEntries(Object.entries(resolvedProfiles).map(([name, profile]) => [name, profile.modules.map(({ __file, ...module }) => module)])),
  };
  const sourceHash = digest(sourceSnapshot);
  const outputs = new Map();

  const coding = resolvedProfiles.coding;
  const review = resolvedProfiles.review;
  if (!coding || !review) throw new Error("profiles.coding and profiles.review are required");

  outputs.set(TARGET_PATHS["agents-md"], renderMarkdown({
    title: config.titles?.agents ?? "Agent Instructions",
    sections: uniqueSections(coding.modules, "agents-md"),
    hash: sourceHash,
  }));
  outputs.set(TARGET_PATHS["review-md"], renderMarkdown({
    title: config.titles?.review ?? "Review Instructions",
    sections: uniqueSections(review.modules, "review-md"),
    hash: sourceHash,
  }));

  for (const skill of githubSkills(config, resolvedProfiles)) {
    outputs.set(skill.path, renderGitHubSkill({
      name: skill.name,
      description: skill.description,
      license: skill.license,
      title: skill.title,
      sections: skill.sections,
      hash: sourceHash,
    }));
  }

  const policy = {
    version: 1,
    default_profile: config.defaultProfile ?? "coding",
    profiles: Object.fromEntries(Object.entries(resolvedProfiles).map(([name, profile]) => [name, {
      permissions: profile.permissions,
      requires_human_approval: Boolean(profile.providers.buddy.requires_human_approval),
    }])),
  };
  outputs.set(TARGET_PATHS.policy, renderYaml(policy, sourceHash));
  outputs.set(TARGET_PATHS.claims, renderYaml({
    version: 1,
    evidence: coding.claims,
    security: coding.security,
  }, sourceHash));

  for (const provider of ["codex", "copilot-review", "buddy"]) {
    const profileName = provider === "copilot-review" ? "review" : "coding";
    outputs.set(TARGET_PATHS[provider], renderYaml({
      version: 1,
      profile: profileName,
      ...resolvedProfiles[profileName].providers[provider],
    }, sourceHash));
  }

  outputs.set(TARGET_PATHS.life, `${stableStringify(
    compileLifeProfile(coding.modules, config, sourceHash, "coding"),
  )}\n`);

  const manifest = {
    compiler: `@prismtek/buap-compiler@${COMPILER_VERSION}`,
    source_sha256: sourceHash,
    files: Object.fromEntries([...outputs.entries()].sort().map(([filePath, content]) => [filePath, {
      sha256: digest(content),
      estimated_tokens: estimateTokens(content),
    }])),
  };
  outputs.set(TARGET_PATHS.manifest, `${stableStringify(manifest)}\n`);

  const secretFindings = findSecretLikeStrings(sourceSnapshot);
  if (secretFindings.length) throw new Error(`secret-like strings detected:\n${secretFindings.join("\n")}`);
  for (const [filePath, content] of outputs) {
    const budget = config.tokenBudgets?.[path.basename(filePath)] ?? config.tokenBudgets?.[filePath];
    if (budget && estimateTokens(content) > budget) {
      throw new Error(`${filePath}: estimated token budget ${estimateTokens(content)} exceeds ${budget}`);
    }
  }

  return { ...project, outputs, sourceHash, resolvedProfiles };
}

export async function writeProject(configPath) {
  const compiled = await compileProject(configPath);
  for (const [relativePath, content] of compiled.outputs) {
    const destination = path.join(compiled.outDir, relativePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, content, "utf8");
  }
  return compiled;
}

export async function checkProject(configPath) {
  const compiled = await compileProject(configPath);
  const drift = [];
  for (const [relativePath, expected] of compiled.outputs) {
    const destination = path.join(compiled.outDir, relativePath);
    let actual;
    try {
      actual = await fs.readFile(destination, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        drift.push({ path: relativePath, reason: "missing" });
        continue;
      }
      throw error;
    }
    if (actual !== expected) drift.push({ path: relativePath, reason: "changed" });
  }
  return { ...compiled, drift };
}

export async function validateProject(configPath) {
  const compiled = await compileProject(configPath);
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "buap-compiler-"));
  await fs.rm(scratch, { recursive: true, force: true });
  return compiled;
}
