#!/usr/bin/env node
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildIndex, searchIndex, loadAndSearch } from "../dist/index.js";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "buap-vault-smoke-"));

try {
  await mkdir(path.join(tempRoot, "Projects"), { recursive: true });
  await writeFile(
    path.join(tempRoot, "Projects", "Meeting Notes.md"),
    "---\ntitle: Weekly Meeting\n---\n# Ignored Heading\nDiscuss Buddy launch planning and action items.\n",
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "Runbook.md"),
    "# Vault Runbook\nSafe maintenance commands for the vault.\n",
    "utf8"
  );

  const index = await buildIndex(tempRoot);
  if (index.entries.length !== 2) throw new Error(`Expected 2 entries, got ${index.entries.length}`);

  const meetingHits = searchIndex(index, "buddy");
  if (meetingHits.length !== 1 || meetingHits[0].title !== "Weekly Meeting") {
    throw new Error("Expected Buddy search to return Weekly Meeting.");
  }

  const runbookHits = await loadAndSearch(tempRoot, "maintenance");
  if (runbookHits.length !== 1 || runbookHits[0].path !== "Runbook.md") {
    throw new Error("Expected maintenance search to return Runbook.md.");
  }

  console.log("BUAP knowledge vault smoke passed");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
