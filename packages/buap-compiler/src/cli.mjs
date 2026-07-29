#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { checkProject, validateProject, writeProject } from "./compiler.mjs";
import { doctorProject, formatDoctor, initProject } from "./init.mjs";

function usage() {
  console.error(`Usage:
  buap init [repository-path] [--force]
  buap doctor [repository-path]
  buap <build|check|validate> --config <path>`);
}

function configFrom(argv) {
  const index = argv.indexOf("--config");
  if (index < 0 || !argv[index + 1]) return null;
  return path.resolve(argv[index + 1]);
}

function positionalPath(argv) {
  const value = argv.find((item) => !item.startsWith("--"));
  return path.resolve(value || process.cwd());
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "init") {
    const result = await initProject(positionalPath(rest), { force: rest.includes("--force") });
    console.log(`ok init: ${result.projectName} at ${result.root}`);
    console.log(`ok build: ${result.outputCount} generated files source=${result.sourceHash}`);
    if (result.overwritten.length) {
      console.log(`warn overwritten: ${result.overwritten.join(", ")}`);
    }
    console.log("next: run `buap doctor` and commit buap.config.json, .buap/, AGENTS.md, REVIEW.md, and .buddy/");
    return 0;
  }
  if (command === "doctor") {
    const report = await doctorProject(positionalPath(rest));
    for (const line of formatDoctor(report)) console.log(line);
    return report.ok ? 0 : 1;
  }

  const configPath = configFrom(rest);
  if (!command || !configPath || !["build", "check", "validate"].includes(command)) {
    usage();
    return 2;
  }
  if (command === "build") {
    const result = await writeProject(configPath);
    console.log(`ok build: ${result.outputs.size} files source=${result.sourceHash}`);
    return 0;
  }
  if (command === "check") {
    const result = await checkProject(configPath);
    if (result.drift.length) {
      for (const item of result.drift) console.error(`drift ${item.path}: ${item.reason}`);
      return 1;
    }
    console.log(`ok check: ${result.outputs.size} generated files match source=${result.sourceHash}`);
    return 0;
  }
  const result = await validateProject(configPath);
  console.log(`ok validate: ${result.resolvedProfiles.size ?? Object.keys(result.resolvedProfiles).length} profiles source=${result.sourceHash}`);
  return 0;
}

main().then((code) => { process.exitCode = code; }).catch((error) => {
  console.error(`fail buap: ${error.message}`);
  process.exitCode = 1;
});
