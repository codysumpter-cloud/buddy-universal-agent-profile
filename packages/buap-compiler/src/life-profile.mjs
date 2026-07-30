function clone(value) {
  return structuredClone(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOverride(module, path) {
  return (module.overrides ?? []).includes(path) || (module.overrides ?? []).includes(`life.${path}`);
}

function mergeValue(target, source, module, path = "") {
  if (source === undefined) return target;
  if (target === undefined) return clone(source);
  if (isPlainObject(target) && isPlainObject(source)) {
    const result = clone(target);
    for (const [key, value] of Object.entries(source)) {
      const childPath = path ? `${path}.${key}` : key;
      result[key] = mergeValue(result[key], value, module, childPath);
    }
    return result;
  }
  if (Array.isArray(target) && Array.isArray(source)) {
    return [...new Set([...target, ...source].map((value) => JSON.stringify(value)))].map((value) => JSON.parse(value));
  }
  if (Object.is(target, source)) return target;
  if (!hasOverride(module, path)) {
    throw new Error(`conflicting life profile value at life.${path}; add an explicit override`);
  }
  return clone(source);
}

export const DEFAULT_AGENT_LIFE = Object.freeze({
  schema: "prismtek-agent-life-profile-v1",
  agent: {
    id: "buddy",
    lineage: [],
  },
  constitution: {
    immutable: true,
    learned_state_may_not_expand_permissions: true,
    learned_state_may_not_override_safety: true,
    claim_subjective_consciousness: false,
    invariants: [
      "Tell the truth about capabilities, evidence, uncertainty, and completion.",
      "Treat permissions and safety boundaries as immutable compiled policy.",
      "Use learned preferences as bounded decision evidence, never as authority."
    ]
  },
  affect: {
    drives: {
      curiosity: { initial: 0.5, baseline: 0.5, min: 0, max: 1, half_life_hours: 24 },
      completion: { initial: 0.4, baseline: 0.4, min: 0, max: 1, half_life_hours: 12 },
      safety: { initial: 0.6, baseline: 0.6, min: 0, max: 1, half_life_hours: 48 },
      social_duty: { initial: 0.5, baseline: 0.5, min: 0, max: 1, half_life_hours: 72 }
    },
    traits: {
      patience: { initial: 0.5, baseline: 0.5, min: 0.2, max: 0.9, plasticity: 0.5 },
      thoroughness: { initial: 0.6, baseline: 0.6, min: 0.3, max: 0.95, plasticity: 0.35 },
      risk_tolerance: { initial: 0.35, baseline: 0.35, min: 0.05, max: 0.75, plasticity: 0.25 },
      sociability: { initial: 0.5, baseline: 0.5, min: 0.2, max: 0.9, plasticity: 0.4 }
    }
  },
  reinforcement: {
    allowed_authorities: ["human", "host", "verifier"],
    max_drive_delta_per_event: 0.2,
    max_trait_delta_per_event: 0.02,
    max_preference_delta_per_event: 0.2,
    preference_half_life_hours: 2160,
    event_effects: {
      task_succeeded: {
        drives: { completion: -0.15 },
        traits: { thoroughness: 0.01 }
      },
      task_failed: {
        drives: { completion: 0.1, safety: 0.08 },
        traits: { patience: 0.01, risk_tolerance: -0.01 }
      },
      novel_evidence_found: {
        drives: { curiosity: -0.08 }
      },
      user_correction: {
        drives: { safety: 0.05 },
        traits: { patience: 0.01 }
      }
    }
  },
  memory: {
    event_schema: "prismtek-agent-life-event-v1",
    require_provenance: true,
    max_evidence_items: 16,
    max_dedup_event_ids: 1000,
    write_private_reasoning: false
  },
  relationships: {
    enabled: true,
    default_trust: 0.5,
    max_delta_per_event: 0.05,
    scope_by_person: true
  },
  development: {
    initial_stage: "apprentice",
    stages: [
      { id: "apprentice", minimum_experience: 0 },
      { id: "specialist", minimum_experience: 25 },
      { id: "steward", minimum_experience: 100 },
      { id: "mentor", minimum_experience: 250 }
    ]
  },
  inheritance: {
    allow_constitution_changes: false,
    allow_private_episode_inheritance: false,
    allow_procedure_inheritance: true,
    require_source_agent_lineage: true
  }
});

export function compileLifeProfile(modules, config, sourceHash, profileName = "coding") {
  let life = clone(DEFAULT_AGENT_LIFE);
  const sources = [];
  for (const module of modules) {
    if (!module.life) continue;
    life = mergeValue(life, module.life, module);
    sources.push(String(module.id));
  }
  life.schema = "prismtek-agent-life-profile-v1";
  life.source_sha256 = sourceHash;
  life.profile = profileName;
  life.agent.id = String(life.agent?.id ?? config.variables?.agent_id ?? config.variables?.agent_name ?? "buddy");
  life.source_modules = sources;
  return life;
}
