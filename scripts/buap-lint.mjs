#!/usr/bin/env node
// BUAP deep linter. Goes beyond the file-exists/substring conformance check:
//   1. Plugin manifests (marketplace.json, plugin.json, hooks.json) parse and have
//      required fields.
//   2. Agent + skill files have valid frontmatter (name + description; skill name
//      matches its directory).
//   3. Relative Markdown links across the repo resolve to real files.
//   4. The BUAP invariants are present in every prompt tier (drift guard).
//
// Exit non-zero if any check fails. Designed to run in CI alongside
// buap-conformance-check.mjs.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const failures = [];
const warnings = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

// --- tracked files (so we lint what ships, not node_modules/dist) ---
let tracked = [];
try {
  tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
} catch {
  warnings.push("git ls-files failed; skipping link + frontmatter sweep");
}

// --- 1. plugin manifests ---
function checkJson(rel, requiredKeys) {
  if (!exists(rel)) {
    failures.push(`missing plugin file: ${rel}`);
    return null;
  }
  let data;
  try {
    data = JSON.parse(read(rel));
  } catch (e) {
    failures.push(`invalid JSON in ${rel}: ${e.message}`);
    return null;
  }
  for (const key of requiredKeys) {
    if (!(key in data)) failures.push(`${rel} missing required key: ${key}`);
  }
  return data;
}

const marketplace = checkJson(".claude-plugin/marketplace.json", ["name", "owner", "plugins"]);
if (marketplace && Array.isArray(marketplace.plugins)) {
  for (const p of marketplace.plugins) {
    if (!p.source) failures.push(`marketplace plugin "${p.name ?? "?"}" missing source`);
    else if (!exists(path.join(p.source, ".claude-plugin/plugin.json"))) {
      failures.push(`marketplace plugin source has no plugin.json: ${p.source}`);
    }
  }
}
checkJson("plugins/buap/.claude-plugin/plugin.json", ["name", "version", "description"]);

const hooks = checkJson("plugins/buap/hooks/hooks.json", ["hooks"]);
if (hooks?.hooks) {
  for (const [event, entries] of Object.entries(hooks.hooks)) {
    for (const entry of entries) {
      for (const h of entry.hooks ?? []) {
        const m = /\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+?)["']/.exec(h.command ?? "");
        if (m && !exists(path.join("plugins/buap", m[1]))) {
          failures.push(`${event} hook references missing script: ${m[1]}`);
        }
      }
    }
  }
}

// --- 2. agent + skill frontmatter ---
function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([a-zA-Z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

for (const file of tracked) {
  if (/^plugins\/buap\/agents\/.+\.md$/.test(file)) {
    const fm = frontmatter(read(file));
    if (!fm) failures.push(`agent ${file} has no frontmatter`);
    else {
      if (!fm.name) failures.push(`agent ${file} frontmatter missing name`);
      if (!fm.description) failures.push(`agent ${file} frontmatter missing description`);
    }
  }
  if (/\/skills\/[^/]+\/SKILL\.md$/.test(file)) {
    const fm = frontmatter(read(file));
    const dir = path.basename(path.dirname(file));
    if (!fm) failures.push(`skill ${file} has no frontmatter`);
    else {
      if (!fm.name) failures.push(`skill ${file} frontmatter missing name`);
      else if (fm.name !== dir) {
        failures.push(`skill ${file}: frontmatter name "${fm.name}" != directory "${dir}"`);
      }
      if (!fm.description) failures.push(`skill ${file} frontmatter missing description`);
    }
  }
}

// --- 3. relative Markdown link resolution ---
const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
for (const file of tracked) {
  if (!file.endsWith(".md")) continue;
  const text = read(file);
  const dir = path.dirname(file);
  let m;
  while ((m = linkRe.exec(text))) {
    let target = m[1].trim();
    if (/^(https?:|mailto:|#|tel:)/.test(target)) continue; // external / anchor
    if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
    target = target.split("#")[0].split("?")[0]; // drop anchor/query
    if (!target) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // any other URI scheme
    const resolved = target.startsWith("/")
      ? target.slice(1)
      : path.normalize(path.join(dir, target));
    if (!exists(resolved)) {
      failures.push(`${file}: broken relative link -> ${m[1].trim()}`);
    }
  }
}

// --- 4. cross-tier invariant presence (drift guard) ---
// The tiers intentionally differ in verbosity, so a byte-identical block check would be
// wrong. Instead assert the BUAP invariants survive in every tier.
// Core invariants must hold in EVERY tier, including the tiny LITE prompt.
const allTiers = ["BUAP_KERNEL.md", "BUAP_LITE.md", "BUAP_STANDARD.md", "BUAP_FULL.md"];
const coreInvariants = [
  ["Buddy role", /\bBuddy\b/],
  ["no fake success / receipts", /receipt|fake success|no .* success|unverified/i],
  ["secrets rule", /secret/i]
];
// LITE is intentionally a single-agent, ultra-terse prompt: it drops the worker role and
// the extend/replace language on purpose, so those are only required in the fuller tiers.
const fullTiers = ["BUAP_KERNEL.md", "BUAP_STANDARD.md", "BUAP_FULL.md"];
const roleInvariants = [
  ["Lil' Buddy role", /Lil'? ?Buddy/i],
  ["extend not replace", /extend|replace|duplicate/i]
];
for (const tier of allTiers) {
  if (!exists(tier)) {
    failures.push(`missing prompt tier: ${tier}`);
    continue;
  }
  const text = read(tier);
  for (const [label, re] of coreInvariants) {
    if (!re.test(text)) failures.push(`${tier} missing BUAP invariant: ${label}`);
  }
  if (fullTiers.includes(tier)) {
    for (const [label, re] of roleInvariants) {
      if (!re.test(text)) failures.push(`${tier} missing BUAP invariant: ${label}`);
    }
  }
}

// --- report ---
for (const w of warnings) console.warn(`warning: ${w}`);
if (failures.length > 0) {
  console.error("BUAP lint failed:");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log(
  `BUAP lint passed: ${tracked.filter((f) => f.endsWith(".md")).length} markdown files, ` +
    `plugin manifests, agent/skill frontmatter, and ${allTiers.length} prompt tiers verified.`
);
