#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const agentPath = path.join(packageRoot, "dist", "index.js");

const agent = spawn(process.execPath, [agentPath], {
  cwd: packageRoot,
  env: {
    ...process.env,
    BUAP_REPO_ROOT: path.resolve(packageRoot, "../.."),
    BUAP_WORKSPACE_ROOT: path.resolve(packageRoot, "../..")
  },
  stdio: ["pipe", "pipe", "pipe"]
});

const responses = [];
let buffer = "";
let sessionId = "";

function send(message) {
  agent.stdin.write(JSON.stringify(message) + "\n");
}

function fail(message) {
  agent.kill();
  console.error(message);
  process.exit(1);
}

agent.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

agent.stdout.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";

  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    responses.push(message);

    if (message.id === 1) {
      send({ jsonrpc: "2.0", id: 2, method: "session/new", params: { cwd: path.resolve(packageRoot, "../.."), mcpServers: [] } });
    }

    if (message.id === 2) {
      sessionId = message.result.sessionId;
      send({
        jsonrpc: "2.0",
        id: 3,
        method: "session/prompt",
        params: {
          sessionId,
          prompt: [{ type: "text", text: "/buap help" }]
        }
      });
    }

    if (message.id === 3) {
      const text = JSON.stringify(responses);
      for (const expected of ["/buap read", "/buap patch", "/buap apply", "/buap run", "available_commands_update"]) {
        if (!text.includes(expected)) fail(`Missing expected ACP smoke marker: ${expected}`);
      }
      console.log("BUAP ACP local launch smoke passed");
      agent.kill();
      process.exit(0);
    }
  }
});

agent.on("error", (error) => fail(error.message));

setTimeout(() => fail("Timed out waiting for BUAP ACP local smoke response"), 10000);

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: 1,
    clientCapabilities: {
      fs: { readTextFile: false, writeTextFile: false },
      terminal: false
    }
  }
});
