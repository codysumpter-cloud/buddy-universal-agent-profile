#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${file}: ${error.message}`);
    return null;
  }
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const workspace = path.resolve(arg('--workspace', '.'));
const localOnly = process.argv.includes('--local-only');
const routerDir = localOnly
  ? workspace
  : path.join(workspace, 'buddy-universal-agent-profile');
const manifestPath = path.join(routerDir, 'linked-repos', 'prismtek-stack.manifest.json');
const manifest = readJson(manifestPath);

if (!manifest) process.exit(1);
if (manifest.schema_version !== '1.0') fail('manifest schema_version must be 1.0');
if (!Array.isArray(manifest.components) || manifest.components.length < 5) {
  fail('manifest must declare the full stack');
}

const names = new Set();
const provided = new Map();
for (const component of manifest.components || []) {
  if (!component.name || !component.repository) {
    fail('every manifest component needs name and repository');
    continue;
  }
  if (names.has(component.name)) fail(`duplicate component: ${component.name}`);
  names.add(component.name);
  for (const contract of component.provides || []) {
    if (provided.has(contract)) fail(`contract ${contract} is provided by multiple components`);
    provided.set(contract, component.name);
  }
}

for (const component of manifest.components || []) {
  for (const contract of component.consumes || []) {
    if (contract.startsWith('retrieval.') || contract.startsWith('human.')) continue;
    if (!provided.has(contract)) fail(`${component.name} consumes undeclared contract ${contract}`);
  }

  if (localOnly && component.name !== 'buddy-universal-agent-profile') continue;
  const repoDir = localOnly ? routerDir : path.join(workspace, component.name);
  const declarationPath = path.join(repoDir, manifest.component_declaration || 'prismtek.component.json');
  if (!fs.existsSync(declarationPath)) {
    if (component.visibility === 'private') {
      console.warn(`SKIP: ${component.name} is private and was not checked out.`);
      continue;
    }
    fail(`${component.name} is missing ${path.basename(declarationPath)}`);
    continue;
  }
  const declaration = readJson(declarationPath);
  if (!declaration) continue;
  if (declaration.component !== component.name) fail(`${component.name}: declaration component mismatch`);
  if (declaration.repository !== component.repository) fail(`${component.name}: declaration repository mismatch`);
  const declaredContracts = new Set((declaration.provides || []).map((item) => item.contract));
  for (const contract of component.provides || []) {
    if (!declaredContracts.has(contract)) fail(`${component.name}: declaration does not provide ${contract}`);
  }
}

if (!process.exitCode) {
  console.log(`Prismtek stack contract valid (${manifest.components.length} components, ${provided.size} provided contracts).`);
}
