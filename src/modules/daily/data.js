// Daily checks (0.9.13; Martin, 2026-11-21: a check mark in the home screen's Today section to tick when he has done
// something he does once a day, so he can see whether he did it today; it resets every day). Each check is ticked
// at most once a day; the ticks are kept for HISTORY_DAYS so the page can show the last two weeks and a streak.
// What the checks are is Martin's to name (in the app, never in the repo).
//
//   checks  [{ id, name, icon }]   in the order shown; id "c1", "c2", … never reused
//   done    { [checkId]: ["YYYY-MM-DD", …] }   the days each check was ticked, oldest first
//   nextId  the number for the next new check's id
import { addDays, isCalendarDate, localDate } from '../../core/dates.js';

export const SCHEMA_VERSION = 1;
export const HISTORY_DAYS = 60;
export const MAX_CHECKS = 6;
export const MAX_NAME = 30;

export function defaultData() {
  return { checks: [{ id: 'c1', name: 'Daily check', icon: '✅' }], done: { c1: [] }, nextId: 2 };
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function validate(d) {
  if (!isObject(d)) return ['the daily checks data is missing'];
  const p = [];
  if (!Array.isArray(d.checks) || d.checks.length > MAX_CHECKS) p.push(`checks must be a list of at most ${MAX_CHECKS}`);
  else {
    const ids = new Set();
    for (const c of d.checks) {
      if (!isObject(c) || typeof c.id !== 'string' || !/^c\d+$/.test(c.id)) p.push('every check needs an id like "c1"');
      else if (ids.has(c.id)) p.push(`check id ${c.id} is used twice`);
      else ids.add(c.id);
      if (!isObject(c) || typeof c.name !== 'string' || !c.name.trim() || c.name.length > MAX_NAME) p.push(`every check needs a name of at most ${MAX_NAME} characters`);
      if (!isObject(c) || typeof c.icon !== 'string' || !c.icon.trim() || c.icon.length > 8) p.push('every check needs an icon');
    }
  }
  if (!isObject(d.done)) p.push('done must be an object of day lists');
  else if (Object.values(d.done).some((days) => !Array.isArray(days) || days.some((x) => !isCalendarDate(x)))) p.push('done must hold lists of dates');
  if (!Number.isInteger(d.nextId) || d.nextId < 1) p.push('nextId must be a whole number of 1 or more');
  return p;
}

export const doneOn = (data, id, day) => (data.done[id] || []).includes(day);
export const doneToday = (data, id, now = new Date()) => doneOn(data, id, localDate(now));

/** Ticks or unticks a check for today (a mis-tap can be undone). Forgets days older than HISTORY_DAYS. */
export function toggle(data, id, now = new Date()) {
  if (!data.checks.some((c) => c.id === id)) return data;
  const today = localDate(now);
  const cutoff = addDays(today, -HISTORY_DAYS);
  const days = (data.done[id] || []).filter((d) => d >= cutoff && d !== today);
  if (!doneOn(data, id, today)) days.push(today);
  days.sort();
  return { ...data, done: { ...data.done, [id]: days } };
}

/**
 * Days in a row up to today. Today not ticked yet does not break it (the day is not over): it counts from
 * yesterday then.
 */
export function streak(data, id, now = new Date()) {
  const days = new Set(data.done[id] || []);
  let day = localDate(now);
  if (!days.has(day)) day = addDays(day, -1);
  let n = 0;
  while (days.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

/** The last `n` days, oldest first: [{ day, done }]. */
export function lastDays(data, id, n = 14, now = new Date()) {
  const today = localDate(now);
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - n + 1);
    return { day, done: doneOn(data, id, day) };
  });
}

const cleanName = (name) => String(name ?? '').trim().slice(0, MAX_NAME);
const cleanIcon = (icon) => {
  const s = String(icon ?? '').trim();
  return s ? [...s].slice(0, 2).join('') : '✅';
};

export function addCheck(data, name, icon) {
  const n = cleanName(name);
  if (!n || data.checks.length >= MAX_CHECKS) return data;
  const id = `c${data.nextId}`;
  return { ...data, checks: [...data.checks, { id, name: n, icon: cleanIcon(icon) }], done: { ...data.done, [id]: [] }, nextId: data.nextId + 1 };
}

export function editCheck(data, id, name, icon) {
  const n = cleanName(name);
  if (!n) return data;
  return { ...data, checks: data.checks.map((c) => (c.id === id ? { ...c, name: n, icon: cleanIcon(icon) } : c)) };
}

export function removeCheck(data, id) {
  const done = { ...data.done };
  delete done[id];
  return { ...data, checks: data.checks.filter((c) => c.id !== id), done };
}
