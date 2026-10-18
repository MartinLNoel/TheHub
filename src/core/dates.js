// Calendar dates, shared by the core and every module that stores or compares a day.
//
// A calendar date is the LOCAL date as "YYYY-MM-DD": a session finished at 00:30 in Amsterdam
// belongs to that day, not to the day before (which is what toISOString().slice(0, 10), the UTC
// date, would say). Timestamps (instants) stay ISO strings from toISOString(); only days use this.
//
// The Gym module does not use it yet: it keeps gainz-tracker's UTC "today" on purpose (Q-11).

/** The local calendar date of a Date (or anything new Date() takes), as "YYYY-MM-DD". */
export function localDate(now = new Date()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" plus `days` calendar days (negative goes back), as "YYYY-MM-DD". */
export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  // Noon, so a daylight-saving change never moves the result to another day.
  return localDate(new Date(y, m - 1, d + days, 12));
}

/** Whole calendar days from date `a` to date `b` (both "YYYY-MM-DD"; positive when b is later). */
export function daysBetween(a, b) {
  const [ay, am, ad] = a.slice(0, 10).split('-').map(Number);
  const [by, bm, bd] = b.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** True for a real calendar date written as "YYYY-MM-DD" (so not "2026-02-30"). */
export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
