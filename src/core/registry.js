// Module registry: checks each module against the module contract (docs/plans/part-0-overview.md)
// and keeps them in registration order.

const RESERVED_IDS = new Set(['core', 'today', 'settings']);
const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Returns the list of contract problems for a module; [] means it is valid. */
export function checkModule(mod) {
  const problems = [];
  if (!mod || typeof mod !== 'object') return ['module must be an object'];

  if (typeof mod.id !== 'string' || !ID_PATTERN.test(mod.id)) {
    problems.push('id must be a lowercase slug (a-z, 0-9, -)');
  } else if (RESERVED_IDS.has(mod.id)) {
    problems.push(`id "${mod.id}" is reserved`);
  }
  if (typeof mod.name !== 'string' || !mod.name.trim()) problems.push('name is required');
  if (typeof mod.icon !== 'string' || !mod.icon.trim()) problems.push('icon is required');

  const v = mod.schemaVersion;
  if (!Number.isInteger(v) || v < 1) {
    problems.push('schemaVersion must be an integer of at least 1');
  }
  if (!mod.migrations || typeof mod.migrations !== 'object') {
    problems.push('migrations must be an object (use {} when there are none)');
  } else if (Number.isInteger(v)) {
    for (let n = 2; n <= v; n++) {
      if (typeof mod.migrations[n] !== 'function') problems.push(`migrations[${n}] is missing`);
    }
  }
  if (typeof mod.defaultData !== 'function') problems.push('defaultData must be a function');
  if (typeof mod.validate !== 'function') problems.push('validate must be a function');

  if (!mod.routes || typeof mod.routes !== 'object') {
    problems.push('routes must be an object');
  } else {
    if (typeof mod.routes[''] !== 'function') problems.push("routes[''] (the module's home screen) is required");
    for (const [key, fn] of Object.entries(mod.routes)) {
      if (typeof fn !== 'function') problems.push(`routes['${key}'] must be a function`);
    }
  }
  if (mod.todayCard !== undefined && mod.todayCard !== null && typeof mod.todayCard !== 'function') {
    problems.push('todayCard must be a function (or left out)');
  }
  if (mod.importers !== undefined) {
    if (!Array.isArray(mod.importers)) problems.push('importers must be a list (or left out)');
    else {
      mod.importers.forEach((imp, i) => {
        if (!imp || typeof imp.id !== 'string' || !imp.id) problems.push(`importers[${i}].id is required`);
        if (!imp || typeof imp.title !== 'string' || !imp.title) problems.push(`importers[${i}].title is required`);
        if (!imp || typeof imp.prepare !== 'function') problems.push(`importers[${i}].prepare must be a function`);
        if (imp?.findLocal !== undefined && typeof imp.findLocal !== 'function') problems.push(`importers[${i}].findLocal must be a function`);
      });
    }
  }
  return problems;
}

export class ModuleContractError extends Error {
  constructor(id, problems) {
    super(`Module "${id ?? '?'}" breaks the module contract: ${problems.join('; ')}`);
    this.name = 'ModuleContractError';
    this.problems = problems;
  }
}

export function createRegistry(modules = []) {
  const byId = new Map();

  const registry = {
    register(mod) {
      const problems = checkModule(mod);
      if (problems.length) throw new ModuleContractError(mod?.id, problems);
      if (byId.has(mod.id)) throw new ModuleContractError(mod.id, ['id is already registered']);
      byId.set(mod.id, mod);
      return mod;
    },
    get: (id) => byId.get(id),
    has: (id) => byId.has(id),
    list: () => [...byId.values()],
  };

  modules.forEach((m) => registry.register(m));
  return registry;
}
