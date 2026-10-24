import { createHash } from "node:crypto";

/**
 * Pure, read-only Mission Doctor. No tools are run, no credentials are read,
 * and a recommendation to resume is NEVER authorization to replay side effects.
 */
const safeInteger = n => Number.isSafeInteger(n) && n >= 0;
const hash = data => createHash("sha256").update(stable(data)).digest("hex");
function stable(data) {
  if (Array.isArray(data)) return "[" + data.map(stable).join(",") + "]";
  if (data && typeof data === "object") {
    return "{" + Object.keys(data).sort().map(k => JSON.stringify(k) + ":" + stable(data[k])).join(",") + "}";
  }
  if (data === undefined || typeof data === "bigint" || typeof data === "function" || typeof data === "symbol") {
    throw new Error("checkpoint contains unsupported value");
  }
  return JSON.stringify(data);
}
const copy = data => structuredClone(data);
const taskKey = (mission, id) => mission.taskKey(id);
const reason = (code, detail = null) => ({ code, ...(detail ? { detail } : {}) });

/** Actionable diagnostics; never equates a profile grant with a live host tool. */
export function inspectMission(mission) {
  if (!mission?.runtime?.profile || !Array.isArray(mission?.manifest?.steps) ||
      typeof mission.snapshot !== "function" || typeof mission.remainingBudget !== "function") {
    throw new Error("Mission Doctor requires a MissionControl instance");
  }
  const runtime = mission.runtime;
  const agent = runtime.snapshot();
  const state = mission.snapshot();
  const budget = mission.remainingBudget();
  const caps = runtime.capabilityReport();
  const connected = new Set(caps.connected);
  const denied = new Set(caps.denied);
  const maxParallel = mission.manifest.budget.max_parallel;
  const running = agent.tasks.filter(t => t.status === "in_progress").length;
  const reservations = Object.keys(state.reservations || {});
  const discrepancies = [];

  for (const id of reservations) {
    const task = agent.tasks.find(t => t.id === taskKey(mission, id));
    if (!task || task.status !== "in_progress") {
      discrepancies.push({ code: "orphaned_reservation", step_id: id });
    }
  }
  for (const step of mission.manifest.steps) {
    const owned = agent.tasks.find(t => t.id === taskKey(mission, step.id));
    if (owned?.status === "in_progress" && !Object.hasOwn(state.reservations, step.id)) {
      discrepancies.push({ code: "unreserved_in_progress", step_id: step.id });
    }
    if (owned?.status === "completed" && !Object.hasOwn(state.receipts, step.id)) {
      discrepancies.push({ code: "completion_without_receipt", step_id: step.id });
    }
    if (owned && ["failed", "cancelled"].includes(owned.status) &&
        Object.hasOwn(state.reservations, step.id)) {
      discrepancies.push({ code: "terminal_with_reservation", step_id: step.id });
    }
  }

  const steps = mission.manifest.steps.map(step => {
    const status = mission.status(step.id);
    const blockers = [];
    if (status === "in_progress") blockers.push(reason("requires_external_reconciliation"));
    else if (["completed", "failed", "cancelled"].includes(status)) {
      // Existing completion/failure is a terminal state: no retry is automatic.
    } else {
      if (agent.lifecycle_status !== "active") blockers.push(reason("agent_paused"));
      const deps = step.depends_on.map(id => ({ id, status: mission.status(id) }));
      const badDeps = deps.filter(d => ["failed", "cancelled"].includes(d.status));
      if (badDeps.length) blockers.push(reason("dependency_terminal", badDeps.map(d => d.id).join(",")));
      const pendingDeps = deps.filter(d => d.status !== "completed" &&
        !["failed", "cancelled"].includes(d.status));
      if (pendingDeps.length) blockers.push(reason("waiting_dependencies", pendingDeps.map(d => d.id).join(",")));
      for (const id of step.capabilities) {
        if (denied.has(id)) blockers.push(reason("capability_denied", id));
        else if (!connected.has(id)) blockers.push(reason("missing_capability", id));
      }
      for (const id of caps.missing_required) {
        if (!step.capabilities.includes(id)) blockers.push(reason("missing_required_profile_capability", id));
      }
      const auth = runtime.authorizeAction(step.action);
      if (auth.decision !== "allow") blockers.push(reason(
        auth.decision === "ask" ? "approval_required" : "policy_" + auth.decision, step.action));
      if (step.estimated_tokens > budget.tokens ||
          step.estimated_cost_cents > budget.cost_cents) blockers.push(reason("insufficient_budget"));
      if (reservations.length >= maxParallel) blockers.push(reason("mission_concurrency"));
      if (running >= runtime.profile.execution.max_concurrent_tasks) blockers.push(reason("agent_concurrency"));
    }
    return {
      id: step.id,
      title: step.title,
      status,
      ready: (status === "pending" || status === "queued") && blockers.length === 0 && discrepancies.length === 0,
      blockers,
      depends_on: copy(step.depends_on),
      estimated_tokens: step.estimated_tokens,
      estimated_cost_cents: step.estimated_cost_cents,
    };
  });

  const pendingApprovals = steps.filter(s => s.blockers.some(b => b.code === "approval_required")).map(s => s.id);
  const needsReconciliation = steps.filter(s => s.blockers.some(b => b.code === "requires_external_reconciliation")).map(s => s.id);
  const ready = steps.filter(s => s.ready).map(s => s.id);
  const completed = steps.length > 0 && steps.every(s => s.status === "completed");
  const exhausted = state.spent.tokens > mission.manifest.budget.max_tokens ||
    state.spent.cost_cents > mission.manifest.budget.max_cost_cents;
  if (exhausted) discrepancies.push({ code: "actual_usage_over_budget", step_id: null });
  const allBlocked = !completed && !needsReconciliation.length && !ready.length;
  const hasCapabilityGap = steps.some(s => s.blockers.some(b =>
    ["missing_capability", "capability_denied", "missing_required_profile_capability"].includes(b.code)));
  const health = discrepancies.length ? "needs_attention"
    : completed ? "completed"
    : hasCapabilityGap && !ready.length ? "blocked"
    : agent.lifecycle_status !== "active" ? "paused"
    : needsReconciliation.length ? "reconcile"
    : pendingApprovals.length ? "approval_pending"
    : allBlocked ? "blocked"
    : "ready";

  // DAG longest-path is a relative step-depth score, not an elapsed-time ETA.
  const lengths = new Map();
  const byId = new Map(mission.manifest.steps.map(s => [s.id, s]));
  function depth(id) {
    if (lengths.has(id)) return lengths.get(id);
    const step = byId.get(id);
    const value = 1 + (step?.depends_on.length ? Math.max(...step.depends_on.map(depth)) : 0);
    lengths.set(id, value);
    return value;
  }
  const criticalPathDepth = Math.max(...mission.manifest.steps.map(s => depth(s.id)));
  return {
    schema: "prismtek-mission-doctor-v1",
    mission_id: mission.manifest.id,
    agent_id: runtime.profile.id,
    health,
    ready,
    pending_approvals: pendingApprovals,
    requires_reconciliation: needsReconciliation,
    discrepancies,
    budget: {
      remaining: budget,
      spent: copy(state.spent),
      limits: copy(mission.manifest.budget),
      over_budget: exhausted,
    },
    active_reservations: reservations.length,
    critical_path_depth: criticalPathDepth,
    steps,
  };
}

/** One portable envelope for the pair; the host must persist it atomically. */
export function captureMissionCheckpoint(mission, { revision = 0 } = {}) {
  if (!safeInteger(revision)) throw new Error("checkpoint revision must be a nonnegative safe integer");
  const agent = mission.runtime.snapshot();
  const state = mission.snapshot();
  const envelope = {
    schema: "prismtek-mission-checkpoint-v1",
    revision,
    agent,
    mission: state,
  };
  return { ...envelope, sha256: hash(envelope) };
}

/**
 * Verify the entire paired envelope before constructing runtime objects.
 * This detects accidental/tampered corruption, NOT malicious rewrites or
 * rollback; hosts must enforce monotonic revision and protect storage.
 */
export function verifyMissionCheckpoint(checkpoint, {
  minimumRevision = 0,
  profileHash = null,
  missionHash = null,
} = {}) {
  if (!checkpoint || typeof checkpoint !== "object" || Array.isArray(checkpoint)) {
    throw new Error("invalid mission checkpoint");
  }
  const { sha256, ...body } = checkpoint;
  if (body.schema !== "prismtek-mission-checkpoint-v1" ||
      !safeInteger(body.revision) || !safeInteger(minimumRevision) ||
      body.revision < minimumRevision ||
      !body.agent || !body.mission || typeof sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(sha256) || hash(body) !== sha256) {
    throw new Error("mission checkpoint checksum/revision mismatch");
  }
  if (body.agent.schema !== "prismtek-agent-profile-state-v1" ||
      body.mission.schema !== "prismtek-agent-mission-state-v1" ||
      body.agent.profile_sha256 !== body.mission.agent_profile_sha256 ||
      (profileHash !== null && profileHash !== body.agent.profile_sha256) ||
      (missionHash !== null && missionHash !== body.mission.mission_sha256)) {
    throw new Error("mission checkpoint provenance mismatch");
  }
  return copy(body);
}

function escaped(text) {
  return String(text).replace(/[\\\`*_[\]<>|]/g, "\\$&").replace(/[\r\n]/g, " ");
}

/** Markdown preview is presentation only; source data remains typed JSON. */
export function renderMissionReport(diagnosis) {
  if (diagnosis?.schema !== "prismtek-mission-doctor-v1") throw new Error("invalid mission doctor report");
  const lines = [
    "# Mission " + escaped(diagnosis.mission_id),
    "",
    "**Health:** " + escaped(diagnosis.health),
    "**Ready:** " + (diagnosis.ready.map(escaped).join(", ") || "none"),
    "**Approvals:** " + (diagnosis.pending_approvals.map(escaped).join(", ") || "none"),
    "**Reconciliation:** " + (diagnosis.requires_reconciliation.map(escaped).join(", ") || "none"),
    "**Budget left:** " + diagnosis.budget.remaining.tokens + " tokens / " + diagnosis.budget.remaining.cost_cents + " cents",
    "",
    "## Steps",
  ];
  for (const step of diagnosis.steps) {
    const blockers = step.blockers.map(b => escaped(b.code + (b.detail ? " (" + b.detail + ")" : "")));
    lines.push("- **" + escaped(step.id) + "** — " + escaped(step.status) +
      (blockers.length ? " — " + blockers.join("; ") : step.ready ? " — ready" : ""));
  }
  if (diagnosis.discrepancies.length) {
    lines.push("", "## Integrity warnings");
    for (const issue of diagnosis.discrepancies) lines.push("- " + escaped(issue.code + ": " + (issue.step_id || "mission")));
  }
  return lines.join("\n") + "\n";
}
