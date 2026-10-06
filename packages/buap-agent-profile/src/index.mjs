import crypto from "node:crypto";

const PROFILE_SCHEMA = "prismtek-agent-profile-v1";
const STATE_SCHEMA = "prismtek-agent-profile-state-v1";
const AGENT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function timestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("invalid timestamp");
  return date.toISOString();
}

function uniqueStrings(values, label) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  const normalized = values.map((value) => String(value).trim());
  if (normalized.some((value) => !value)) throw new Error(`${label} may not contain empty values`);
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} must be unique`);
  return normalized;
}

function actionMatches(pattern, action) {
  if (pattern === "*") return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -1);
    return action.startsWith(prefix);
  }
  return pattern === action;
}

export function validateAgentProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("agent profile must be an object");
  }
  if (profile.schema !== PROFILE_SCHEMA) {
    throw new Error(`unsupported agent profile schema: ${profile.schema}`);
  }

  const id = String(profile.id ?? "");
  if (!AGENT_ID.test(id)) throw new Error("agent profile id must be lowercase kebab-case");
  if (!String(profile.display_name ?? "").trim()) throw new Error("agent profile requires display_name");
  if (!String(profile.mission ?? "").trim()) throw new Error("agent profile requires mission");
  if (!["buddy", "lil_buddy", "specialist"].includes(profile.relationship_role)) {
    throw new Error("agent profile has invalid relationship_role");
  }
  if (!["primary", "specialist", "worker"].includes(profile.kind)) {
    throw new Error("agent profile has invalid kind");
  }

  uniqueStrings(profile.goals, "goals");
  uniqueStrings(profile.responsibilities, "responsibilities");

  if (!profile.identity || !["user", "self", "organization"].includes(profile.identity.name_source)) {
    throw new Error("agent profile requires identity.name_source");
  }
  if (!profile.memory || !String(profile.memory.namespace ?? "").trim()) {
    throw new Error("agent profile requires memory.namespace");
  }
  uniqueStrings(profile.memory.shared_context ?? [], "memory.shared_context");
  uniqueStrings(profile.memory.write_scopes ?? [], "memory.write_scopes");

  const execution = profile.execution;
  if (!execution || !Array.isArray(execution.preferred_targets) || execution.preferred_targets.length === 0) {
    throw new Error("agent profile requires execution.preferred_targets");
  }
  if (!Number.isInteger(execution.max_concurrent_tasks) || execution.max_concurrent_tasks < 1) {
    throw new Error("execution.max_concurrent_tasks must be a positive integer");
  }

  const required = uniqueStrings(profile.capabilities?.required ?? [], "capabilities.required");
  const optional = uniqueStrings(profile.capabilities?.optional ?? [], "capabilities.optional");
  const denied = uniqueStrings(profile.capabilities?.denied ?? [], "capabilities.denied");
  const deniedSet = new Set(denied);
  for (const capability of [...required, ...optional]) {
    if (deniedSet.has(capability)) {
      throw new Error(`capability ${capability} cannot be both allowed and denied`);
    }
  }

  if (!profile.autonomy || typeof profile.autonomy !== "object") {
    throw new Error("agent profile requires autonomy");
  }
  for (const field of ["proactive_research", "create_tasks", "schedule_tasks"]) {
    if (typeof profile.autonomy[field] !== "boolean") throw new Error(`autonomy.${field} must be boolean`);
  }

  if (!Array.isArray(profile.action_rules)) throw new Error("action_rules must be an array");
  for (const [index, rule] of profile.action_rules.entries()) {
    if (!String(rule?.match ?? "").trim()) throw new Error(`action_rules[${index}] requires match`);
    if (!["allow", "preapproved", "ask", "handoff", "deny"].includes(rule?.behavior)) {
      throw new Error(`action_rules[${index}] has invalid behavior`);
    }
  }

  uniqueStrings(profile.channels, "channels");
  if (!Array.isArray(profile.schedules)) throw new Error("schedules must be an array");

  return true;
}

export class AgentProfileRuntime {
  constructor(profile, snapshot = null) {
    validateAgentProfile(profile);
    this.profile = deepFreeze(clone(profile));
    this.profileHash = digest(profile);
    this.state = {
      schema: STATE_SCHEMA,
      agent_id: String(profile.id),
      profile_sha256: this.profileHash,
      lifecycle_status: "active",
      capability_bindings: [],
      tasks: [],
      activity: [],
      updated_at: null,
    };
    if (snapshot) this.restore(snapshot);
  }

  pause(now = new Date()) {
    if (this.state.lifecycle_status !== "paused") {
      this.state.lifecycle_status = "paused";
      this.#record("agent.paused", "Agent paused", null, now);
    }
    return this.snapshot();
  }

  resume(now = new Date()) {
    if (this.state.lifecycle_status !== "active") {
      this.state.lifecycle_status = "active";
      this.#record("agent.resumed", "Agent resumed", null, now);
    }
    return this.snapshot();
  }

  bindCapability(id, options = {}) {
    const capability = String(id ?? "").trim();
    if (!capability) throw new Error("capability id is required");
    const denied = new Set(this.profile.capabilities.denied ?? []);
    if (denied.has(capability)) throw new Error(`capability ${capability} is denied by profile`);

    const allowed = new Set([
      ...(this.profile.capabilities.required ?? []),
      ...(this.profile.capabilities.optional ?? []),
    ]);
    if (!allowed.has(capability)) {
      throw new Error(`capability ${capability} is not declared by profile`);
    }
    const evidenceRef = String(options.evidence_ref ?? "").trim();
    if (!evidenceRef) throw new Error("capability binding requires evidence_ref");

    const existing = this.state.capability_bindings.find((item) => item.id === capability);
    const binding = { id: capability, status: "connected", evidence_ref: evidenceRef };
    if (existing) Object.assign(existing, binding);
    else this.state.capability_bindings.push(binding);
    this.#record("capability.connected", `Connected capability ${capability}`, evidenceRef);
    return clone(binding);
  }

  unbindCapability(id) {
    const capability = String(id ?? "").trim();
    const existing = this.state.capability_bindings.find((item) => item.id === capability);
    if (!existing) return false;
    existing.status = "disconnected";
    this.#record("capability.disconnected", `Disconnected capability ${capability}`);
    return true;
  }

  capabilityReport() {
    const connected = new Set(
      this.state.capability_bindings.filter((item) => item.status === "connected").map((item) => item.id),
    );
    return {
      connected: [...connected].sort(),
      missing_required: (this.profile.capabilities.required ?? []).filter((id) => !connected.has(id)),
      optional_available: (this.profile.capabilities.optional ?? []).filter((id) => connected.has(id)),
      denied: [...(this.profile.capabilities.denied ?? [])],
    };
  }

  authorizeAction(action, options = {}) {
    const normalized = String(action ?? "").trim();
    if (!normalized) throw new Error("action is required");

    const rule = (this.profile.action_rules ?? []).find((candidate) => actionMatches(candidate.match, normalized));
    const behavior = rule?.behavior ?? "ask";
    let decision = behavior;
    if (behavior === "preapproved") {
      decision = options.preapproved === true ? "allow" : "ask";
    }
    return {
      action: normalized,
      decision,
      configured_behavior: behavior,
      matched_rule: rule ? clone(rule) : null,
    };
  }

  enqueueTask(task, options = {}) {
    if (!task || typeof task !== "object") throw new Error("task must be an object");
    const id = String(task.id ?? "").trim();
    const title = String(task.title ?? "").trim();
    const action = String(task.action ?? "task.execute").trim();
    if (!id || !title || !action) throw new Error("task requires id, title, and action");
    if (this.state.tasks.some((item) => item.id === id)) throw new Error(`duplicate task id ${id}`);

    const origin = options.origin ?? "user";
    if (origin === "agent" && this.profile.autonomy.create_tasks !== true) {
      throw new Error("profile does not permit autonomous task creation");
    }
    if (task.scheduled_for && origin === "agent" && this.profile.autonomy.schedule_tasks !== true) {
      throw new Error("profile does not permit autonomous scheduling");
    }

    const createdAt = timestamp(task.created_at ?? new Date());
    const scheduledFor = task.scheduled_for ? timestamp(task.scheduled_for) : undefined;
    const stored = {
      id,
      title,
      action,
      status: scheduledFor ? "scheduled" : "queued",
      preapproved: task.preapproved === true,
      created_at: createdAt,
      ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
    };
    this.state.tasks.push(stored);
    this.#record(
      scheduledFor ? "task.scheduled" : "task.queued",
      `${scheduledFor ? "Scheduled" : "Queued"} task ${id}: ${title}`,
      null,
      createdAt,
    );
    return clone(stored);
  }

  dueTasks(now = new Date()) {
    const current = new Date(now).getTime();
    if (Number.isNaN(current)) throw new Error("invalid dueTasks timestamp");
    return this.state.tasks
      .filter((task) => task.status === "scheduled" && new Date(task.scheduled_for).getTime() <= current)
      .map(clone);
  }

  standingSchedules() {
    return (this.profile.schedules ?? []).filter((schedule) => schedule.enabled === true).map(clone);
  }

  activityView() {
    return {
      queued: this.state.tasks.filter((task) => task.status === "queued").map(clone),
      in_progress: this.state.tasks.filter((task) => task.status === "in_progress").map(clone),
      scheduled: this.state.tasks.filter((task) => task.status === "scheduled").map(clone),
      completed: this.state.tasks
        .filter((task) => ["completed", "failed", "cancelled"].includes(task.status))
        .map(clone),
    };
  }

  canProactivelyResearch() {
    return (
      this.state.lifecycle_status === "active" &&
      this.profile.execution.background_allowed === true &&
      this.profile.autonomy.proactive_research === true &&
      this.capabilityReport().missing_required.length === 0
    );
  }

  startTask(id, options = {}) {
    if (this.state.lifecycle_status !== "active") {
      return { started: false, decision: "paused", task: this.#task(id) };
    }

    const capabilityReport = this.capabilityReport();
    if (capabilityReport.missing_required.length) {
      return {
        started: false,
        decision: "missing_capabilities",
        missing_capabilities: capabilityReport.missing_required,
        task: this.#task(id),
      };
    }

    const task = this.#task(id);
    if (!["queued", "scheduled"].includes(task.status)) {
      throw new Error(`task ${task.id} cannot start from status ${task.status}`);
    }
    if (task.status === "scheduled") {
      const nowMs = new Date(options.now ?? new Date()).getTime();
      if (new Date(task.scheduled_for).getTime() > nowMs) {
        return { started: false, decision: "not_due", task: clone(task) };
      }
    }

    const running = this.state.tasks.filter((item) => item.status === "in_progress").length;
    if (running >= this.profile.execution.max_concurrent_tasks) {
      return { started: false, decision: "concurrency_limit", task: clone(task) };
    }

    const authorization = this.authorizeAction(task.action, {
      preapproved: options.preapproved ?? task.preapproved,
    });
    if (authorization.decision !== "allow") {
      return { started: false, decision: authorization.decision, authorization, task: clone(task) };
    }

    task.status = "in_progress";
    task.started_at = timestamp(options.now ?? new Date());
    this.#record("task.started", `Started task ${task.id}: ${task.title}`, null, task.started_at);
    return { started: true, decision: "allow", authorization, task: clone(task) };
  }

  completeTask(id, options = {}) {
    const task = this.#task(id);
    if (task.status !== "in_progress") throw new Error(`task ${task.id} is not in progress`);
    task.status = "completed";
    task.completed_at = timestamp(options.now ?? new Date());
    if (options.result_ref) task.result_ref = String(options.result_ref);
    this.#record("task.completed", `Completed task ${task.id}: ${task.title}`, task.result_ref, task.completed_at);
    return clone(task);
  }

  failTask(id, error, options = {}) {
    const task = this.#task(id);
    if (task.status !== "in_progress") throw new Error(`task ${task.id} is not in progress`);
    task.status = "failed";
    task.completed_at = timestamp(options.now ?? new Date());
    task.error = String(error ?? "unknown failure");
    this.#record("task.failed", `Failed task ${task.id}: ${task.error}`, null, task.completed_at);
    return clone(task);
  }

  cancelTask(id, options = {}) {
    const task = this.#task(id);
    if (["completed", "failed", "cancelled"].includes(task.status)) {
      throw new Error(`task ${task.id} cannot be cancelled from status ${task.status}`);
    }
    task.status = "cancelled";
    task.completed_at = timestamp(options.now ?? new Date());
    this.#record("task.cancelled", `Cancelled task ${task.id}: ${task.title}`, null, task.completed_at);
    return clone(task);
  }

  snapshot() {
    return clone(this.state);
  }

  restore(snapshot) {
    if (!snapshot || snapshot.schema !== STATE_SCHEMA) {
      throw new Error("unsupported agent profile state schema");
    }
    if (snapshot.agent_id !== this.profile.id) throw new Error("snapshot belongs to a different agent");
    if (snapshot.profile_sha256 !== this.profileHash) {
      throw new Error("snapshot was created from a different agent profile");
    }
    const restored = clone(snapshot);
    restored.capability_bindings = Array.isArray(restored.capability_bindings)
      ? restored.capability_bindings
      : [];
    restored.tasks = Array.isArray(restored.tasks) ? restored.tasks : [];
    restored.activity = Array.isArray(restored.activity) ? restored.activity : [];
    restored.lifecycle_status = restored.lifecycle_status === "paused" ? "paused" : "active";
    this.state = restored;
    return this.snapshot();
  }

  #task(id) {
    const normalized = String(id ?? "").trim();
    const task = this.state.tasks.find((item) => item.id === normalized);
    if (!task) throw new Error(`unknown task ${normalized || "<missing>"}`);
    return task;
  }

  #record(kind, summary, ref = null, at = new Date()) {
    const occurredAt = timestamp(at);
    const entry = {
      at: occurredAt,
      kind: String(kind),
      summary: String(summary),
      ...(ref ? { ref: String(ref) } : {}),
    };
    this.state.activity.push(entry);
    if (this.state.activity.length > 200) {
      this.state.activity.splice(0, this.state.activity.length - 200);
    }
    this.state.updated_at = occurredAt;
  }
}

export const AgentProfileSchemas = Object.freeze({
  profile: PROFILE_SCHEMA,
  state: STATE_SCHEMA,
});
