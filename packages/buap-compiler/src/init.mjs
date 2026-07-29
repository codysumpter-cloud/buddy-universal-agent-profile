import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { checkProject, writeProject } from "./compiler.mjs";

const MANAGED_OUTPUTS = [
  "AGENTS.md",
  "REVIEW.md",
  ".buddy/policy.yaml",
  ".buddy/claims.yaml",
  ".buddy/providers/codex.yaml",
  ".buddy/providers/copilot-review.yaml",
  ".buddy/providers/buddy.yaml",
  ".buddy/manifest.json",
];

const MODULES = {
  "base.json": {
    id: "base",
    version: 1,
    variables: { owner: "Repository maintainer" },
    sections: [
      {
        id: "identity",
        title: "Identity and source order",
        order: 10,
        targets: ["agents-md", "review-md"],
        body: "Operate as Buddy for {{project_name}}. Inspect repository-local instructions and current source before acting. Treat repository state, CI, and executable verification as stronger evidence than memory or prior chat context.",
      },
      {
        id: "claims",
        title: "Completion claims",
        order: 90,
        targets: ["agents-md", "review-md"],
        body: "Do not claim done, fixed, deployed, merged, sent, saved, working, or verified without matching evidence. Label Verified, Source-backed, Locally verified, Unverified, Blocked, or Assumption as appropriate.",
      },
    ],
    claims: {
      require_test_evidence: true,
      require_artifact_evidence: true,
      require_source_labels: true,
      allowed_labels: [
        "Verified",
        "Source-backed",
        "Locally verified",
        "Unverified",
        "Blocked",
        "Assumption",
      ],
    },
    security: {
      required_checks: [
        "secret_scan",
        "dependency_scan",
        "static_analysis",
        "agent_security_review",
      ],
      block_when: { severity: "high", confidence: "high" },
      require_human_review_when: { severity: "medium", confidence: "high" },
    },
  },
  "coding.json": {
    id: "coding",
    version: 1,
    imports: ["base"],
    scope: "execution",
    permissions: {
      network: "allowlist",
      filesystem: "workspace-write",
      secrets: "none",
      merge: "deny",
      release: "deny",
    },
    sections: [
      {
        id: "execution",
        title: "Execution policy",
        order: 20,
        targets: ["agents-md"],
        body: "Use the smallest durable change. Inspect before editing, preserve existing architecture, run repository-native checks, and leave a rollback path. Workspace writes are allowed; merge, release, production, credential, paid, and external actions remain human-approved.",
      },
    ],
    providers: {
      codex: {
        sandbox_mode: "workspace-write",
        network_access: "allowlist",
        approval_policy: "on-request",
      },
      buddy: {
        profile: "coding",
        capabilities: ["read", "write", "test", "receipt"],
        requires_human_approval: false,
        experimental: [],
      },
    },
  },
  "review.json": {
    id: "review",
    version: 1,
    imports: ["base"],
    scope: "review",
    permissions: {
      network: "none",
      filesystem: "readonly",
      secrets: "none",
      merge: "deny",
      release: "deny",
    },
    sections: [
      {
        id: "review",
        title: "Review policy",
        order: 20,
        targets: ["review-md"],
        body: "Review the pull request head-branch instructions, inspect changed behavior and tests, and report severity plus confidence. Do not mutate the workspace or merge from the review profile.",
      },
    ],
    providers: {
      "copilot-review": {
        runner: "separate",
        firewall: true,
        network: "none",
        permissions: "read-only",
        setup_workflow: ".github/workflows/copilot-code-review.yml",
      },
      buddy: {
        profile: "review",
        capabilities: ["read", "review", "security-evidence"],
        requires_human_approval: false,
        experimental: [],
      },
    },
  },
  "release.json": {
    id: "release",
    version: 1,
    imports: ["base"],
    scope: "release",
    permissions: {
      network: "allowlist",
      filesystem: "workspace-write",
      secrets: "scoped",
      merge: "confirm",
      release: "confirm",
    },
    sections: [
      {
        id: "release",
        title: "Release policy",
        order: 30,
        targets: ["agents-md", "review-md"],
        body: "Release work requires explicit human approval, green required checks, a versioned artifact, provenance, and rollback instructions. Never infer production success from a local build.",
      },
    ],
    providers: {
      buddy: {
        profile: "release",
        capabilities: ["read", "write", "test", "release-receipt"],
        requires_human_approval: true,
        experimental: [],
      },
    },
  },
};

function normalizeRoot(input) {
  return path.resolve(input || process.cwd());
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function projectName(root) {
  const packagePath = path.join(root, "package.json");
  if (await exists(packagePath)) {
    try {
      const parsed = JSON.parse(await fs.readFile(packagePath, "utf8"));
      if (typeof parsed.name === "string" && parsed.name.trim()) return parsed.name.trim();
    } catch {
      // A malformed package file should not prevent initialization of other repos.
    }
  }
  return path.basename(root);
}

function configDocument(name) {
  return {
    moduleDir: ".buap/modules",
    outDir: ".",
    defaultProfile: "coding",
    titles: {
      agents: "Buddy Repository Instructions",
      review: "Buddy Review Instructions",
    },
    variables: { project_name: name },
    profiles: {
      coding: { entrypoints: ["coding"] },
      review: { entrypoints: ["review"] },
      release: { entrypoints: ["release"] },
    },
    tokenBudgets: {
      "AGENTS.md": 2400,
      "REVIEW.md": 1800,
    },
  };
}

async function writeJson(target, value) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function preflight(root, force) {
  const managed = ["buap.config.json", ".buap/install.json", ...MANAGED_OUTPUTS];
  const collisions = [];
  for (const relative of managed) {
    if (await exists(path.join(root, relative))) collisions.push(relative);
  }
  if (collisions.length && !force) {
    throw new Error(
      `refusing to overwrite existing BUAP-managed paths: ${collisions.join(", ")}; rerun with --force only after review`,
    );
  }
  return collisions;
}

export async function initProject(rootInput, options = {}) {
  const root = normalizeRoot(rootInput);
  const force = Boolean(options.force);
  await fs.mkdir(root, { recursive: true });
  const overwritten = await preflight(root, force);
  const name = await projectName(root);
  const configPath = path.join(root, "buap.config.json");
  const moduleRoot = path.join(root, ".buap", "modules");

  await writeJson(configPath, configDocument(name));
  for (const [filename, value] of Object.entries(MODULES)) {
    await writeJson(path.join(moduleRoot, filename), value);
  }

  const result = await writeProject(configPath);
  await writeJson(path.join(root, ".buap", "install.json"), {
    schema: "buap.install.v1",
    compiler: "@prismtek/buap-compiler",
    compilerVersion: "0.2.0",
    sourceHash: result.sourceHash,
    config: "buap.config.json",
    generated: [...result.outputs.keys()].sort(),
  });
  return {
    root,
    configPath,
    projectName: name,
    sourceHash: result.sourceHash,
    outputCount: result.outputs.size,
    overwritten,
  };
}

async function findExecutable(name) {
  const suffixes = process.platform === "win32" ? [".cmd", ".exe", ".bat", ""] : [""];
  for (const directory of (process.env.PATH || "").split(path.delimiter).filter(Boolean)) {
    for (const suffix of suffixes) {
      const candidate = path.join(directory, `${name}${suffix}`);
      try {
        await fs.access(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // Continue searching PATH.
      }
    }
  }
  return null;
}

function check(name, ok, detail, required = true) {
  return { name, ok, detail, required };
}

export async function doctorProject(rootInput) {
  const root = normalizeRoot(rootInput);
  const configPath = path.join(root, "buap.config.json");
  const checks = [];
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  checks.push(check("node", nodeMajor >= 20, `Node ${process.versions.node}; requires >=20`));
  checks.push(check("project-root", await exists(root), root));
  checks.push(check("config", await exists(configPath), "buap.config.json"));

  if (await exists(configPath)) {
    try {
      const compiled = await checkProject(configPath);
      checks.push(
        check(
          "generated-drift",
          compiled.drift.length === 0,
          compiled.drift.length
            ? compiled.drift.map((item) => `${item.path}:${item.reason}`).join(", ")
            : `${compiled.outputs.size} generated files match ${compiled.sourceHash}`,
        ),
      );
    } catch (error) {
      checks.push(check("compiler", false, error.message));
    }
  }

  const installPath = path.join(root, ".buap", "install.json");
  checks.push(check("install-manifest", await exists(installPath), ".buap/install.json"));
  const mcp = await findExecutable("buddy-mcp");
  checks.push(
    check(
      "buddy-mcp",
      Boolean(mcp),
      mcp || "optional runtime not found on PATH; install Buddy Agent for MCP execution",
      false,
    ),
  );
  checks.push(
    check(
      "platform",
      true,
      `${process.platform}/${process.arch} ${os.release()}`,
      false,
    ),
  );
  return {
    root,
    ok: checks.every((item) => !item.required || item.ok),
    checks,
  };
}

export function formatDoctor(report) {
  const lines = report.checks.map((item) => {
    const status = item.ok ? "ok" : item.required ? "fail" : "warn";
    return `${status} ${item.name}: ${item.detail}`;
  });
  lines.push(`${report.ok ? "ok" : "fail"} doctor: ${report.root}`);
  return lines;
}
