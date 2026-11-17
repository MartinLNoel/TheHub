// The Fridge module (docs/plans/part-8-fridge.md): fridge, freezer and pantry items with expiry dates,
// barcode scanning with Open Food Facts lookups, and "expiring soon" on Today. Since 0.9.8 it also keeps the
// food log (protein and calories, moved from the Gym), quick foods and recipes (food.js, recipes.js). Module
// contract: docs/plans/part-0-overview.md. Text only: no photos are stored.
import { localDate } from '../../core/dates.js';
import { SCHEMA_VERSION, SOON_DAYS, defaultData, expiringSoon, expiryLabel, migrations, pendingItems, validate } from './data.js';
import { foodDay, learningDay, mergeGymArchive } from './food.js';
import { routes } from './screens.js';

const MAX_LINES = 4;

/** The food line for Today: "🍽 Food today: 1450 / 2550 kcal · 85g protein". */
export function foodLine(data, now = new Date()) {
  const t = foodDay(data, localDate(now)).totals;
  const target = data.food.kcalTarget;
  const kcal = target ? `${t.kcal} / ${target} kcal` : `${t.kcal} kcal`;
  return `🍽 Food today: ${kcal} · ${t.protein}g protein${learningDay(data, now) ? ' (learning your days)' : ''}`;
}

/** Today's card: what expires today or in the next 2 days (and what already expired), and today's food. */
export function todayCard(data, now = new Date()) {
  if (!data) return null;
  const soon = expiringSoon(data.items, now);
  const lines = soon.slice(0, MAX_LINES).map((it) => `${it.name}: ${expiryLabel(it, now).toLowerCase()}`);
  if (soon.length > MAX_LINES) lines.push(`… and ${soon.length - MAX_LINES} more`);
  if (!soon.length) {
    lines.push(
      data.items.length
        ? `Nothing expires in the next ${SOON_DAYS} days (${data.items.length} item${data.items.length === 1 ? '' : 's'} stored).`
        : 'Nothing stored yet.',
    );
  }
  const pending = pendingItems(data).length;
  if (pending) lines.push(`${pending} scanned item${pending === 1 ? '' : 's'} still to look up.`);
  lines.push(foodLine(data, now));
  return {
    title: soon.length ? `Fridge: ${soon.length} expiring soon` : 'Fridge',
    lines,
    action: soon.length ? { label: 'Open Fridge', route: 'fridge' } : { label: 'Log food', route: 'fridge/food' },
  };
}

/** The home screen's "today" tile: what expires soon, and today's calories. */
export function homeTile(data, now = new Date()) {
  if (!data) return null;
  const soon = expiringSoon(data.items, now).length;
  const kcal = foodDay(data, localDate(now)).totals.kcal;
  return { title: 'Fridge', text: soon ? `${soon} expiring soon` : 'Nothing expiring', sub: `${kcal} kcal today`, href: soon ? '#/fridge' : '#/fridge/food' };
}

/** Takes over the Gym's old protein log (once; later only what is new), through the hub. */
export async function onStart({ hub }) {
  const archive = hub.ask('gym', 'foodArchive');
  if (!archive) return { accepted: false, reason: 'nothing' };
  return hub.offer('fridge', { kind: 'gym-food', archive });
}

export default {
  id: 'fridge',
  name: 'Fridge',
  icon: '🧊',
  schemaVersion: SCHEMA_VERSION,
  migrations,
  defaultData,
  validate,
  routes,
  todayCard: (data) => todayCard(data),
  homeTile: (data) => homeTile(data),
  answers: {
    /** For the pet (0.9.12): each day with food logged is a meal. */
    activities: (data) => Object.entries(data.food.log).filter(([, e]) => e.length).map(([date]) => ({ id: `food-${date}`, kind: 'food', date })),
    foodDay: (data, date) => foodDay(data, date || localDate()),
    kcalTarget: (data) => data.food.kcalTarget,
  },
  accept: (item, data) => (item?.kind === 'gym-food' ? mergeGymArchive(data, item.archive) : null),
  onStart,
};
