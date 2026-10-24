#!/usr/bin/env node
/**
 * Guard public BUAP source against absolute home-directory paths and
 * credential-shaped strings. Not a full personal-data classifier.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const home = new RegExp(["/", "Users", "/", "([a-zA-Z][a-zA-Z0-9._-]+)", "/"].join(""), "g");
const windows = /[A-Za-z]:\\Users\\([A-Za-z][A-Za-z0-9._-]+)\\/g;
const token = /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-proj-[A-Za-z0-9_-]{20,})\b/g;
const exempt = new Set(["user","username","yourname","your_name","example","name"]);
const errors = [];
for (const file of tracked) {
  let data;
  try { data = fs.readFileSync(file); } catch { continue; }
  if (data.includes(0)) continue;
  const content = data.toString("utf8");
  for (const [kind, pattern] of [["macOS home path",home],["Windows home path",windows],["credential-shaped string",token]]) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      if (kind !== "credential-shaped string" && exempt.has((match[1] || "").toLowerCase())) continue;
      const line = content.slice(0, match.index).split("\n").length;
      errors.push(file + ":" + line + " — " + kind);
    }
  }
}
if (errors.length) {
  console.error("BUAP public privacy check failed:\n" + errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("BUAP public privacy check passed: " + tracked.length + " tracked files examined");
}
