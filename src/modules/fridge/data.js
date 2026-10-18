// The Fridge store's data (schema version 1). Text only: no photos are stored.
//
//   items     [{ id, name, brand, location: "fridge"|"freezer"|"pantry", quantity (text, e.g. "500 g"),
//                expiry: "YYYY-MM-DD" | null (a LOCAL calendar date, src/core/dates.js), added: "YYYY-MM-DD",
//                barcode: "5449000000996" | null, lookup: "pending" | null, nameAuto: boolean }]
//              lookup "pending" = scanned while offline: the barcode is looked up on Open Food Facts later.
//              nameAuto = the name is a stand-in ("Barcode 5449…") that a later lookup may replace.
//   waste     { used, thrown }   how many items were used up and how many were thrown away
//   products  { [barcode]: { name, brand, nameEn, nameBg, fetchedAt } }   Open Food Facts answers already
//              fetched, so scanning the same product again works offline
import { addDays, daysBetween, isCalendarDate, localDate } from '../../core/dates.js';

export const SCHEMA_VERSION = 1;

// PLACEHOLDER(Q-21): the three places from the plan; MiniFridge also had shelves and a counter.
export const LOCATIONS = [
  { id: 'fridge', name: 'Fridge', icon: '🧊' },
  { id: 'freezer', name: 'Freezer', icon: '❄️' },
  { id: 'pantry', name: 'Pantry', icon: '🥫' },
];
const LOCATION_IDS = new Set(LOCATIONS.map((l) => l.id));

/** How many days ahead "expiring soon" looks: today plus the next 2 days (the Today card). */
export const SOON_DAYS = 2;

export function defaultData() {
  return { items: [], waste: { used: 0, thrown: 0 }, products: {} };
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isCount = (n) => Number.isInteger(n) && n >= 0;
const isText = (v) => typeof v === 'string';

/** Problems with the data; [] means complete. Used by backup verification. */
export function validate(data) {
  const problems = [];
  if (!isObject(data)) return ['the fridge data is missing'];

  if (!Array.isArray(data.items)) problems.push('items must be a list');
  else {
    const ids = new Set();
    data.items.forEach((item, i) => {
      const where = `item ${i + 1}`;
      if (!isObject(item)) return problems.push(`${where} is not an item`);
      if (!isText(item.id) || !item.id) problems.push(`${where} has no id`);
      else if (ids.has(item.id)) problems.push(`${where} repeats the id ${item.id}`);
      else ids.add(item.id);
      if (!isText(item.name) || !item.name.trim()) problems.push(`${where} has no name`);
      if (!isText(item.brand)) problems.push(`${where}: brand must be text`);
      if (!LOCATION_IDS.has(item.location)) problems.push(`${where} has an unknown place "${item.location}"`);
      if (!isText(item.quantity)) problems.push(`${where}: quantity must be text`);
      if (item.expiry !== null && !isCalendarDate(item.expiry)) problems.push(`${where} has no valid expiry date`);
      if (!isCalendarDate(item.added)) problems.push(`${where} has no valid added date`);
      if (item.barcode !== null && !(isText(item.barcode) && /^\d{8,14}$/.test(item.barcode))) problems.push(`${where} has an invalid barcode`);
      if (item.lookup !== null && item.lookup !== 'pending') problems.push(`${where} has an unknown lookup state`);
      if (item.lookup === 'pending' && item.barcode === null) problems.push(`${where} waits for a lookup without a barcode`);
      if (typeof item.nameAuto !== 'boolean') problems.push(`${where}: nameAuto must be true or false`);
    });
  }

  if (!isObject(data.waste) || !isCount(data.waste.used) || !isCount(data.waste.thrown)) {
    problems.push('waste must count used and thrown items (whole numbers of 0 or more)');
  }

  if (!isObject(data.products)) problems.push('products must be an object of barcodes');
  else {
    for (const [code, p] of Object.entries(data.products)) {
      if (!/^\d{8,14}$/.test(code)) problems.push(`product "${code}" is not a barcode`);
      if (!isObject(p) || !isText(p.name) || !isText(p.brand) || !isText(p.nameEn) || !isText(p.nameBg) || !isText(p.fetchedAt)) {
        problems.push(`product ${code} is incomplete`);
      }
    }
  }
  return problems;
}

let counter = 0;
/** A new item id (unique enough for one phone). */
export function newId(now = Date.now()) {
  counter = (counter + 1) % 1e6;
  return `i${now.toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** The stand-in name for a barcode scanned offline. */
export const placeholderName = (barcode) => `Barcode ${barcode}`;

/**
 * Adds an item. fields: { name, brand, location, quantity, expiry, barcode, lookup }. An empty name with a
 * barcode becomes the stand-in name. Returns { data, item } (data is a new object; the old one is untouched).
 */
export function addItem(data, fields, now = new Date()) {
  const barcode = fields.barcode || null;
  const typed = String(fields.name ?? '').trim();
  const nameAuto = !typed && Boolean(barcode);
  const item = {
    id: newId(new Date(now).getTime()),
    name: typed || (barcode ? placeholderName(barcode) : ''),
    brand: String(fields.brand ?? '').trim(),
    location: LOCATION_IDS.has(fields.location) ? fields.location : 'fridge',
    quantity: String(fields.quantity ?? '').trim(),
    expiry: fields.expiry || null,
    added: localDate(now),
    barcode,
    lookup: fields.lookup === 'pending' && barcode ? 'pending' : null,
    nameAuto,
  };
  return { data: { ...data, items: [...data.items, item] }, item };
}

/** Changes an item's editable fields (name, brand, location, quantity, expiry). */
export function updateItem(data, id, fields) {
  return {
    ...data,
    items: data.items.map((it) => {
      if (it.id !== id) return it;
      const next = { ...it };
      if (fields.name !== undefined) {
        const name = String(fields.name).trim();
        if (name && name !== it.name) {
          next.name = name;
          next.nameAuto = false;
        }
      }
      if (fields.brand !== undefined) next.brand = String(fields.brand).trim();
      if (fields.location !== undefined && LOCATION_IDS.has(fields.location)) next.location = fields.location;
      if (fields.quantity !== undefined) next.quantity = String(fields.quantity).trim();
      if (fields.expiry !== undefined) next.expiry = fields.expiry || null;
      return next;
    }),
  };
}

/**
 * Takes an item out. outcome: 'used' (eaten or used up), 'thrown' (thrown away) or 'mistake' (added by
 * mistake: not counted).
 */
export function removeItem(data, id, outcome) {
  if (!data.items.some((it) => it.id === id)) return data;
  const waste = { ...data.waste };
  if (outcome === 'used') waste.used += 1;
  else if (outcome === 'thrown') waste.thrown += 1;
  return { ...data, items: data.items.filter((it) => it.id !== id), waste };
}

/** Items in expiry order: soonest first, items without a date last; ties by name. */
export function sortByExpiry(items) {
  return [...items].sort((a, b) => {
    if (a.expiry !== b.expiry) {
      if (a.expiry === null) return 1;
      if (b.expiry === null) return -1;
      return a.expiry < b.expiry ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/** Days from today to the item's expiry (negative = expired), or null without a date. */
export function daysLeft(item, now = new Date()) {
  return item.expiry ? daysBetween(localDate(now), item.expiry) : null;
}

/** Items that expire today or within SOON_DAYS, plus those already expired, in expiry order. */
export function expiringSoon(items, now = new Date()) {
  const last = addDays(localDate(now), SOON_DAYS);
  return sortByExpiry(items.filter((it) => it.expiry !== null && it.expiry <= last));
}

/** "DD-MM-YYYY", the way dates are shown (the plan's Dutch format). */
export function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

/** "Expired 2 days ago", "Expires today", "Expires tomorrow", "Expires in 5 days", "Expires 01-12-2026" or "No date". */
export function expiryLabel(item, now = new Date()) {
  const days = daysLeft(item, now);
  if (days === null) return 'No date';
  if (days < -1) return `Expired ${-days} days ago`;
  if (days === -1) return 'Expired yesterday';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  if (days <= 14) return `Expires in ${days} days`;
  return `Expires ${formatDate(item.expiry)}`;
}

/** 'expired' | 'soon' | 'ok' | 'none': the colour of an item's date. */
export function expiryState(item, now = new Date()) {
  const days = daysLeft(item, now);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= SOON_DAYS) return 'soon';
  return 'ok';
}

/** Items still waiting for a lookup. */
export const pendingItems = (data) => data.items.filter((it) => it.lookup === 'pending');

/** Saves an Open Food Facts answer in the product cache. */
export function cacheProduct(data, barcode, product, now = new Date()) {
  const entry = {
    name: product.name || '',
    brand: product.brand || '',
    nameEn: product.nameEn || '',
    nameBg: product.nameBg || '',
    fetchedAt: new Date(now).toISOString(),
  };
  return { ...data, products: { ...data.products, [barcode]: entry } };
}

/**
 * Looks up the barcodes of items scanned offline (at most `max` per run, one request each, in turn).
 * lookup(code) resolves like off.js lookupProduct. A found product fills in a stand-in name and an empty
 * brand; a product OFF does not know just stops waiting; an error (still offline) stops the run and
 * leaves the rest queued. Returns { data, resolved, found, remaining }.
 */
export async function resolvePending(data, lookup, { max = 10, now = new Date() } = {}) {
  const codes = [...new Set(pendingItems(data).map((it) => it.barcode))].slice(0, max);
  let next = data;
  let resolved = 0;
  let found = 0;
  for (const code of codes) {
    const result = await lookup(code);
    if (result.status === 'error') break;
    const product = result.status === 'found' ? result.product : null;
    if (product) {
      next = cacheProduct(next, code, product, now);
      found += 1;
    }
    next = {
      ...next,
      items: next.items.map((it) => {
        if (it.barcode !== code || it.lookup !== 'pending') return it;
        const done = { ...it, lookup: null };
        if (product?.name && it.nameAuto) {
          done.name = product.name;
          done.nameAuto = false;
        }
        if (product?.brand && !it.brand) done.brand = product.brand;
        return done;
      }),
    };
    resolved += 1;
  }
  return { data: next, resolved, found, remaining: pendingItems(next).length };
}

/** The word offered to the Bulgarian module for an item: { bg, en, topic }. */
export function bulgarianOffer(item, product, bg) {
  return { bg: String(bg ?? '').trim(), en: (product?.nameEn || item.name).trim(), topic: OFFER_TOPIC };
}

// PLACEHOLDER(Q-21): the topic the Bulgarian module files Fridge words under ("From my home" deck, Part 7).
export const OFFER_TOPIC = 'food';
