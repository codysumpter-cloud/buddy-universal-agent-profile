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
  'docs/local-buap-doctor-and-bootstrap.md',
  'docs/knowledge-vault-search.md',
  'packages/buap-knowledge-vault/package.json',
  'packages/buap-knowledge-vault/src/index.ts',
  'scripts/build-vault-index.mjs',
  'plugins/buap/.codex-plugin/plugin.json',
  'plugins/buap/hooks.json',
  'tests/plugin-codex.acceptance.md',
  'packages/buap-apple-notes-reminders/package.json',
  'packages/buap-apple-notes-reminders/src/index.ts',
  'packages/buap-apple-notes-reminders/scripts/smoke.mjs',
  'docs/apple-notes-reminders.md',
  'packages/buap-hatch-pet/package.json',
  'packages/buap-hatch-pet/src/index.ts',
  'packages/buap-hatch-pet/src/cli.ts',
  'packages/buap-hatch-pet/scripts/smoke.mjs',
  'docs/hatch-pet-integration.md'
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
  ['tests/conformance/README.md', 'conformance'],
  ['packages/buap-acp-agent/src/runtime.ts', 'buap add-note'],
  ['packages/buap-acp-agent/src/runtime.ts', 'buap add-reminder'],
  ['packages/buap-apple-notes-reminders/src/index.ts', 'listReminders'],
  ['packages/buap-acp-agent/src/runtime.ts', 'buap hatch-pet'],
  ['packages/buap-acp-agent/src/runtime.ts', 'hatch-pet verify'],
  ['packages/buap-hatch-pet/src/index.ts', 'planHatchPet'],
  ['packages/buap-hatch-pet/src/index.ts', 'verifyPetArtifact'],
  ['packages/buap-hatch-pet/src/index.ts', 'detectLibreSprite'],
  ['packages/buap-hatch-pet/src/cli.ts', 'Sprite tooling'],
  ['docs/hatch-pet-integration.md', '/buap hatch-pet'],
  ['docs/hatch-pet-integration.md', 'host-hatch-pet'],
  ['docs/hatch-pet-integration.md', 'manual-handoff'],
  ['docs/hatch-pet-integration.md', 'pixel-art-fallback'],
  ['tools/buap-doctor.mjs', 'pixel-art-fallback'],
  ['tools/buap-doctor.mjs', 'LibreSprite executable'],
  // PixelLab + LibreSprite fallback wiring (docs + code, no secrets).
  ['docs/hatch-pet-integration.md', 'PixelLab.js'],
  ['docs/hatch-pet-integration.md', 'Pixflux'],
  ['docs/hatch-pet-integration.md', '/Users/prismtek/.codex/config.toml'],
  ['docs/hatch-pet-integration.md', '/Applications/LibreSprite.app/Contents/MacOS/libresprite'],
  ['docs/hatch-pet-integration.md', 'PixelLab-Aseprite-extension'],
  ['docs/hatch-pet-integration.md', 'Lua-based Aseprite code'],
  ['docs/hatch-pet-integration.md', 'LibreSprite JS adapter'],
  ['docs/hatch-pet-integration.md', 'secrets redacted'],
  ['docs/hatch-pet-integration.md', 'API probe'],
  ['docs/hatch-pet-integration.md', 'no credits spent'],
  ['docs/hatch-pet-integration.md', 'would spend credits'],
  ['docs/hatch-pet-integration.md', 'Buddy profile: bmo'],
  ['docs/hatch-pet-integration.md', 'Lil Buddy profile: finn'],
  ['docs/hatch-pet-integration.md', 'Lil Buddy is the implementation worker'],
  // BUAP pairing persisted in durable instruction files.
  ['CLAUDE.md', 'Buddy = `bmo`'],
  ['CLAUDE.md', 'Lil Buddy = `finn`'],
  ['personalization/BUDDY_LIL_BUDDY_PROFILE_SELECTION.md', 'Active pairing for this repo'],
  // Doctor + cli wiring assertions.
  ['packages/buap-hatch-pet/src/cli.ts', 'Adapter capabilities: balance check, Pixflux image generation'],
  ['packages/buap-hatch-pet/src/cli.ts', 'Buddy profile: bmo'],
  ['packages/buap-hatch-pet/src/cli.ts', 'Lil Buddy profile: finn'],
  ['tools/buap-doctor.mjs', 'no credits spent'],
  ['tools/buap-doctor.mjs', 'secrets redacted'],
  ['tools/buap-doctor.mjs', 'Buddy profile: bmo'],
  ['tools/buap-doctor.mjs', 'Lil Buddy profile: finn']
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
