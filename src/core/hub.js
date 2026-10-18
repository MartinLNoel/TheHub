// Cross-module offers: hub.offer(targetModuleId, item) (docs/plans/part-0-overview.md, module contract).
//
// A module never touches another module's store. Instead it offers an item (for example the Fridge offers
// { bg, en, topic } to the Bulgarian module) and the target decides: a module that accepts offers has
//   accept(item, data) => newData | null     (pure; null = ignored, e.g. a duplicate)
// The core checks the result with the target's validate() and saves it. When no module with that id is
// installed, or it does not accept offers, or its data is read-only, the offer is simply ignored.
// offer() never throws: it resolves to { accepted: true } or { accepted: false, reason }.

/**
 * registry: the module registry; state: { [moduleId]: { data, readOnly, error } } (the app's live state,
 * updated in place on success); save(mod, data): stores a module's data (storage.save).
 */
export function createHub({ registry, state, save }) {
  function accepts(target) {
    const mod = registry.get(target);
    const entry = state[target];
    return Boolean(mod && typeof mod.accept === 'function' && entry && entry.data != null && !entry.readOnly);
  }

  async function offer(target, item) {
    if (!registry.get(target)) return { accepted: false, reason: 'no-module' };
    if (!accepts(target)) return { accepted: false, reason: 'not-accepting' };
    const mod = registry.get(target);
    const entry = state[target];
    let next;
    try {
      next = mod.accept(structuredClone(item), structuredClone(entry.data));
    } catch (err) {
      return { accepted: false, reason: 'error', message: err.message };
    }
    if (next === null || next === undefined) return { accepted: false, reason: 'declined' };
    const problems = mod.validate(next);
    if (problems.length) return { accepted: false, reason: 'invalid', problems };
    try {
      await save(mod, next);
    } catch (err) {
      return { accepted: false, reason: 'error', message: err.message };
    }
    entry.data = next;
    return { accepted: true };
  }

  return { accepts, offer };
}

/** A hub that accepts nothing (for screens rendered without the app, e.g. in tests). */
export const NO_HUB = Object.freeze({ accepts: () => false, offer: async () => ({ accepted: false, reason: 'no-module' }) });
