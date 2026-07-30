import crypto from "node:crypto";

const PROFILE_SCHEMA = "prismtek-agent-life-profile-v1";
const STATE_SCHEMA = "prismtek-agent-life-state-v1";
const EVENT_SCHEMA = "prismtek-agent-life-event-v1";

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function subjectKey(subject) {
  if (!subject || typeof subject !== "object") throw new Error("event.subject is required");
  const type = String(subject.type ?? "").trim();
  const id = String(subject.id ?? "").trim();
  if (!type || !id) throw new Error("event.subject requires type and id");
  return `${type}:${id}`;
}

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizedDimension(definition, fallbackInitial = 0.5) {
  const minimum = finiteNumber(definition?.min, 0);
  const maximum = finiteNumber(definition?.max, 1);
  if (maximum <= minimum) throw new Error("dimension max must be greater than min");
  const initial = clamp(finiteNumber(definition?.initial, fallbackInitial), minimum, maximum);
  return {
    min: minimum,
    max: maximum,
    initial,
    baseline: clamp(finiteNumber(definition?.baseline, initial), minimum, maximum),
    half_life_hours: Math.max(0, finiteNumber(definition?.half_life_hours, 0)),
    plasticity: clamp(finiteNumber(definition?.plasticity, 1), 0, 1),
  };
}

function decayToward(value, target, halfLifeHours, elapsedHours) {
  if (elapsedHours <= 0 || halfLifeHours <= 0) return value;
  const remaining = 0.5 ** (elapsedHours / halfLifeHours);
  return target + (value - target) * remaining;
}

function mergeEffectMaps(...maps) {
  const result = {};
  for (const map of maps) {
    if (!map || typeof map !== "object") continue;
    for (const [key, raw] of Object.entries(map)) {
      result[key] = finiteNumber(result[key], 0) + finiteNumber(raw, 0);
    }
  }
  return result;
}

export function validateLifeProfile(profile) {
  if (!profile || typeof profile !== "object") throw new Error("life profile must be an object");
  if (profile.schema !== PROFILE_SCHEMA) throw new Error(`unsupported life profile schema: ${profile.schema}`);
  if (!profile.agent || !String(profile.agent.id ?? "").trim()) throw new Error("life profile requires agent.id");
  if (!profile.constitution || typeof profile.constitution !== "object") {
    throw new Error("life profile requires an immutable constitution");
  }
  const authorities = profile.reinforcement?.allowed_authorities;
  if (!Array.isArray(authorities) || authorities.length === 0) {
    throw new Error("life profile requires reinforcement.allowed_authorities");
  }
  return true;
}

export class AgentLifeRuntime {
  constructor(profile, snapshot = null) {
    validateLifeProfile(profile);
    this.profile = deepFreeze(clone(profile));
    this.constitution = this.profile.constitution;
    this.profileHash = String(profile.source_sha256 ?? digest(profile));
    this.driveDefinitions = Object.fromEntries(
      Object.entries(profile.affect?.drives ?? {}).map(([name, definition]) => [name, normalizedDimension(definition)]),
    );
    this.traitDefinitions = Object.fromEntries(
      Object.entries(profile.affect?.traits ?? {}).map(([name, definition]) => [name, normalizedDimension(definition)]),
    );
    this.state = this.#initialState();
    if (snapshot) this.restore(snapshot);
  }

  #initialState() {
    return {
      schema: STATE_SCHEMA,
      agent_id: String(this.profile.agent.id),
      profile_sha256: this.profileHash,
      drives: Object.fromEntries(Object.entries(this.driveDefinitions).map(([name, definition]) => [name, definition.initial])),
      traits: Object.fromEntries(Object.entries(this.traitDefinitions).map(([name, definition]) => [name, definition.initial])),
      preferences: {},
      relationships: {},
      development: {
        stage: String(this.profile.development?.initial_stage ?? "apprentice"),
        experience: 0,
      },
      applied_event_ids: [],
      updated_at: null,
    };
  }

  applyEvent(event) {
    this.#validateEvent(event);
    const eventId = String(event.id);
    if (this.state.applied_event_ids.includes(eventId)) {
      return { applied: false, duplicate: true, state: this.snapshot(), memory_event: null };
    }

    const before = this.snapshot();
    const reinforcement = this.profile.reinforcement ?? {};
    const confidence = clamp(finiteNumber(event.confidence, 1), 0, 1);
    const reward = finiteNumber(event.reward, 0);
    const weightedReward = reward * confidence;
    const configuredEffects = reinforcement.event_effects?.[event.kind] ?? {};
    const requestedEffects = event.effects ?? {};
    const changes = { drives: {}, traits: {}, preferences: {}, relationships: {}, development: {} };

    const maxDriveDelta = Math.max(0, finiteNumber(reinforcement.max_drive_delta_per_event, 0.2));
    for (const [name, delta] of Object.entries(mergeEffectMaps(configuredEffects.drives, requestedEffects.drives))) {
      const definition = this.driveDefinitions[name];
      if (!definition) continue;
      const oldValue = this.state.drives[name];
      const boundedDelta = clamp(delta * confidence, -maxDriveDelta, maxDriveDelta);
      const nextValue = clamp(oldValue + boundedDelta, definition.min, definition.max);
      this.state.drives[name] = nextValue;
      if (nextValue !== oldValue) changes.drives[name] = { before: oldValue, after: nextValue };
    }

    const maxTraitDelta = Math.max(0, finiteNumber(reinforcement.max_trait_delta_per_event, 0.02));
    for (const [name, delta] of Object.entries(mergeEffectMaps(configuredEffects.traits, requestedEffects.traits))) {
      const definition = this.traitDefinitions[name];
      if (!definition) continue;
      const oldValue = this.state.traits[name];
      const boundedDelta = clamp(delta * confidence * definition.plasticity, -maxTraitDelta, maxTraitDelta);
      const nextValue = clamp(oldValue + boundedDelta, definition.min, definition.max);
      this.state.traits[name] = nextValue;
      if (nextValue !== oldValue) changes.traits[name] = { before: oldValue, after: nextValue };
    }

    const key = subjectKey(event.subject);
    const maxPreferenceDelta = Math.max(0, finiteNumber(reinforcement.max_preference_delta_per_event, 0.2));
    const existingPreference = this.state.preferences[key] ?? {
      score: 0,
      confidence: 0,
      observations: 0,
      last_event_id: null,
      last_updated_at: null,
    };
    const preferenceDelta = clamp(weightedReward * maxPreferenceDelta, -maxPreferenceDelta, maxPreferenceDelta);
    const preferenceScore = clamp(
      existingPreference.score + preferenceDelta * (1 - Math.abs(existingPreference.score)),
      -1,
      1,
    );
    this.state.preferences[key] = {
      score: preferenceScore,
      confidence: clamp(existingPreference.confidence + confidence * 0.1, 0, 1),
      observations: existingPreference.observations + 1,
      last_event_id: eventId,
      last_updated_at: String(event.occurred_at),
    };
    changes.preferences[key] = { before: existingPreference.score, after: preferenceScore };

    const relationships = this.profile.relationships ?? {};
    const relationshipId = String(event.relationship_id ?? (event.subject?.type === "person" ? event.subject.id : ""));
    if (relationships.enabled !== false && relationshipId) {
      const defaultTrust = clamp(finiteNumber(relationships.default_trust, 0.5), 0, 1);
      const maxRelationshipDelta = Math.max(0, finiteNumber(relationships.max_delta_per_event, 0.05));
      const existingRelationship = this.state.relationships[relationshipId] ?? {
        trust: defaultTrust,
        familiarity: 0,
        respect: defaultTrust,
        observations: 0,
      };
      const requestedRelationship = mergeEffectMaps(configuredEffects.relationships, requestedEffects.relationships);
      if (Object.keys(requestedRelationship).length === 0) requestedRelationship.trust = weightedReward;
      const nextRelationship = { ...existingRelationship };
      for (const dimension of ["trust", "familiarity", "respect"]) {
        if (!(dimension in requestedRelationship)) continue;
        const oldValue = finiteNumber(existingRelationship[dimension], dimension === "familiarity" ? 0 : defaultTrust);
        const delta = clamp(requestedRelationship[dimension] * confidence, -maxRelationshipDelta, maxRelationshipDelta);
        nextRelationship[dimension] = clamp(oldValue + delta, 0, 1);
      }
      nextRelationship.observations = existingRelationship.observations + 1;
      nextRelationship.last_event_id = eventId;
      nextRelationship.last_updated_at = String(event.occurred_at);
      this.state.relationships[relationshipId] = nextRelationship;
      changes.relationships[relationshipId] = { before: existingRelationship, after: nextRelationship };
    }

    const gainedExperience = Math.max(0, weightedReward) * Math.max(0, finiteNumber(event.significance, 1));
    const previousStage = this.state.development.stage;
    this.state.development.experience += gainedExperience;
    for (const stage of this.profile.development?.stages ?? []) {
      if (this.state.development.experience >= finiteNumber(stage.minimum_experience, Infinity)) {
        this.state.development.stage = String(stage.id);
      }
    }
    changes.development = {
      experience_gained: gainedExperience,
      stage_before: previousStage,
      stage_after: this.state.development.stage,
    };

    this.state.applied_event_ids.push(eventId);
    const maxEventIds = Math.max(10, Math.trunc(finiteNumber(this.profile.memory?.max_dedup_event_ids, 1000)));
    if (this.state.applied_event_ids.length > maxEventIds) {
      this.state.applied_event_ids.splice(0, this.state.applied_event_ids.length - maxEventIds);
    }
    this.state.updated_at = String(event.occurred_at);

    return {
      applied: true,
      duplicate: false,
      state: this.snapshot(),
      memory_event: this.#memoryEvent(event, before, changes),
    };
  }

  advance(elapsedHours, now = new Date().toISOString()) {
    const hours = Math.max(0, finiteNumber(elapsedHours, 0));
    for (const [name, definition] of Object.entries(this.driveDefinitions)) {
      this.state.drives[name] = clamp(
        decayToward(this.state.drives[name], definition.baseline, definition.half_life_hours, hours),
        definition.min,
        definition.max,
      );
    }
    for (const [name, definition] of Object.entries(this.traitDefinitions)) {
      this.state.traits[name] = clamp(
        decayToward(this.state.traits[name], definition.baseline, definition.half_life_hours, hours),
        definition.min,
        definition.max,
      );
    }
    const preferenceHalfLife = Math.max(0, finiteNumber(this.profile.reinforcement?.preference_half_life_hours, 2160));
    for (const preference of Object.values(this.state.preferences)) {
      preference.score = clamp(decayToward(preference.score, 0, preferenceHalfLife, hours), -1, 1);
    }
    this.state.updated_at = String(now);
    return this.snapshot();
  }

  explainPreference(subject) {
    const key = subjectKey(subject);
    const preference = this.state.preferences[key];
    if (!preference) return { subject: key, known: false, score: 0, confidence: 0, observations: 0 };
    return { subject: key, known: true, ...clone(preference) };
  }

  snapshot() {
    return clone(this.state);
  }

  restore(snapshot) {
    if (!snapshot || snapshot.schema !== STATE_SCHEMA) throw new Error("unsupported agent life state schema");
    if (snapshot.agent_id !== this.profile.agent.id) throw new Error("snapshot belongs to a different agent");
    if (snapshot.profile_sha256 !== this.profileHash) throw new Error("snapshot was created from a different life profile");
    const restored = clone(snapshot);
    for (const [name, definition] of Object.entries(this.driveDefinitions)) {
      restored.drives[name] = clamp(finiteNumber(restored.drives?.[name], definition.initial), definition.min, definition.max);
    }
    for (const [name, definition] of Object.entries(this.traitDefinitions)) {
      restored.traits[name] = clamp(finiteNumber(restored.traits?.[name], definition.initial), definition.min, definition.max);
    }
    restored.preferences = restored.preferences ?? {};
    restored.relationships = restored.relationships ?? {};
    restored.applied_event_ids = Array.isArray(restored.applied_event_ids) ? restored.applied_event_ids.map(String) : [];
    restored.development = restored.development ?? { stage: "apprentice", experience: 0 };
    this.state = restored;
    return this.snapshot();
  }

  #validateEvent(event) {
    if (!event || typeof event !== "object") throw new Error("life event must be an object");
    if (!String(event.id ?? "").trim()) throw new Error("life event requires id");
    if (!String(event.kind ?? "").trim()) throw new Error("life event requires kind");
    if (!String(event.occurred_at ?? "").trim() || Number.isNaN(Date.parse(event.occurred_at))) {
      throw new Error("life event requires a valid occurred_at timestamp");
    }
    subjectKey(event.subject);
    const reward = Number(event.reward ?? 0);
    if (!Number.isFinite(reward) || reward < -1 || reward > 1) throw new Error("event.reward must be in -1..1");
    const confidence = Number(event.confidence ?? 1);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw new Error("event.confidence must be in 0..1");
    }
    const authority = event.authority;
    if (!authority || typeof authority !== "object") throw new Error("life event requires authority");
    const authorityKind = String(authority.kind ?? "");
    if (!(this.profile.reinforcement.allowed_authorities ?? []).includes(authorityKind)) {
      throw new Error(`authority kind ${authorityKind || "<missing>"} may not reinforce this agent`);
    }
    if (String(authority.actor_id ?? "") === String(this.profile.agent.id)) {
      throw new Error("an agent may not reinforce itself");
    }
    const evidence = event.evidence;
    if (this.profile.memory?.require_provenance !== false && (!Array.isArray(evidence) || evidence.length === 0)) {
      throw new Error("life event requires provenance evidence");
    }
    const maximumEvidence = Math.max(1, Math.trunc(finiteNumber(this.profile.memory?.max_evidence_items, 16)));
    if (Array.isArray(evidence) && evidence.length > maximumEvidence) {
      throw new Error(`life event exceeds max_evidence_items (${maximumEvidence})`);
    }
  }

  #memoryEvent(event, before, changes) {
    return {
      schema: EVENT_SCHEMA,
      event_id: String(event.id),
      agent_id: String(this.profile.agent.id),
      occurred_at: String(event.occurred_at),
      kind: String(event.kind),
      subject: clone(event.subject),
      reward: finiteNumber(event.reward, 0),
      confidence: finiteNumber(event.confidence, 1),
      authority: clone(event.authority),
      evidence: clone(event.evidence ?? []),
      changes,
      before_sha256: digest(before),
      after_sha256: digest(this.state),
      profile_sha256: this.profileHash,
      claim_boundary: "Functional affect and preference state changed; this does not establish consciousness or subjective feeling.",
    };
  }
}

export const AgentLifeSchemas = Object.freeze({
  profile: PROFILE_SCHEMA,
  state: STATE_SCHEMA,
  event: EVENT_SCHEMA,
});
