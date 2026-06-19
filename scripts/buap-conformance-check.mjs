#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'README.md',
  'BUAP_KERNEL.md',
  'BUAP_LITE.md',
  'BUAP_STANDARD.md',
  'BUAP_FULL.md',
  'AGENTS.md',
  'standards/orchestration.md',
  'standards/capability-detection.md',
  'standards/capability-negotiation.md',
  'standards/runtime-contract.md',
  'standards/failure-modes.md',
  'standards/memory-discipline.md',
  'standards/multi-agent-negotiation.md',
  'standards/multi-agent-arbitration.md',
  'standards/universal-agent-fingerprint.md',
  'standards/validation.md',
  'schemas/receipt.schema.json',
  'schemas/capability-declaration.schema.json',
  'tests/conformance/README.md',
  'tests/conformance/orchestration-loop.expected.md',
  'tests/conformance/capability-negotiation.expected.md',
  'tests/conformance/multi-agent-arbitration.expected.md',
  'docs/cross-reference-matrix.md',
  'integrations/ecosystem-routing-spec.md',
  'tools/buap-doctor.mjs',
  'tools/buap-local-bootstrap.mjs',
  'docs/local-buap-doctor-and-bootstrap.md'
];

const requiredText = [
  ['README.md', 'Buddy Universal Agent Profile'],
  ['README.md', 'BUAP is a **behavior/orchestration standard'],
  ['BUAP_KERNEL.md', 'Core loop'],
  ['BUAP_KERNEL.md', 'Optional overlays'],
  ['standards/capability-negotiation.md', 'execute'],
  ['standards/capability-negotiation.md', 'handoff'],
  ['standards/multi-agent-arbitration.md', 'Decision order'],
  ['docs/cross-reference-matrix.md', 'standards/capability-negotiation.md'],
  ['docs/cross-reference-matrix.md', 'tests/conformance/capability-negotiation.expected.md'],
  ['integrations/ecosystem-routing-spec.md', 'canonical routing spec'],
  ['tests/conformance/README.md', 'conformance']
];

const failures = [];

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`missing file: ${file}`);
  }
}

for (const [file, expected] of requiredText) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) continue;
  const text = fs.readFileSync(fullPath, 'utf8');
  if (!text.includes(expected)) {
    failures.push(`missing text in ${file}: ${expected}`);
  }
}

if (failures.length > 0) {
  console.error('BUAP conformance check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`BUAP conformance check passed: ${requiredFiles.length} files and ${requiredText.length} text checks verified.`);
