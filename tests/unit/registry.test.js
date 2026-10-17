import { describe, expect, it } from 'vitest';
import { checkModule, createRegistry, ModuleContractError } from '../../src/core/registry.js';
import demo from '../fixtures/demo-module.js';

const valid = () => ({
  id: 'thing',
  name: 'Thing',
  icon: 'T',
  schemaVersion: 1,
  migrations: {},
  defaultData: () => ({}),
  validate: () => [],
  routes: { '': () => {} },
  todayCard: () => null,
});

describe('registry', () => {
  it('accepts a module that follows the contract (the demo module)', () => {
    const r = createRegistry([demo]);
    expect(r.get('demo')).toBe(demo);
    expect(r.list()).toEqual([demo]);
    expect(checkModule(valid())).toEqual([]);
  });

  it.each(['id', 'name', 'icon', 'schemaVersion', 'migrations', 'defaultData', 'validate', 'routes'])(
    'rejects a module missing %s',
    (field) => {
      const mod = valid();
      delete mod[field];
      expect(() => createRegistry([mod])).toThrow(ModuleContractError);
    },
  );

  it('rejects a module whose migrations do not reach its schema version', () => {
    const mod = { ...valid(), schemaVersion: 3, migrations: { 2: (d) => d } };
    expect(checkModule(mod)).toEqual(['migrations[3] is missing']);
  });

  it('rejects a module without a home route', () => {
    expect(checkModule({ ...valid(), routes: { log: () => {} } })).toContain("routes[''] (the module's home screen) is required");
  });

  it('rejects reserved and badly formed ids, and duplicates', () => {
    expect(() => createRegistry([{ ...valid(), id: 'settings' }])).toThrow(/reserved/);
    expect(() => createRegistry([{ ...valid(), id: 'Has Space' }])).toThrow(ModuleContractError);
    expect(() => createRegistry([valid(), valid()])).toThrow(/already registered/);
  });

  it('allows leaving out todayCard but not a non-function one', () => {
    const mod = valid();
    delete mod.todayCard;
    expect(checkModule(mod)).toEqual([]);
    expect(checkModule({ ...valid(), todayCard: 'card' })).toHaveLength(1);
  });
});
