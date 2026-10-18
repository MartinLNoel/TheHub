// The Fridge module (docs/plans/part-8-fridge.md): fridge, freezer and pantry items with expiry dates,
// barcode scanning with Open Food Facts lookups, and "expiring soon" on Today. Module contract:
// docs/plans/part-0-overview.md. Text only: no photos are stored.
import { SCHEMA_VERSION, SOON_DAYS, defaultData, expiringSoon, expiryLabel, pendingItems, validate } from './data.js';
import { routes } from './screens.js';

const MAX_LINES = 4;

/** Today's card: what expires today or in the next 2 days (and what already expired). */
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
  return {
    title: soon.length ? `Fridge: ${soon.length} expiring soon` : 'Fridge',
    lines,
    action: soon.length ? { label: 'Open Fridge', route: 'fridge' } : { label: 'Scan item', route: 'fridge/scan' },
  };
}

export default {
  id: 'fridge',
  name: 'Fridge',
  icon: '🧊',
  schemaVersion: SCHEMA_VERSION,
  migrations: {},
  defaultData,
  validate,
  routes,
  todayCard: (data) => todayCard(data),
};
