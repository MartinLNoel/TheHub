// "Import from gainz-tracker": mapping a gainz export into the Gym store, and importing twice.
// Uses a SYNTHETIC export with the same shape as gainz-tracker's `state` (never Martin's real file).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultData, validate } from '../../src/modules/gym/data.js';
import {
  GAINZ_STATE_KEY, findGainzOnThisPhone, isEmpty, mapGainzState, mergeGainz, parseGainzExport, prepareGainzImport,
} from '../../src/modules/gym/import.js';
import { addProtein, logWorkout } from '../../src/modules/gym/logic.js';

const FIXTURE = readFileSync(join(import.meta.dirname, '..', 'fixtures', 'gainz-export.synthetic.json'), 'utf8');
const raw = () => JSON.parse(FIXTURE);

describe('parse', () => {
  it('accepts a gainz export and refuses other files', () => {
    expect(parseGainzExport(FIXTURE).ok).toBe(true);
    expect(parseGainzExport('not json').problems[0]).toMatch(/not valid JSON/);
    expect(parseGainzExport('{"format":"thehub-backup"}').problems[0]).toMatch(/TheHub export/);
    expect(parseGainzExport('{"hello":1}').problems[0]).toMatch(/not a gainz-tracker export/);
    expect(parseGainzExport('[1,2]').ok).toBe(false);
  });
});

describe('mapping', () => {
  it('keeps every gainz field the Gym uses, and drops _mondayFixed', () => {
    const mapped = mapGainzState(raw());
    expect(validate(mapped)).toEqual([]);
    expect(Object.keys(mapped).sort()).toEqual(Object.keys(defaultData()).sort());
    expect(mapped).not.toHaveProperty('_mondayFixed');
    expect(mapped.workoutLogs).toEqual(raw().workoutLogs);
    expect(mapped.proteinLogs).toEqual(raw().proteinLogs);
    expect(mapped.checkIns).toEqual(raw().checkIns);
    expect(mapped.myFoods).toEqual(raw().myFoods);
    expect(mapped.personalBests).toEqual(raw().personalBests);
    expect([mapped.bodyweight, mapped.phase, mapped.dayIndex, mapped.lastSeenStage]).toEqual([71.2, 'phase1', 5, 1]);
  });

  it('fills gaps the way gainz-tracker starts (no lastSeenStage until the Fighter tab was opened)', () => {
    const r = raw();
    delete r.lastSeenStage;
    delete r.dayIndex;
    delete r.myFoods;
    const mapped = mapGainzState(r);
    expect(mapped.lastSeenStage).toBe(0);
    expect(mapped.dayIndex).toBe(r.workoutLogs.length);
    expect(mapped.myFoods).toEqual(defaultData().myFoods);
  });

  it('turns numbers stored as text into numbers', () => {
    const r = raw();
    r.workoutLogs[0].exercises[0].sets[0] = { weight: '12.5', reps: '8' };
    expect(mapGainzState(r).workoutLogs[0].exercises[0].sets[0]).toEqual({ weight: 12.5, reps: 8 });
  });

  it('refuses a file with a broken workout, saying what is wrong', () => {
    const r = raw();
    r.workoutLogs[1].date = 'last tuesday';
    const prepared = prepareGainzImport(JSON.stringify(r), defaultData());
    expect(prepared.ok).toBe(false);
    expect(prepared.problems.join()).toMatch(/workout 2 has no valid date/);
  });

  it('never carries a Notion token, even if one were in the file', () => {
    const r = { ...raw(), gainz_notion_token: 'secret_x' };
    const prepared = prepareGainzImport(JSON.stringify(r), defaultData());
    expect(JSON.stringify(prepared.data)).not.toContain('secret_x');
    expect(prepared.summary.join()).toMatch(/Not imported.*gainz_notion_token/);
  });
});

describe('import into a fresh Gym', () => {
  it('takes everything, with a preview of workouts, protein days, check-ins and stage', () => {
    const prepared = prepareGainzImport(FIXTURE, defaultData());
    expect(prepared.ok).toBe(true);
    expect(prepared.nothingNew).toBe(false);
    expect(prepared.summary[0]).toBe('In the file: 5 workouts, 2 protein days, 2 check-ins, fighter stage 2 of 10 (THE RECRUIT).');
    expect(prepared.summary[1]).toBe('New for TheHub: 5 workouts, 2 protein days (4 items), 2 check-ins, 1 saved food.');
    expect(prepared.data.workoutLogs.map((l) => l.id)).toEqual(raw().workoutLogs.map((l) => l.id)); // newest first, same order
    expect(prepared.data.myFoods).toEqual(raw().myFoods);
    expect([prepared.data.bodyweight, prepared.data.dayIndex, prepared.data.lastSeenStage]).toEqual([71.2, 5, 1]);
    expect(validate(prepared.data)).toEqual([]);
  });
});

describe('importing twice', () => {
  it('adds nothing the second time', () => {
    const first = prepareGainzImport(FIXTURE, defaultData());
    const second = prepareGainzImport(FIXTURE, first.data);
    expect(second.ok).toBe(true);
    expect(second.nothingNew).toBe(true);
    expect(second.added).toEqual({ workouts: 0, proteinDays: 0, proteinItems: 0, checkIns: 0, myFoods: 0, personalBests: 0 });
    expect(second.data).toEqual(first.data);
    expect(second.summary[1]).toMatch(/already in TheHub/);
  });

  it('keeps two identical items on one day as two (counted, not just matched)', () => {
    const first = prepareGainzImport(FIXTURE, defaultData()).data;
    expect(first.proteinLogs['2026-01-07'].filter((i) => i.name === 'Whey shake')).toHaveLength(2);
    const again = mergeGainz(first, mapGainzState(raw())).data;
    expect(again.proteinLogs['2026-01-07'].filter((i) => i.name === 'Whey shake')).toHaveLength(2);
  });

  it('a later export adds only what is new', () => {
    const first = prepareGainzImport(FIXTURE, defaultData()).data;
    const later = raw();
    later.workoutLogs.unshift({ id: 1768000000000, date: '2026-01-10', day: 'Upper A', mode: 'gym', exercises: [{ name: 'Lat Pulldown', sets: [{ weight: 37.5, reps: 10 }] }] });
    later.proteinLogs['2026-01-09'].push({ name: 'Tuna can', grams: 30 });
    later.proteinLogs['2026-01-10'] = [{ name: 'Whey shake', grams: 25 }];
    later.checkIns.push({ date: '2026-01-11', weight: 71.6, cals: null, notes: '' });
    later.bodyweight = 71.6;
    later.personalBests['Lat Pulldown'] = { weight: 37.5, reps: 10 };
    const { data, added } = mergeGainz(first, mapGainzState(later));
    expect(added).toEqual({ workouts: 1, proteinDays: 1, proteinItems: 2, checkIns: 1, myFoods: 0, personalBests: 1 });
    expect(data.workoutLogs[0].id).toBe(1768000000000);
    expect(data.workoutLogs).toHaveLength(6);
    expect(data.bodyweight).toBe(71.6);
    expect(data.personalBests['Lat Pulldown']).toEqual({ weight: 37.5, reps: 10 });
  });

  it('keeps what was logged in TheHub, and keeps the better personal best', () => {
    const now = new Date('2026-01-12T10:00:00Z');
    let mine = logWorkout(defaultData(), { dayName: 'Upper A', mode: 'gym', inputs: { 'Lat Pulldown': [{ weight: 50, reps: 8 }] }, now, id: 42 }).data;
    mine = addProtein(mine, 'Whey shake', 25, now);
    const { data, added } = mergeGainz(mine, mapGainzState(raw()));
    expect(added.workouts).toBe(5);
    expect(data.workoutLogs[0].id).toBe(42); // newest first
    expect(data.workoutLogs).toHaveLength(6);
    expect(data.proteinLogs['2026-01-12']).toEqual([{ name: 'Whey shake', grams: 25 }]);
    expect(data.personalBests['Lat Pulldown']).toEqual({ weight: 50, reps: 8 });
    expect(validate(data)).toEqual([]);
  });

  it('logs without an id are matched by their content', () => {
    const r = raw();
    r.workoutLogs.forEach((l) => delete l.id);
    const first = prepareGainzImport(JSON.stringify(r), defaultData()).data;
    expect(first.workoutLogs).toHaveLength(5);
    expect(prepareGainzImport(JSON.stringify(r), first).nothingNew).toBe(true);
  });

  it('never moves Phase 2 back to Phase 1', () => {
    const mine = { ...logWorkout(defaultData(), { dayName: 'Upper A', mode: 'gym', inputs: { 'Lat Pulldown': [{ weight: 1, reps: 1 }] }, now: new Date() }).data, phase: 'phase2' };
    expect(isEmpty(mine)).toBe(false);
    expect(mergeGainz(mine, mapGainzState(raw())).data.phase).toBe('phase2');
  });
});

describe('gainz-tracker data on this phone (same address)', () => {
  const fakeStorage = (items) => ({ getItem: (k) => (k in items ? items[k] : null) });

  it('reads only gainz_state', () => {
    const seen = [];
    const storage = { getItem: (k) => (seen.push(k), k === GAINZ_STATE_KEY ? FIXTURE : 'secret') };
    expect(findGainzOnThisPhone(storage)).toBe(FIXTURE);
    expect(seen).toEqual([GAINZ_STATE_KEY]);
  });

  it('is null when there is none, or it is not gainz data, or storage throws', () => {
    expect(findGainzOnThisPhone(fakeStorage({}))).toBeNull();
    expect(findGainzOnThisPhone(fakeStorage({ [GAINZ_STATE_KEY]: '{}' }))).toBeNull();
    expect(findGainzOnThisPhone({ getItem: () => { throw new Error('blocked'); } })).toBeNull();
  });
});
