// The Gym module: gainz-tracker inside TheHub (docs/plans/part-4-gym.md). Module contract:
// docs/plans/part-0-overview.md.
import { SCHEMA_VERSION, defaultData, validate } from './data.js';
import { findGainzOnThisPhone, prepareGainzImport } from './import.js';
import { currentDayName, getStreak, proteinTarget, sessionsThisWeek, targetSessions, todayProtein } from './logic.js';
import { WORKOUTS } from './program.js';
import { routes } from './screens.js';

/** Today's card: the planned workout (or a rest day once the week's target is met), the week, protein, streak. */
export function todayCard(data, now = new Date()) {
  if (!data) return null;
  const done = sessionsThisWeek(data, now);
  const target = targetSessions(data);
  const loggedToday = data.workoutLogs.some((l) => l.date === now.toISOString().split('T')[0]);
  const day = currentDayName(data, now);
  const plan =
    done >= target
      ? `Rest day: this week's ${target} sessions are done (an extra one still counts).`
      : loggedToday
        ? `Done today. Next: ${day} — ${WORKOUTS[day].focus}.`
        : `Today: ${day} — ${WORKOUTS[day].focus}`;
  const left = Math.max(0, proteinTarget(data) - todayProtein(data, now));
  const streak = getStreak(data, now);
  return {
    title: 'Gym',
    lines: [
      plan,
      `This week: ${done}/${target} sessions`,
      left > 0 ? `Protein: ${left}g left today` : 'Protein: target hit today ✅',
      `Streak: ${streak} week${streak === 1 ? '' : 's'}${streak > 0 ? ' 🔥' : ''}`,
    ],
    action: { label: 'Log workout', route: 'gym/log' },
  };
}

export default {
  id: 'gym',
  name: 'Gym',
  icon: '🏋️',
  schemaVersion: SCHEMA_VERSION,
  migrations: {},
  defaultData,
  validate,
  routes,
  todayCard: (data) => todayCard(data),
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
