export function resolveModuleGraph(entryIds, modulesById) {
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];

  function visit(id, chain = []) {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      const cycleStart = chain.indexOf(id);
      const cycle = [...chain.slice(cycleStart), id].join(" -> ");
      throw new Error(`cyclic module dependency: ${cycle}`);
    }
    const module = modulesById.get(id);
    if (!module) throw new Error(`missing imported module: ${[...chain, id].join(" -> ")}`);
    visiting.add(id);
    for (const dependency of module.imports ?? []) visit(dependency, [...chain, id]);
    visiting.delete(id);
    visited.add(id);
    ordered.push(module);
  }

  for (const entryId of entryIds) visit(entryId);
  return ordered;
}
