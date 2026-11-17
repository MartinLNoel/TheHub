// The market session clock on the home screen (decided with Martin 2026-11-16, for learning forex trading):
// which of the Tokyo, London and New York sessions is open, and how long until each opens or closes.
//
// Hours are the usual forex session convention, in each city's own clock (so summer time is handled by the
// time zone): Tokyo 09:00–18:00, London 08:00–17:00, New York 08:00–17:00, Monday to Friday. They are a
// convention, not exchange opening hours: forex trades around the clock on weekdays, and these are its
// busiest stretches. London and New York overlapping is the busiest of all.

export const SESSIONS = [
  { id: 'tokyo', name: 'Tokyo', flag: '🇯🇵', tz: 'Asia/Tokyo', open: 9, close: 18 },
  { id: 'london', name: 'London', flag: '🇬🇧', tz: 'Europe/London', open: 8, close: 17 },
  { id: 'newyork', name: 'New York', flag: '🇺🇸', tz: 'America/New_York', open: 8, close: 17 },
];

const HOUR = 3_600_000;
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formats = new Map();

/** The wall-clock weekday (0 = Sunday), hour and minute in a time zone. */
export function zoned(date, tz) {
  if (!formats.has(tz)) {
    formats.set(tz, new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }));
  }
  const parts = Object.fromEntries(formats.get(tz).formatToParts(date).map((p) => [p.type, p.value]));
  return { weekday: WEEKDAYS[parts.weekday], hour: Number(parts.hour) % 24, minute: Number(parts.minute) };
}

export function isOpen(session, date) {
  const z = zoned(date, session.tz);
  if (z.weekday === 0 || z.weekday === 6) return false;
  const minutes = z.hour * 60 + z.minute;
  return minutes >= session.open * 60 && minutes < session.close * 60;
}

/**
 * When the session next opens or closes. Every boundary falls on a whole UTC hour (the three cities are a whole
 * number of hours from UTC, and sessions start on the hour), so whole hours ahead are checked, up to 8 days.
 */
export function nextChange(session, date) {
  const now = isOpen(session, date);
  const start = Math.floor(date.getTime() / HOUR) * HOUR;
  for (let i = 1; i <= 8 * 24; i++) {
    const at = new Date(start + i * HOUR);
    if (isOpen(session, at) !== now) return at;
  }
  return null;
}

/** "2h 05m", "45m", "1d 13h". */
export function untilText(ms) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** Every session's state: [{ ...session, isOpen, changeAt, text }], plus whether London and New York overlap. */
export function marketStatus(date = new Date()) {
  const sessions = SESSIONS.map((s) => {
    const open = isOpen(s, date);
    const changeAt = nextChange(s, date);
    const until = changeAt ? untilText(changeAt - date) : '';
    return { ...s, isOpen: open, changeAt, text: open ? `Open · closes in ${until}` : `Closed · opens in ${until}` };
  });
  const by = Object.fromEntries(sessions.map((s) => [s.id, s]));
  return { sessions, overlap: by.london.isOpen && by.newyork.isOpen };
}
