// The Gym store's data (schema version 3): the same fields gainz-tracker keeps in its `state`,
// minus `_mondayFixed` (gainz's one-time date fix, not needed here), plus `program` and the office days.
// No Notion token, ever.
//
//   workoutLogs   [{ id, date: "YYYY-MM-DD", day: "Upper A" | "Day A"…, mode: "gym"|"home",
//                    exercises: [{ name, step?, sets: [{ weight, reps }] }] }]   newest first
//                    step: a ladder exercise's step, 1-based (optional, v3)
//   proteinLogs   { "YYYY-MM-DD": [{ name, grams }] }
//   checkIns      [{ date, weight, cals (number|null), notes }]           oldest first
//   myFoods       [{ name, protein }]
//   personalBests { [exerciseName]: { weight, reps } }
//   bodyweight    kg (protein target = bodyweight × 1.8)
//   program       "gym" (gainz-tracker's program, by phase) | "home" (the home plan, Day A/B/C)   v2
//   phase         "phase1" | "phase2" (the gym program's phase, kept while on the home plan)
//   dayIndex      sessions logged since the phase started (gainz shows "DAY n OF m" from it)
//   lastSeenStage the highest fighter stage already shown (for the unlock animation)
//   officeDays    the usual office days, weekday numbers 1 (Monday) to 7 (Sunday): rest days       v3
//   officeWeeks   { "YYYY-Www": [weekdays] } a week whose office days differ from the usual        v3
import { DEFAULT_MY_FOODS, PROGRAM, STAGES } from './program.js';

export const SCHEMA_VERSION = 3;

export const PROGRAMS = ['gym', 'home'];

/** Tuesday and Thursday. */
export const DEFAULT_OFFICE_DAYS = [2, 4];

/** migrations[n] turns version n-1 into version n (src/core/db.js runs them, backing up first). */
export const migrations = {
  // v2: the program switch. Everything stored before it was the gym program.
  2: (data) => ({ ...data, program: 'gym' }),
  // v3: office days, busy days the week plan works around (2026-11-14).
  3: (data) => ({ ...data, officeDays: [...DEFAULT_OFFICE_DAYS], officeWeeks: {} }),
};

/**
 * A fresh start. gainz-tracker pre-loaded Martin's first 7 sessions here; TheHub does not (see
 * docs/CHANGELOG.md, Part 4): his history arrives with the import from gainz-tracker instead.
 * PLACEHOLDER(Q-10): confirm once the real export exists that it holds those 7 sessions.
 */
export function defaultData() {
  return {
    workoutLogs: [],
    proteinLogs: {},
    checkIns: [],
    myFoods: structuredClone(DEFAULT_MY_FOODS),
    personalBests: {},
    bodyweight: 75,
    program: 'gym',
    phase: 'phase1',
    dayIndex: 0,
    lastSeenStage: 0,
    officeDays: [...DEFAULT_OFFICE_DAYS],
    officeWeeks: {},
  };
}

/** A real calendar date written as "YYYY-MM-DD". */
export function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const nonNegative = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isWeekdayList = (v) =>
  Array.isArray(v) && v.every((d) => Number.isInteger(d) && d >= 1 && d <= 7) && new Set(v).size === v.length;

/** Problems with the data; [] means complete. Used by backup verification and imports. */
export function validate(data) {
  const problems = [];
  if (!isObject(data)) return ['the gym data is missing'];

  if (!Array.isArray(data.workoutLogs)) problems.push('workoutLogs must be a list');
  else {
    data.workoutLogs.forEach((log, i) => {
      const where = `workout ${i + 1}`;
      if (!isObject(log)) return problems.push(`${where} is not a workout`);
      if (!isISODate(log.date)) problems.push(`${where} has no valid date`);
      if (typeof log.day !== 'string' || !log.day) problems.push(`${where} has no day name`);
      if (!Array.isArray(log.exercises) || log.exercises.length === 0) return problems.push(`${where} has no exercises`);
      log.exercises.forEach((ex, j) => {
        if (!isObject(ex) || typeof ex.name !== 'string' || !Array.isArray(ex.sets)) {
          return problems.push(`${where}, exercise ${j + 1} is incomplete`);
        }
        if (ex.sets.some((s) => !isObject(s) || !nonNegative(s.weight) || !nonNegative(s.reps))) {
          problems.push(`${where}, ${ex.name}: weights and reps must be numbers of 0 or more`);
        }
        if (ex.step !== undefined && !(Number.isInteger(ex.step) && ex.step >= 1)) {
          problems.push(`${where}, ${ex.name}: the ladder step must be 1 or more`);
        }
      });
    });
  }

  if (!isObject(data.proteinLogs)) problems.push('proteinLogs must be an object of days');
  else {
    for (const [day, items] of Object.entries(data.proteinLogs)) {
      if (!isISODate(day)) problems.push(`protein day "${day}" is not a date`);
      if (!Array.isArray(items)) problems.push(`protein on ${day} must be a list`);
      else if (items.some((it) => !isObject(it) || !nonNegative(it.grams))) problems.push(`protein on ${day}: grams must be 0 or more`);
    }
  }

  if (!Array.isArray(data.checkIns)) problems.push('checkIns must be a list');
  else {
    data.checkIns.forEach((ci, i) => {
      if (!isObject(ci) || !isISODate(ci.date)) return problems.push(`check-in ${i + 1} has no valid date`);
      if (!nonNegative(ci.weight)) problems.push(`check-in ${i + 1}: weight must be 0 or more`);
      if (ci.cals !== null && ci.cals !== undefined && !nonNegative(ci.cals)) problems.push(`check-in ${i + 1}: calories must be 0 or more`);
    });
  }

  if (!Array.isArray(data.myFoods)) problems.push('myFoods must be a list');
  else if (data.myFoods.some((f) => !isObject(f) || typeof f.name !== 'string' || !nonNegative(f.protein))) {
    problems.push('every saved food needs a name and protein of 0 or more');
  }

  if (!isObject(data.personalBests)) problems.push('personalBests must be an object');
  else if (Object.values(data.personalBests).some((pb) => !isObject(pb) || !nonNegative(pb.weight) || !nonNegative(pb.reps))) {
    problems.push('personal bests must have weights and reps of 0 or more');
  }

  if (!nonNegative(data.bodyweight) || data.bodyweight === 0) problems.push('bodyweight must be a positive number');
  if (!PROGRAMS.includes(data.program)) problems.push(`unknown program "${data.program}"`);
  if (!PROGRAM[data.phase]) problems.push(`unknown phase "${data.phase}"`);
  if (!Number.isInteger(data.dayIndex) || data.dayIndex < 0) problems.push('dayIndex must be a whole number of 0 or more');
  if (!Number.isInteger(data.lastSeenStage) || data.lastSeenStage < 0 || data.lastSeenStage >= STAGES.length) {
    problems.push('lastSeenStage must be a stage number');
  }
  if (!isWeekdayList(data.officeDays)) problems.push('officeDays must be a list of weekdays 1 to 7');
  if (!isObject(data.officeWeeks)) problems.push('officeWeeks must be an object of weeks');
  else {
    for (const [week, days] of Object.entries(data.officeWeeks)) {
      if (!/^\d{4}-W\d{2}$/.test(week)) problems.push(`office week "${week}" is not a week`);
      if (!isWeekdayList(days)) problems.push(`office days in ${week} must be weekdays 1 to 7`);
    }
  }
  return problems;
}
