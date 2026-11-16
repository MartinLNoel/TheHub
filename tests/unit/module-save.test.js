// The save every module screen gets (src/core/db.js moduleSave, used by src/app.js). Bug found 2026-11-16 in a
// screenshot: the live state took the new data only after the write finished, so a screen opened during the
// write (a recipe link tapped right after logging food) started from the old data and its save wiped the entry.
import { describe, expect, it, vi } from 'vitest';
import { NewerDataError, moduleSave } from '../../src/core/db.js';

const mod = { id: 'fridge' };

describe('moduleSave', () => {
  it('the live state has the new data at once, while the write is still going', async () => {
    let finish;
    const storage = { save: vi.fn(() => new Promise((r) => (finish = r))) };
    const entry = { data: { n: 1 }, readOnly: false };
    const done = moduleSave({ storage, mod, entry })({ n: 2 });
    expect(entry.data).toEqual({ n: 2 }); // a screen opened now starts from the new data
    finish();
    await done;
    expect(storage.save).toHaveBeenCalledWith(mod, { n: 2 });
    expect(entry.data).toEqual({ n: 2 });
  });

  it('a failed write puts the old data back and passes the error on', async () => {
    const storage = { save: vi.fn(async () => { throw new Error('disk full'); }) };
    const entry = { data: { n: 1 }, readOnly: false };
    await expect(moduleSave({ storage, mod, entry })({ n: 2 })).rejects.toThrow('disk full');
    expect(entry.data).toEqual({ n: 1 });
    expect(entry.readOnly).toBe(false);
  });

  it('newer data on the phone makes the module read-only', async () => {
    const storage = { save: vi.fn(async () => { throw new NewerDataError('fridge', 3, 2); }) };
    const entry = { data: { n: 1 }, readOnly: false };
    await expect(moduleSave({ storage, mod, entry })({ n: 2 })).rejects.toBeInstanceOf(NewerDataError);
    expect(entry.readOnly).toBe(true);
    expect(entry.data).toEqual({ n: 1 });
  });

  it('a failed write does not undo a later change made meanwhile', async () => {
    const rejecters = [];
    const storage = { save: vi.fn(() => new Promise((_, reject) => rejecters.push(reject))) };
    const entry = { data: { n: 1 }, readOnly: false };
    const save = moduleSave({ storage, mod, entry });
    const first = save({ n: 2 });
    save({ n: 3 }).catch(() => {});
    rejecters[0](new Error('busy'));
    await expect(first).rejects.toThrow('busy');
    expect(entry.data).toEqual({ n: 3 });
  });
});
