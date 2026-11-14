// "Import from gainz-tracker": reads the file gainz-tracker's "Export all data (JSON)" button makes
// (its whole `state` object, see data.js) and merges it into the Gym store.
//
// Importing twice never duplicates anything: workouts are matched by id (or by their content when
// a log has no id), protein items and check-ins by their content (counted, so two identical shakes
// on one day stay two), saved foods by name and grams; personal bests keep the better one.
import { defaultData, validate } from './data.js';
import { currentStage, beatsPB } from './logic.js';
import { STAGES } from './program.js';

/** The localStorage key gainz-tracker keeps its state under. Its Notion token key is never read. */
export const GAINZ_STATE_KEY = 'gainz_state';
const IGNORED_KEYS = new Set(['_mondayFixed']);
const KNOWN_KEYS = new Set([
  'workoutLogs', 'proteinLogs', 'checkIns', 'myFoods', 'personalBests', 'bodyweight', 'phase', 'dayIndex', 'lastSeenStage',
]);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
function num(x) {
  if (x === null || x === undefined || x === '') return 0;
  return typeof x === 'number' ? x : parseFloat(x);
}

/** Parses the file text. Returns { ok, problems, state } and never throws. */
export function parseGainzExport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, problems: ['The file is not valid JSON.'] };
  }
  if (isObject(parsed) && parsed.format === 'thehub-backup') {
    return { ok: false, problems: ['This is a TheHub export, not a gainz-tracker one. Use "Import a file…" for it.'] };
  }
  if (!isObject(parsed) || !Array.isArray(parsed.workoutLogs)) {
    return { ok: false, problems: ['This is not a gainz-tracker export (it has no workoutLogs).'] };
  }
  return { ok: true, problems: [], state: parsed };
}

/** Maps gainz-tracker's state into the Gym store's shape (data.js), filling gaps with defaults. */
export function mapGainzState(raw) {
  const base = defaultData();
  const workoutLogs = raw.workoutLogs.map((log) => ({
    id: log?.id ?? null,
    date: log?.date,
    day: log?.day,
    mode: log?.mode === 'home' ? 'home' : 'gym',
    exercises: Array.isArray(log?.exercises)
      ? log.exercises.map((ex) => ({
          name: ex?.name,
          sets: Array.isArray(ex?.sets) ? ex.sets.map((s) => ({ weight: num(s?.weight), reps: num(s?.reps) })) : ex?.sets,
        }))
      : log?.exercises,
  }));

  const proteinLogs = {};
  if (isObject(raw.proteinLogs)) {
    for (const [day, items] of Object.entries(raw.proteinLogs)) {
      proteinLogs[day] = Array.isArray(items) ? items.map((it) => ({ name: String(it?.name ?? ''), grams: num(it?.grams) })) : items;
    }
  }
  const checkIns = Array.isArray(raw.checkIns)
    ? raw.checkIns.map((ci) => ({
        date: ci?.date,
        weight: num(ci?.weight),
        cals: ci?.cals === null || ci?.cals === undefined || ci?.cals === '' ? null : num(ci.cals),
        notes: String(ci?.notes ?? ''),
      }))
    : [];
  const myFoods = Array.isArray(raw.myFoods)
    ? raw.myFoods.map((f) => ({ name: String(f?.name ?? ''), protein: num(f?.protein) }))
    : base.myFoods;
  const personalBests = {};
  if (isObject(raw.personalBests)) {
    for (const [name, pb] of Object.entries(raw.personalBests)) personalBests[name] = { weight: num(pb?.weight), reps: num(pb?.reps) };
  }
  const stage = Number.isInteger(raw.lastSeenStage) ? Math.min(Math.max(raw.lastSeenStage, 0), STAGES.length - 1) : 0;
  return {
    workoutLogs,
    proteinLogs,
    checkIns,
    myFoods,
    personalBests,
    bodyweight: num(raw.bodyweight) > 0 ? num(raw.bodyweight) : base.bodyweight,
    program: 'gym', // gainz-tracker has only the gym program; a merge keeps the current choice
    phase: raw.phase === 'phase2' ? 'phase2' : 'phase1',
    dayIndex: Number.isInteger(raw.dayIndex) && raw.dayIndex >= 0 ? raw.dayIndex : workoutLogs.length,
    lastSeenStage: stage,
    officeDays: base.officeDays, // gainz-tracker has no office days; a merge keeps the current ones
    officeWeeks: {},
    weatherTown: null, // nor a town; a merge keeps the current one
  };
}

/** Keys of the gainz state this import does not use (shown in the preview). */
export function unusedKeys(raw) {
  return Object.keys(raw).filter((k) => !KNOWN_KEYS.has(k) && !IGNORED_KEYS.has(k));
}

const workoutKey = (log) =>
  log.id !== null && log.id !== undefined ? `id:${log.id}` : `c:${log.date}|${log.day}|${log.mode}|${JSON.stringify(log.exercises)}`;
const proteinKey = (it) => `${it.name}|${it.grams}`;
const checkInKey = (ci) => `${ci.date}|${ci.weight}|${ci.cals}|${ci.notes}`;
const foodKey = (f) => `${f.name}|${f.protein}`;

/** Adds the incoming items that `existing` does not already hold, counting duplicates. */
function mergeCounted(existing, incoming, key) {
  const counts = new Map();
  existing.forEach((x) => counts.set(key(x), (counts.get(key(x)) || 0) + 1));
  const out = [...existing];
  let added = 0;
  for (const item of incoming) {
    const k = key(item);
    if (counts.get(k) > 0) counts.set(k, counts.get(k) - 1);
    else {
      out.push(item);
      added++;
    }
  }
  return { out, added };
}

export function isEmpty(data) {
  return !data || (!data.workoutLogs?.length && !Object.keys(data.proteinLogs || {}).length && !data.checkIns?.length);
}

/**
 * Merges mapped gainz data into the current Gym data. Returns { data, added } where added counts
 * what is new: { workouts, proteinDays, proteinItems, checkIns, myFoods, personalBests }.
 */
export function mergeGainz(current, incoming) {
  const fresh = isEmpty(current);
  const base = structuredClone(current || defaultData());
  const added = { workouts: 0, proteinDays: 0, proteinItems: 0, checkIns: 0, myFoods: 0, personalBests: 0 };

  const seen = new Set(base.workoutLogs.map(workoutKey));
  for (const log of incoming.workoutLogs) {
    const k = workoutKey(log);
    if (seen.has(k)) continue;
    seen.add(k);
    base.workoutLogs.push(structuredClone(log));
    added.workouts++;
  }
  // Newest first, like gainz-tracker (which adds each new log at the front).
  base.workoutLogs.sort((a, b) => String(b.date).localeCompare(String(a.date)) || (Number(b.id) || 0) - (Number(a.id) || 0));

  for (const [day, items] of Object.entries(incoming.proteinLogs)) {
    const had = base.proteinLogs[day] || [];
    const { out, added: n } = mergeCounted(had, items, proteinKey);
    if (n > 0) {
      if (!had.length) added.proteinDays++;
      added.proteinItems += n;
      base.proteinLogs[day] = out;
    }
  }

  const ci = mergeCounted(base.checkIns, incoming.checkIns, checkInKey);
  base.checkIns = ci.out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  added.checkIns = ci.added;

  const seenFoods = new Set(base.myFoods.map(foodKey));
  for (const f of incoming.myFoods) {
    if (seenFoods.has(foodKey(f))) continue;
    seenFoods.add(foodKey(f));
    base.myFoods.push({ ...f });
    added.myFoods++;
  }

  for (const [name, pb] of Object.entries(incoming.personalBests)) {
    if (beatsPB(pb, base.personalBests[name])) {
      base.personalBests[name] = { ...pb };
      added.personalBests++;
    }
  }

  if (fresh) {
    base.phase = incoming.phase;
    base.bodyweight = incoming.bodyweight;
    base.dayIndex = incoming.dayIndex;
    base.lastSeenStage = incoming.lastSeenStage;
  } else {
    if (incoming.phase === 'phase2') base.phase = 'phase2';
    const lastDate = (list) => list.reduce((m, c) => (String(c.date) > m ? String(c.date) : m), '');
    if (lastDate(incoming.checkIns) > lastDate(current.checkIns || [])) base.bodyweight = incoming.bodyweight;
    base.dayIndex = Math.max(base.dayIndex, incoming.dayIndex);
    base.lastSeenStage = Math.max(base.lastSeenStage, incoming.lastSeenStage);
  }
  return { data: base, added };
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
function describe(data) {
  const stage = currentStage(data.workoutLogs.length);
  return [
    plural(data.workoutLogs.length, 'workout'),
    plural(Object.keys(data.proteinLogs).length, 'protein day'),
    plural(data.checkIns.length, 'check-in'),
    `fighter stage ${stage.id + 1} of ${STAGES.length}`, // no stage name: the story is a surprise
  ].join(', ');
}

/**
 * The importer the core's Settings screen runs (module contract, `importers`). Returns
 * { ok, problems, summary: [lines], data, nothingNew }; never writes anything itself.
 */
export function prepareGainzImport(text, current) {
  const parsed = parseGainzExport(text);
  if (!parsed.ok) return { ok: false, problems: parsed.problems, summary: [] };
  const mapped = mapGainzState(parsed.state);
  const fileProblems = validate(mapped);
  if (fileProblems.length) {
    return { ok: false, problems: fileProblems.slice(0, 8).map((p) => `In the file: ${p}.`), summary: [] };
  }
  const { data, added } = mergeGainz(current, mapped);
  const problems = validate(data);
  if (problems.length) return { ok: false, problems, summary: [] };

  const nothingNew = Object.values(added).every((n) => n === 0);
  const summary = [
    `In the file: ${describe(mapped)}.`,
    nothingNew
      ? 'Everything in this file is already in TheHub. Nothing to import.'
      : `New for TheHub: ${plural(added.workouts, 'workout')}, ${plural(added.proteinDays, 'protein day')} (${plural(added.proteinItems, 'item')}), ${plural(added.checkIns, 'check-in')}, ${plural(added.myFoods, 'saved food')}.`,
    `After the import: ${describe(data)}.`,
  ];
  const unused = unusedKeys(parsed.state);
  if (unused.length) summary.push(`Not imported (unknown to TheHub): ${unused.join(', ')}.`);
  return { ok: true, problems: [], summary, data, added, nothingNew };
}

/**
 * gainz-tracker's data on this phone, when it is served from the same address as TheHub (both
 * on martinlnoel.github.io share one localStorage). Reads only gainz_state; null when absent.
 * PLACEHOLDER(Q-2): whether this finds anything depends on the address gainz-tracker runs from.
 */
export function findGainzOnThisPhone(storage = globalThis.localStorage) {
  try {
    const text = storage?.getItem(GAINZ_STATE_KEY);
    return text && parseGainzExport(text).ok ? text : null;
  } catch {
    return null;
  }
}
