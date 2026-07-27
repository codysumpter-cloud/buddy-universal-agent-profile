#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { checkProject, validateProject, writeProject } from "./compiler.mjs";

function usage() {
  console.error("Usage: buap-compile <build|check|validate> --config <path>");
}

function configFrom(argv) {
  const index = argv.indexOf("--config");
  if (index < 0 || !argv[index + 1]) return null;
  return path.resolve(argv[index + 1]);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
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
  console.error(`fail buap-compile: ${error.message}`);
  process.exitCode = 1;
});
