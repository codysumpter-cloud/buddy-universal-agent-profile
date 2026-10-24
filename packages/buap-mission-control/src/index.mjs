
import { createHash } from "node:crypto";

/**
 * BUAP Mission Control: durable, host-portable planning around AgentProfileRuntime.
 * This does not execute tools, spawn workers, persist files or approve actions.
 */
const STEP_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ZERO = "0".repeat(64);
const VERDICT = new Set(["pass", "fail", "unverified"]);

function clone(v) { return structuredClone(v); }
function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
function hash(v) { return createHash("sha256").update(canonical(v)).digest("hex"); }
function nonempty(v) { return typeof v === "string" && v.trim().length > 0 && v.length <= 2048; }
function nat(v) { return Number.isSafeInteger(v) && v >= 0; }
function arrayUnique(v) { return Array.isArray(v) && new Set(v).size === v.length; }
function taskOf(runtime, id) { return runtime.snapshot().tasks.find(t => t.id === id) ?? null; }

export function validateMission(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) || !STEP_ID.test(manifest.id || "")) {
    throw new Error("mission requires kebab-case id");
  }
  if (!nonempty(manifest.title) || !Array.isArray(manifest.steps) ||
    manifest.steps.length === 0 || manifest.steps.length > 128) throw new Error("mission requires 1..128 steps and title");
  const budget = manifest.budget;
  if (!budget || !nat(budget.max_tokens) || !nat(budget.max_cost_cents) ||
    !Number.isInteger(budget.max_parallel) || budget.max_parallel < 1 || budget.max_parallel > 32) {
    throw new Error("mission requires bounded token, cents and concurrency budgets");
  }
  const byId = new Map();
  for (const step of manifest.steps) {
    if (!step || !STEP_ID.test(step.id || "") || !nonempty(step.title) || !nonempty(step.action) ||
      !arrayUnique(step.depends_on) || !arrayUnique(step.capabilities) ||
      step.capabilities.some(c => !nonempty(c)) || !nat(step.estimated_tokens) ||
      !nat(step.estimated_cost_cents) || !arrayUnique(step.checks) ||
      step.checks.some(c => !nonempty(c)) || step.checks.length === 0) {
      throw new Error("invalid mission step shape");
    }
    if (byId.has(step.id)) throw new Error("duplicate mission step id");
    byId.set(step.id, step);
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error("mission dependency cycle");
    if (visited.has(id)) return;
    const step = byId.get(id);
    if (!step) throw new Error("unknown mission dependency");
    visiting.add(id);
    for (const dep of step.depends_on) {
      if (dep === id) throw new Error("mission self-dependency");
      visit(dep);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of byId.keys()) visit(id);
  return true;
}

/** Evaluate an external tool invocation before offering it to the host. */
export function inspectToolAction(runtime, { action, capability, sideEffect = false, untrustedSource = false, preapproved = false } = {}) {
  if (!nonempty(action) || !nonempty(capability)) throw new Error("tool action and capability are required");
  const report = runtime.capabilityReport();
  if (report.denied.includes(capability)) return { decision: "deny", reason: "capability_denied" };
  if (!report.connected.includes(capability)) return { decision: "deny", reason: "capability_not_verified" };
  const policy = runtime.authorizeAction(action, { preapproved });
  if (policy.decision !== "allow") return { decision: policy.decision, reason: "profile_policy" };
  // Never let prompt injection in retrieved material trigger mutations, even
  // if the profile has a broadly configured allow rule.
  if (sideEffect || untrustedSource) return { decision: "ask", reason: sideEffect ? "side_effect" : "untrusted_source" };
  return { decision: "allow", reason: "read_only_verified" };
}

export function createHandoff(runtime, manifest, stepId, { sources = [], scope, requestId } = {}) {
  validateMission(manifest);
  const step = manifest.steps.find(s => s.id === stepId);
  if (!step) throw new Error("unknown handoff step");
  if (!nonempty(scope) || !nonempty(requestId) || !arrayUnique(sources) ||
    sources.some(s => !nonempty(s)) || sources.length > 32) throw new Error("invalid handoff provenance");
  return {
    schema: "prismtek-agent-handoff-v1",
    request_id: requestId, mission_id: manifest.id, mission_sha256: hash(manifest),
    from_agent: runtime.profile.id, task_id: step.id, action: step.action,
    title: step.title, scope, capabilities: clone(step.capabilities),
    source_refs: clone(sources), required_checks: clone(step.checks),
    limits: { tokens: step.estimated_tokens, cost_cents: step.estimated_cost_cents },
    authorization: runtime.authorizeAction(step.action),
    // This is a BUAP handoff envelope, NOT a verified A2A protocol session.
    transport: "host_managed",
  };
}

/**
 * Composes the existing AgentProfileRuntime task lifecycle; it does not
 * duplicate its queued/in-progress/completed source of truth.
 */
export class MissionControl {
  constructor(runtime, manifest, snapshot = null) {
    if (!runtime?.profile || typeof runtime.enqueueTask !== "function" ||
      typeof runtime.startTask !== "function" || typeof runtime.snapshot !== "function") {
      throw new Error("MissionControl requires an AgentProfileRuntime");
    }
    validateMission(manifest);
    this.runtime = runtime;
    this.manifest = clone(manifest);
    this.manifestHash = hash(this.manifest);
    this.state = {
      schema: "prismtek-agent-mission-state-v1",
      mission_id: manifest.id,
      mission_sha256: this.manifestHash,
      agent_profile_sha256: runtime.profileHash,
      spent: { tokens: 0, cost_cents: 0 },
      reservations: {},
      receipts: {},
      audit: [], anchor: ZERO,
    };
    if (snapshot) this.restore(snapshot);
  }

  step(id) {
    const step = this.manifest.steps.find(s => s.id === id);
    if (!step) throw new Error("unknown mission step");
    return step;
  }

  status(id) {
    this.step(id);
    const record = taskOf(this.runtime, id);
    if (record) return record.status;
    return "pending";
  }

  ready() {
    return this.manifest.steps.filter(s => this.status(s.id) === "pending" &&
      s.depends_on.every(dep => this.status(dep) === "completed")).map(s => s.id);
  }

  remainingBudget() {
    const reservations = Object.values(this.state.reservations).reduce(
      (a, b) => ({ tokens: a.tokens + b.tokens, cost_cents: a.cost_cents + b.cost_cents }),
      { tokens: 0, cost_cents: 0 });
    return {
      tokens: Math.max(0, this.manifest.budget.max_tokens - this.state.spent.tokens - reservations.tokens),
      cost_cents: Math.max(0, this.manifest.budget.max_cost_cents - this.state.spent.cost_cents - reservations.cost_cents),
    };
  }

  /** Does NOT spawn a process or execute the action. Caller must run host tools separately. */
  begin(id, { now = new Date(), preapproved = false } = {}) {
    const step = this.step(id);
    const existing = taskOf(this.runtime, id);
    if (existing && existing.status !== "queued") return { started: false, decision: "already_claimed" };
    if (!step.depends_on.every(dep => this.status(dep) === "completed")) {
      return { started: false, decision: "waiting_dependencies" };
    }
    const caps = this.runtime.capabilityReport().connected;
    const missing = step.capabilities.filter(c => !caps.includes(c));
    if (missing.length) return { started: false, decision: "missing_capabilities", missing };
    const running = Object.values(this.state.reservations).length;
    if (running >= this.manifest.budget.max_parallel) return { started: false, decision: "mission_concurrency" };
    const remaining = this.remainingBudget();
    if (step.estimated_tokens > remaining.tokens || step.estimated_cost_cents > remaining.cost_cents) {
      return { started: false, decision: "mission_budget" };
    }
    const action = this.runtime.authorizeAction(step.action, { preapproved });
    if (action.decision !== "allow") return { started: false, decision: action.decision, authorization: action };
    if (!existing) {
      this.runtime.enqueueTask({ id, title: step.title, action: step.action }, { origin: "user" });
    }
    const started = this.runtime.startTask(id, { now, preapproved });
    if (!started.started) return started;
    this.state.reservations[id] = { tokens: step.estimated_tokens, cost_cents: step.estimated_cost_cents };
    this.record("mission.started", id, { budget: clone(this.state.reservations[id]) });
    return { started: true, decision: "allow", task: started.task };
  }

  /** Completion requires source-backed receipts and every declared check. */
  complete(id, { result_ref, checks, usage, sources = [], now = new Date() } = {}) {
    const step = this.step(id);
    if (this.status(id) !== "in_progress" || !this.state.reservations[id]) throw new Error("mission task not in progress");
    if (!nonempty(result_ref) || !Array.isArray(checks) ||
      checks.length !== step.checks.length ||
      new Set(checks.map(c => c?.name)).size !== step.checks.length ||
      checks.some(c => !step.checks.includes(c?.name) || !VERDICT.has(c?.status) ||
        c.status !== "pass" || !nonempty(c?.evidence_ref))) {
      throw new Error("mission completion requires passing named checks with evidence");
    }
    if (!usage || !nat(usage.tokens) || !nat(usage.cost_cents) ||
      !arrayUnique(sources) || sources.some(s => !nonempty(s)) || sources.length > 32) {
      throw new Error("mission requires measured bounded usage and source references");
    }
    this.runtime.completeTask(id, { now, result_ref });
    const receipt = { task_id: id, result_ref, checks: clone(checks), usage: clone(usage), source_refs: clone(sources) };
    this.state.receipts[id] = receipt;
    this.state.spent.tokens += usage.tokens;
    this.state.spent.cost_cents += usage.cost_cents;
    delete this.state.reservations[id];
    this.record("mission.completed", id, { result_ref, usage: clone(usage) });
    return clone(receipt);
  }

  fail(id, { reason, now = new Date() } = {}) {
    this.step(id);
    if (this.status(id) !== "in_progress" || !this.state.reservations[id]) throw new Error("mission task not in progress");
    if (!nonempty(reason)) throw new Error("mission failure requires a reason");
    const task = this.runtime.failTask(id, reason, { now });
    delete this.state.reservations[id];
    this.record("mission.failed", id, { reason_code: reason });
    return task;
  }

  record(kind, stepId, payload) {
    if (!nonempty(kind) || !nonempty(stepId)) throw new Error("audit event requires kind and task");
    const prev = this.state.audit.at(-1)?.hash ?? this.state.anchor;
    const event = { seq: (this.state.audit.at(-1)?.seq ?? 0) + 1, prev, kind, step_id: stepId, payload: clone(payload) };
    event.hash = hash(event);
    this.state.audit.push(event);
    if (this.state.audit.length > 256) this.state.anchor = this.state.audit.shift().hash;
    return clone(event);
  }

  snapshot() { return clone(this.state); }

  restore(snapshot) {
    if (!snapshot || snapshot.schema !== this.state.schema ||
      snapshot.mission_id !== this.manifest.id || snapshot.mission_sha256 !== this.manifestHash ||
      snapshot.agent_profile_sha256 !== this.runtime.profileHash) throw new Error("mission snapshot provenance mismatch");
    if (!nat(snapshot.spent?.tokens) || !nat(snapshot.spent?.cost_cents) ||
      !Array.isArray(snapshot.audit) || snapshot.audit.length > 256 ||
      !/^[a-f0-9]{64}$/.test(snapshot.anchor || "") ||
      !snapshot.reservations || typeof snapshot.reservations !== "object" ||
      !snapshot.receipts || typeof snapshot.receipts !== "object") throw new Error("invalid mission snapshot");
    let prev = snapshot.anchor;
    for (const event of snapshot.audit) {
      const { hash: actual, ...body } = event;
      if (body.prev !== prev || actual !== hash(body)) throw new Error("mission audit integrity check failed");
      prev = actual;
    }
    for (const [id, value] of Object.entries(snapshot.reservations)) {
      if (!this.manifest.steps.some(s => s.id === id) ||
        this.status(id) !== "in_progress" || !nat(value.tokens) || !nat(value.cost_cents)) {
        throw new Error("mission reservations do not match agent runtime");
      }
    }
    for (const id of Object.keys(snapshot.receipts)) {
      if (!this.manifest.steps.some(s => s.id === id) || this.status(id) !== "completed") {
        throw new Error("mission receipts do not match agent runtime");
      }
    }
    this.state = clone(snapshot);
    return this.snapshot();
  }

  report() {
    return {
      mission_id: this.manifest.id,
      profile_id: this.runtime.profile.id,
      ready: this.ready(),
      spent: clone(this.state.spent),
      remaining: this.remainingBudget(),
      steps: this.manifest.steps.map(s => ({ id: s.id, status: this.status(s.id), dependencies: clone(s.depends_on) })),
      receipts: Object.keys(this.state.receipts),
      audit_head: this.state.audit.at(-1)?.hash ?? this.state.anchor,
    };
  }
}
