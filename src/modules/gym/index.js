// The Gym module: gainz-tracker inside TheHub (docs/plans/part-4-gym.md). Module contract:
// docs/plans/part-0-overview.md.
import { SCHEMA_VERSION, defaultData, migrations, validate } from './data.js';
import { findGainzOnThisPhone, prepareGainzImport } from './import.js';
import {
  currentDayName, getStreak, isHomePlan, proteinTarget, sessionsThisWeek, targetSessions, todayProtein, weekStatus, workoutFor,
} from './logic.js';
import { quoteFor, quoteLine } from './quotes.js';
import { routes } from './screens.js';
import { weatherSettingsCard } from './weather-settings.js';

/**
 * Today's card: the planned workout (or a rest day once the week's target is met), the week, protein,
 * streak, a quote for the day; then a warning when the week has no room left. Office days only count as busy
 * days: any day can be trained.
 */
export function todayCard(data, now = new Date()) {
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
  const left = Math.max(0, proteinTarget(data) - todayProtein(data, now));
  const streak = getStreak(data, now);
  const week = weekStatus(data, now);
  return {
    title: 'Gym',
    lines: [
      plan,
      `This week: ${done}/${target} sessions`,
      left > 0 ? `Protein: ${left}g left today` : 'Protein: target hit today ✅',
      `Streak: ${streak} week${streak === 1 ? '' : 's'}${streak > 0 ? ' 🔥' : ''}`,
      quoteLine(quoteFor(now.toISOString().split('T')[0])),
      week.warning,
    ].filter(Boolean),
    action: { label: 'Log workout', route: 'gym/log' },
  };
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
  todayCard: (data) => todayCard(data),
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
