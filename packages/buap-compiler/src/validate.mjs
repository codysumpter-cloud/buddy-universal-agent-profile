const SECRET_PATTERNS = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=]\s*[^\s{]{6,}/i,
];

const PROVIDER_FIELDS = {
  codex: new Set(["sandbox_mode", "network_access", "approval_policy", "service_tier", "model"]),
  "copilot-review": new Set(["runner", "firewall", "network", "permissions", "setup_workflow"]),
  buddy: new Set(["profile", "capabilities", "requires_human_approval", "experimental"]),
};

export function validateModuleShape(module, sourceName = module?.id ?? "<module>") {
  const errors = [];
  if (!module || typeof module !== "object" || Array.isArray(module)) return [`${sourceName}: module must be an object`];
  if (!module.id || typeof module.id !== "string") errors.push(`${sourceName}: id is required`);
  if (module.imports && (!Array.isArray(module.imports) || module.imports.some((item) => typeof item !== "string"))) {
    errors.push(`${sourceName}: imports must be an array of module ids`);
  }
  if (module.sections && !Array.isArray(module.sections)) errors.push(`${sourceName}: sections must be an array`);
  for (const [index, section] of (module.sections ?? []).entries()) {
    if (!section.id || !section.title || typeof section.body !== "string") {
      errors.push(`${sourceName}: sections[${index}] requires id, title, and string body`);
    }
  }
  return errors;
}

export function findSecretLikeStrings(value, location = "$") {
  const findings = [];
  if (typeof value === "string") {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(value)) findings.push(`${location}: secret-like string matched ${pattern}`);
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => findings.push(...findSecretLikeStrings(item, `${location}[${index}]`)));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      findings.push(...findSecretLikeStrings(child, `${location}.${key}`));
    }
  }
  return findings;
}

export function validateProviderFields(module) {
  const errors = [];
  for (const [provider, values] of Object.entries(module.providers ?? {})) {
    const allowed = PROVIDER_FIELDS[provider];
    if (!allowed) {
      errors.push(`${module.id}: unsupported provider ${provider}`);
      continue;
    }
    for (const key of Object.keys(values ?? {})) {
      if (!allowed.has(key)) errors.push(`${module.id}: unsupported ${provider} field ${key}`);
    }
  }
  return errors;
}

export function interpolate(value, variables, location = "$") {
  if (typeof value === "string") {
    return value.replace(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g, (_match, name) => {
      if (!(name in variables)) throw new Error(`${location}: undefined variable ${name}`);
      return String(variables[name]);
    });
  }
  if (Array.isArray(value)) return value.map((item, index) => interpolate(item, variables, `${location}[${index}]`));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, interpolate(child, variables, `${location}.${key}`)]));
  }
  return value;
}

export function mergePermissions(modules) {
  const merged = {};
  const owners = {};
  for (const module of modules) {
    for (const [key, value] of Object.entries(module.permissions ?? {})) {
      if (key in merged && merged[key] !== value && !(module.overrides ?? []).includes(`permissions.${key}`)) {
        throw new Error(`conflicting permission ${key}: ${owners[key]}=${merged[key]} vs ${module.id}=${value}; add an explicit override`);
      }
      merged[key] = value;
      owners[key] = module.id;
    }
  }
  return merged;
}

export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}
