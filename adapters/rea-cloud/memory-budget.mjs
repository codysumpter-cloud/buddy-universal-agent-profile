import { readFileSync } from 'node:fs';

// On free Render instances, the REA MCP core and the audit jobs share one
// 512 MiB cgroup. A boot-time archive/decompiler job can OOM-kill the gateway.
// An opt-in alone is not enough: heavy boot jobs also require a known, larger
// cgroup limit. Normal owner-invoked MCP operations remain unchanged.
export const MIN_HEAVY_BOOT_BYTES = 2 * 1024 * 1024 * 1024;
const CGROUP_MEMORY_LIMITS = [
  '/sys/fs/cgroup/memory.max',
  '/sys/fs/cgroup/memory/memory.limit_in_bytes',
];

export function parseCgroupMemoryLimit(raw) {
  const value = String(raw ?? '').trim();
  if (!/^\d+$/.test(value)) return null; // e.g. cgroups v2 "max"
  const count = Number(value);
  return Number.isSafeInteger(count) && count > 0 ? count : null;
}

export function detectCgroupMemoryLimit(read = readFileSync) {
  for (const filename of CGROUP_MEMORY_LIMITS) {
    try {
      const limit = parseCgroupMemoryLimit(read(filename, 'utf8'));
      if (limit !== null) return limit;
    } catch { /* No cgroup limit file on this host. */ }
  }
  return null;
}

export function canRunHeavyBootAudits({ explicitEnabled, memoryLimitBytes } = {}) {
  return explicitEnabled === true &&
    Number.isSafeInteger(memoryLimitBytes) &&
    memoryLimitBytes >= MIN_HEAVY_BOOT_BYTES;
}
