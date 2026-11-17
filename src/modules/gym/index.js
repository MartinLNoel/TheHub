// The Gym module: gainz-tracker inside TheHub (docs/plans/part-4-gym.md). Module contract:
// docs/plans/part-0-overview.md.
import { SCHEMA_VERSION, defaultData, migrations, validate } from './data.js';
import { findGainzOnThisPhone, prepareGainzImport } from './import.js';
import {
  currentDayName, getStreak, isHomePlan, proteinTarget, sessionsThisWeek, targetSessions, weekStatus, workoutFor,
} from './logic.js';
import { quoteFor, quoteLine } from './quotes.js';
import { fridgeDay, routes } from './screens.js';
import { cachedReading, currentReading, weatherText } from './story/weather.js';
import { weatherSettingsCard } from './weather-settings.js';

/**
 * Today's card: the planned workout (or a rest day once the week's target is met), the week, protein,
 * streak, a quote for the day; then a warning when the week has no room left. Office days only count as busy
 * days: any day can be trained. Protein eaten comes from the Fridge's food log (hub.ask, 0.9.8).
 */
export function todayCard(data, now = new Date(), hub = null) {
  if (!data) return null;
  const done = sessionsThisWeek(data, now);
  const target = targetSessions(data);
  const loggedToday = data.workoutLogs.some((l) => l.date === now.toISOString().split('T')[0]);
  const day = currentDayName(data, now);
  const focus = workoutFor(day, isHomePlan(data) ? 'home' : 'gym').focus;
  const plan =
    done >= target
      ? `Rest day: this week's ${target} sessions are done (an extra one still counts).`
      : loggedToday
        ? `Done today. Next: ${day} — ${focus}.`
        : `Today: ${day} — ${focus}`;
  const goal = proteinTarget(data);
  const left = goal === null ? null : Math.max(0, goal - fridgeDay(hub).totals.protein);
  const streak = getStreak(data, now);
  const week = weekStatus(data, now);
  return {
    title: 'Gym',
    lines: [
      plan,
      `This week: ${done}/${target} sessions`,
      left === null ? 'Protein: enter your weight (Gym → Protein) for a daily target' : left > 0 ? `Protein: ${left}g left today` : 'Protein: target hit today ✅',
      `Streak: ${streak} week${streak === 1 ? '' : 's'}${streak > 0 ? ' 🔥' : ''}`,
      quoteLine(quoteFor(now.toISOString().split('T')[0])),
      week.warning,
    ].filter(Boolean),
    action: { label: 'Log workout', route: 'gym/log' },
  };
}

/**
 * The home screen's weather line (Martin, 2026-11-16: the weather status shows on the home page; the Fighter's
 * scenes still use the weather). Drawn from the cached reading, then refreshed in the background.
 */
export function homeStatus(data, { fetchFn } = {}) {
  if (!data) return null;
  const town = data.weatherTown;
  if (!town) return { text: '🌤️ Weather: set your town in Settings', href: '#/settings' };
  return {
    text: weatherText(town, cachedReading(town)),
    refresh: async () => {
      const fresh = await currentReading(town, fetchFn ? { fetchFn } : undefined);
      return fresh ? { text: weatherText(town, fresh) } : null;
    },
  };
}

/** The home screen's "today" tile: today's day, or rest / done, and the week. */
export function homeTile(data, now = new Date()) {
  if (!data) return null;
  const done = sessionsThisWeek(data, now);
  const target = targetSessions(data);
  const loggedToday = data.workoutLogs.some((l) => l.date === now.toISOString().split('T')[0]);
  const text = loggedToday ? 'Done today ✓' : done >= target ? 'Rest day' : currentDayName(data, now);
  return { title: 'Gym', text, sub: `${done}/${target} this week`, href: loggedToday || done >= target ? '#/gym' : '#/gym/log' };
}

export default {
  id: 'gym',
  name: 'Gym',
  icon: '🏋️',
  schemaVersion: SCHEMA_VERSION,
  migrations,
  defaultData,
  validate,
  routes,
  todayCard: (data, ctx) => todayCard(data, new Date(), ctx?.hub),
  answers: {
    /** For the pet (0.9.12): each workout is a meal. */
    activities: (data) => data.workoutLogs.map((l) => ({ id: `gym-${l.id ?? l.date}`, kind: 'workout', date: l.date })),
    bodyweight: (data) => data.bodyweight,
    proteinTarget: (data) => proteinTarget(data),
    /** The protein log and saved foods from before 0.9.8, for the Fridge to take over (kept here as an archive). */
    foodArchive: (data) => ({ proteinLogs: data.proteinLogs, myFoods: data.myFoods }),
  },
  homeStatus: (data) => homeStatus(data),
  homeTile: (data) => homeTile(data),
  settingsCard: (api) => weatherSettingsCard(api),
  importers: [
    {
      id: 'gainz-tracker',
      title: 'Import from gainz-tracker',
      description:
        'Brings your gainz-tracker history into the Gym: in gainz-tracker, Check-in → "Export all data (JSON)", then pick that file here. Importing the same file again adds nothing twice.',
      prepare: prepareGainzImport,
      findLocal: () => findGainzOnThisPhone(),
      localLabel: 'Use the gainz-tracker data on this phone',
    },
  ],
};
