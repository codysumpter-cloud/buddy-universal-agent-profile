import { digest, stableStringify } from "./targets.mjs";

const AGENT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RELATIONSHIP_ROLES = new Set(["buddy", "lil_buddy", "specialist"]);
const KINDS = new Set(["primary", "specialist", "worker"]);
const NAME_SOURCES = new Set(["user", "self", "organization"]);
const EXECUTION_TARGETS = new Set(["chat", "work", "codex_cloud", "local_computer", "cloud_computer", "ide", "daemon"]);
const CHANNELS = new Set(["chat", "slack", "teams", "email", "sms", "voice", "app", "cli", "ide"]);
const ACTION_BEHAVIORS = new Set(["allow", "preapproved", "ask", "handoff", "deny"]);

function clone(value) {
  return structuredClone(value);
}

function array(value, fallback = []) {
  return Array.isArray(value) ? clone(value) : clone(fallback);
}

function compileDefinition(definition, resolvedProfiles, sourceHash) {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    throw new Error("agentProfiles entries must be objects");
  }

  const id = String(definition.id ?? "").trim();
  if (!AGENT_ID.test(id)) throw new Error(`agentProfiles id "${id}" must be lowercase kebab-case`);

  const policyProfile = String(definition.policyProfile ?? "coding");
  const policy = resolvedProfiles[policyProfile];
  if (!policy) throw new Error(`agentProfiles.${id} references missing policy profile ${policyProfile}`);

  const displayName = String(definition.displayName ?? definition.display_name ?? "").trim();
  if (!displayName) throw new Error(`agentProfiles.${id} requires displayName`);

  const mission = String(definition.mission ?? "").trim();
  if (!mission) throw new Error(`agentProfiles.${id} requires mission`);

  const providerCapabilities = array(policy.providers?.buddy?.capabilities);
  const profile = {
    schema: "prismtek-agent-profile-v1",
    source_sha256: sourceHash,
    id,
    display_name: displayName,
    relationship_role: String(definition.relationshipRole ?? definition.relationship_role ?? "specialist"),
    kind: String(definition.kind ?? "specialist"),
    mission,
    goals: array(definition.goals),
    responsibilities: array(definition.responsibilities),
    identity: {
      name_source: String(definition.identity?.name_source ?? definition.nameSource ?? "self"),
      ...(definition.identity?.handle ? { handle: String(definition.identity.handle) } : {}),
      ...(definition.identity?.avatar_ref ? { avatar_ref: String(definition.identity.avatar_ref) } : {}),
      ...(definition.identity?.pet_ref ? { pet_ref: String(definition.identity.pet_ref) } : {}),
    },
    ...(definition.model ? { model: clone(definition.model) } : { model: { strategy: "host_default" } }),
    memory: {
      namespace: String(definition.memory?.namespace ?? `agents/${id}`),
      shared_context: array(definition.memory?.shared_context),
      write_scopes: array(definition.memory?.write_scopes, [`agents/${id}`]),
      proactive_learning: definition.memory?.proactive_learning === true,
      ...(definition.memory?.life_profile_ref
        ? { life_profile_ref: String(definition.memory.life_profile_ref) }
        : {}),
    },
    execution: {
      preferred_targets: array(definition.execution?.preferred_targets, ["chat"]),
      background_allowed: definition.execution?.background_allowed === true,
      max_concurrent_tasks: Number.isInteger(definition.execution?.max_concurrent_tasks)
        ? definition.execution.max_concurrent_tasks
        : 1,
    },
    capabilities: {
      required: array(definition.capabilities?.required),
      optional: array(definition.capabilities?.optional, providerCapabilities),
      denied: array(definition.capabilities?.denied),
    },
    autonomy: {
      proactive_research: definition.autonomy?.proactive_research === true,
      create_tasks: definition.autonomy?.create_tasks === true,
      schedule_tasks: definition.autonomy?.schedule_tasks === true,
    },
    action_rules: array(definition.actionRules ?? definition.action_rules, [{ match: "*", behavior: "ask" }]),
    channels: array(definition.channels, ["chat"]),
    schedules: array(definition.schedules),
    policy_profile: policyProfile,
    policy_permissions: clone(policy.permissions),
  };

  if (profile.goals.length === 0) throw new Error(`agentProfiles.${id} requires at least one goal`);
  if (profile.responsibilities.length === 0) {
    throw new Error(`agentProfiles.${id} requires at least one responsibility`);
  }
  if (!RELATIONSHIP_ROLES.has(profile.relationship_role)) {
    throw new Error(`agentProfiles.${id} has invalid relationshipRole ${profile.relationship_role}`);
  }
  if (!KINDS.has(profile.kind)) {
    throw new Error(`agentProfiles.${id} has invalid kind ${profile.kind}`);
  }
  if (!NAME_SOURCES.has(profile.identity.name_source)) {
    throw new Error(`agentProfiles.${id} has invalid nameSource ${profile.identity.name_source}`);
  }
  if (
    !Number.isInteger(profile.execution.max_concurrent_tasks) ||
    profile.execution.max_concurrent_tasks < 1 ||
    profile.execution.max_concurrent_tasks > 64
  ) {
    throw new Error(`agentProfiles.${id} max_concurrent_tasks must be an integer in 1..64`);
  }
  for (const target of profile.execution.preferred_targets) {
    if (!EXECUTION_TARGETS.has(target)) {
      throw new Error(`agentProfiles.${id} has invalid execution target ${target}`);
    }
  }
  for (const channel of profile.channels) {
    if (!CHANNELS.has(channel)) throw new Error(`agentProfiles.${id} has invalid channel ${channel}`);
  }
  const denied = new Set(profile.capabilities.denied);
  for (const capability of [...profile.capabilities.required, ...profile.capabilities.optional]) {
    if (denied.has(capability)) {
      throw new Error(`agentProfiles.${id} capability ${capability} cannot be both allowed and denied`);
    }
  }
  for (const [index, rule] of profile.action_rules.entries()) {
    if (!String(rule?.match ?? "").trim() || !ACTION_BEHAVIORS.has(rule?.behavior)) {
      throw new Error(`agentProfiles.${id} actionRules[${index}] is invalid`);
    }
  }
  for (const [index, schedule] of profile.schedules.entries()) {
    if (!AGENT_ID.test(String(schedule?.id ?? ""))) {
      throw new Error(`agentProfiles.${id} schedules[${index}].id must be lowercase kebab-case`);
    }
    if (!String(schedule?.prompt ?? "").trim() || !String(schedule?.rrule ?? "").trim()) {
      throw new Error(`agentProfiles.${id} schedules[${index}] requires prompt and rrule`);
    }
    if (typeof schedule?.enabled !== "boolean") {
      throw new Error(`agentProfiles.${id} schedules[${index}].enabled must be boolean`);
    }
  }

  return profile;
}

export function compileAgentProfiles(config, resolvedProfiles, sourceHash) {
  const definitions = config.agentProfiles ?? [];
  if (!Array.isArray(definitions)) throw new Error("agentProfiles must be an array");

  const seen = new Set();
  const outputs = new Map();
  const index = [];

  for (const definition of definitions) {
    const profile = compileDefinition(definition, resolvedProfiles, sourceHash);
    if (seen.has(profile.id)) throw new Error(`duplicate agent profile id ${profile.id}`);
    seen.add(profile.id);

    const path = `.buddy/agents/${profile.id}/profile.json`;
    const content = `${stableStringify(profile)}\n`;
    outputs.set(path, content);
    index.push({
      id: profile.id,
      display_name: profile.display_name,
      relationship_role: profile.relationship_role,
      kind: profile.kind,
      policy_profile: profile.policy_profile,
      path,
      profile_sha256: digest(profile),
    });
  }

  if (index.length) {
    outputs.set(
      ".buddy/agents/index.json",
      `${stableStringify({
        schema: "prismtek-agent-profile-index-v1",
        source_sha256: sourceHash,
        agents: index.sort((a, b) => a.id.localeCompare(b.id)),
      })}\n`,
    );
  }

  return outputs;
}
