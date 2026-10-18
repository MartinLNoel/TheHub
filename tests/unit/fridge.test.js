// Fridge module (Part 8): barcodes, data rules, expiry sorting and the 2-day window, Open Food Facts
// mapping (fetch is always mocked: no test ever reaches the real service), the offline queue, the Today
// card and validate.
import { afterEach, describe, expect, it, vi } from 'vitest';
import fridge, { todayCard } from '../../src/modules/fridge/index.js';
import { expandUpcE, gs1CheckDigit, normalizeBarcode } from '../../src/modules/fridge/barcode.js';
import {
  addItem,
  bulgarianOffer,
  cacheProduct,
  defaultData,
  expiringSoon,
  expiryLabel,
  expiryState,
  formatDate,
  pendingItems,
  removeItem,
  resolvePending,
  sortByExpiry,
  updateItem,
  validate,
} from '../../src/modules/fridge/data.js';
import { OFF_PRODUCT_URL, lookupProduct, mapProduct, mapResponse, productUrl } from '../../src/modules/fridge/off.js';
import { checkModule } from '../../src/core/registry.js';
import { addDays, isCalendarDate, localDate } from '../../src/core/dates.js';
import { countItems } from '../../src/core/transfer.js';

// Local wall-clock times, so every test means the same in any time zone (and with TZ=UTC).
const NOW = new Date(2026, 9, 18, 9, 0); // 18 October 2026, 09:00 local
const TODAY = '2026-10-18';

function withItems(specs) {
  let data = defaultData();
  for (const s of specs) data = addItem(data, { location: 'fridge', ...s }, NOW).data;
  return data;
}

const okJson = (body, status = 200) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

afterEach(() => vi.useRealTimers());

describe('the module', () => {
  it('follows the module contract, with the scan route the manifest shortcut opens', () => {
    expect(checkModule(fridge)).toEqual([]);
    expect(fridge.id).toBe('fridge');
    expect(Object.keys(fridge.routes)).toEqual(expect.arrayContaining(['', 'scan', 'add', 'add/*', 'item/*']));
  });

  it('fresh data is valid and counts for backups', () => {
    expect(validate(defaultData())).toEqual([]);
    const data = withItems([{ name: 'Milk', expiry: TODAY }]);
    expect(validate(data)).toEqual([]);
    expect(countItems(data)).toMatchObject({ items: 1, products: 0 });
  });
});

describe('barcodes', () => {
  it('computes GS1 check digits', () => {
    expect(gs1CheckDigit('544900000099')).toBe(6); // EAN-13 5449000000996
    expect(gs1CheckDigit('9638507')).toBe(4); // EAN-8 96385074
    expect(gs1CheckDigit('03600029145')).toBe(2); // UPC-A 036000291452
  });

  it('accepts valid EAN-13, EAN-8 and UPC-A codes and refuses bad ones', () => {
    expect(normalizeBarcode('5449000000996')).toBe('5449000000996');
    expect(normalizeBarcode(' 5449 0000 00996 ')).toBe('5449000000996');
    expect(normalizeBarcode('96385074')).toBe('96385074');
    expect(normalizeBarcode('036000291452')).toBe('036000291452');
    expect(normalizeBarcode('5449000000995')).toBeNull(); // wrong check digit
    expect(normalizeBarcode('12345')).toBeNull();
    expect(normalizeBarcode('abc')).toBeNull();
    expect(normalizeBarcode('')).toBeNull();
  });

  it('expands UPC-E to UPC-A', () => {
    expect(expandUpcE('04252614')).toBe('042100005264');
    expect(normalizeBarcode('04252614', 'upc_e')).toBe('042100005264');
    expect(normalizeBarcode('04252614')).toBe('042100005264'); // not a valid EAN-8, valid UPC-E
  });
});

describe('items', () => {
  it('adds an item with the local added date, defaults and no photo fields', () => {
    const { data, item } = addItem(defaultData(), { name: ' Milk ', quantity: '1 L', expiry: '2026-10-20' }, NOW);
    expect(item).toMatchObject({ name: 'Milk', brand: '', location: 'fridge', quantity: '1 L', expiry: '2026-10-20', added: TODAY, barcode: null, lookup: null, nameAuto: false });
    expect(Object.keys(item).sort()).toEqual(['added', 'barcode', 'brand', 'expiry', 'id', 'location', 'lookup', 'name', 'nameAuto', 'quantity']);
    expect(data.items).toHaveLength(1);
  });

  it('dates an item added at 00:30 with that local day, not the UTC day before', () => {
    const lateNight = new Date(2026, 9, 18, 0, 30);
    expect(addItem(defaultData(), { name: 'Yoghurt' }, lateNight).item.added).toBe('2026-10-18');
    expect(localDate(lateNight)).toBe('2026-10-18');
  });

  it('gives an offline scan without a name a stand-in name', () => {
    const { item } = addItem(defaultData(), { name: '', barcode: '5449000000996', lookup: 'pending' }, NOW);
    expect(item).toMatchObject({ name: 'Barcode 5449000000996', nameAuto: true, lookup: 'pending', barcode: '5449000000996' });
  });

  it('marks used and thrown away (the waste count); a mistake is not counted', () => {
    let data = withItems([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
    const [a, b, c] = data.items;
    data = removeItem(data, a.id, 'used');
    data = removeItem(data, b.id, 'thrown');
    data = removeItem(data, c.id, 'mistake');
    expect(data.items).toEqual([]);
    expect(data.waste).toEqual({ used: 1, thrown: 1 });
    expect(removeItem(data, 'nope', 'used')).toBe(data);
  });

  it('edits an item; a typed name replaces a stand-in name', () => {
    let data = addItem(defaultData(), { barcode: '5449000000996', lookup: 'pending' }, NOW).data;
    const id = data.items[0].id;
    data = updateItem(data, id, { name: 'Cola', location: 'pantry', expiry: '' , quantity: '1.5 L' });
    expect(data.items[0]).toMatchObject({ name: 'Cola', nameAuto: false, location: 'pantry', expiry: null, quantity: '1.5 L' });
  });
});

describe('expiry: sorting and the 2-day window', () => {
  const data = withItems([
    { name: 'No date' },
    { name: 'In 3 days', expiry: addDays(TODAY, 3) },
    { name: 'Today', expiry: TODAY },
    { name: 'In 2 days', expiry: addDays(TODAY, 2) },
    { name: 'Expired', expiry: addDays(TODAY, -1) },
    { name: 'Tomorrow', expiry: addDays(TODAY, 1) },
    { name: 'Also today', expiry: TODAY },
  ]);

  it('sorts soonest first, ties by name, items without a date last', () => {
    expect(sortByExpiry(data.items).map((i) => i.name)).toEqual(['Expired', 'Also today', 'Today', 'Tomorrow', 'In 2 days', 'In 3 days', 'No date']);
  });

  it('"expiring soon" is today and the next 2 days, plus anything already expired', () => {
    expect(expiringSoon(data.items, NOW).map((i) => i.name)).toEqual(['Expired', 'Also today', 'Today', 'Tomorrow', 'In 2 days']);
  });

  it('the window follows the local day at 00:30 (not the UTC date)', () => {
    const lateNight = new Date(2026, 9, 19, 0, 30); // a day later: "In 3 days" is now in 2 days
    expect(expiringSoon(data.items, lateNight).map((i) => i.name)).toContain('In 3 days');
    const justBefore = new Date(2026, 9, 18, 23, 59);
    expect(expiringSoon(data.items, justBefore).map((i) => i.name)).not.toContain('In 3 days');
  });

  it('labels and colours', () => {
    const at = (expiry) => ({ expiry });
    expect(expiryLabel(at(addDays(TODAY, -3)), NOW)).toBe('Expired 3 days ago');
    expect(expiryLabel(at(addDays(TODAY, -1)), NOW)).toBe('Expired yesterday');
    expect(expiryLabel(at(TODAY), NOW)).toBe('Expires today');
    expect(expiryLabel(at(addDays(TODAY, 1)), NOW)).toBe('Expires tomorrow');
    expect(expiryLabel(at(addDays(TODAY, 5)), NOW)).toBe('Expires in 5 days');
    expect(expiryLabel(at('2026-12-01'), NOW)).toBe('Expires 01-12-2026');
    expect(expiryLabel(at(null), NOW)).toBe('No date');
    expect([-1, 0, 2, 3].map((d) => expiryState(at(addDays(TODAY, d)), NOW))).toEqual(['expired', 'soon', 'soon', 'ok']);
    expect(expiryState(at(null), NOW)).toBe('none');
    expect(formatDate('2026-03-07')).toBe('07-03-2026');
  });
});

describe('Today card', () => {
  it('lists what expires today and in the next 2 days, with one tap to the Fridge', () => {
    const data = withItems([
      { name: 'Milk', expiry: TODAY },
      { name: 'Cheese', expiry: addDays(TODAY, 2) },
      { name: 'Rice', expiry: addDays(TODAY, 90) },
    ]);
    const card = todayCard(data, NOW);
    expect(card.title).toBe('Fridge: 2 expiring soon');
    expect(card.lines).toEqual(['Milk: expires today', 'Cheese: expires in 2 days']);
    expect(card.action).toEqual({ label: 'Open Fridge', route: 'fridge' });
  });

  it('says when nothing is due, offers Scan item, and mentions the offline queue', () => {
    const data = addItem(withItems([{ name: 'Rice', expiry: addDays(TODAY, 90) }]), { barcode: '5449000000996', lookup: 'pending' }, NOW).data;
    const card = todayCard(data, NOW);
    expect(card.title).toBe('Fridge');
    expect(card.lines).toEqual(['Nothing expires in the next 2 days (2 items stored).', '1 scanned item still to look up.']);
    expect(card.action).toEqual({ label: 'Scan item', route: 'fridge/scan' });
    expect(todayCard(defaultData(), NOW).lines).toEqual(['Nothing stored yet.']);
  });

  it('caps the list at 4 lines plus a count', () => {
    const data = withItems(['A', 'B', 'C', 'D', 'E', 'F'].map((name) => ({ name, expiry: TODAY })));
    expect(todayCard(data, NOW).lines).toEqual(['A: expires today', 'B: expires today', 'C: expires today', 'D: expires today', '… and 2 more']);
  });
});

describe('validate', () => {
  const good = () => cacheProduct(withItems([{ name: 'Milk', expiry: TODAY, barcode: '5449000000996' }]), '5449000000996', { name: 'Cola', brand: 'X' }, NOW);

  it('accepts complete data', () => {
    expect(validate(good())).toEqual([]);
  });

  it.each([
    ['missing data', () => null, 'the fridge data is missing'],
    ['items not a list', (d) => ({ ...d, items: {} }), 'items must be a list'],
    ['no name', (d) => ({ ...d, items: [{ ...d.items[0], name: ' ' }] }), 'has no name'],
    ['bad place', (d) => ({ ...d, items: [{ ...d.items[0], location: 'garage' }] }), 'unknown place'],
    ['bad expiry', (d) => ({ ...d, items: [{ ...d.items[0], expiry: '2026-02-30' }] }), 'no valid expiry date'],
    ['bad added', (d) => ({ ...d, items: [{ ...d.items[0], added: 'yesterday' }] }), 'no valid added date'],
    ['bad barcode', (d) => ({ ...d, items: [{ ...d.items[0], barcode: '12ab' }] }), 'invalid barcode'],
    ['pending without barcode', (d) => ({ ...d, items: [{ ...d.items[0], barcode: null, lookup: 'pending' }] }), 'without a barcode'],
    ['duplicate id', (d) => ({ ...d, items: [d.items[0], { ...d.items[0] }] }), 'repeats the id'],
    ['quantity not text', (d) => ({ ...d, items: [{ ...d.items[0], quantity: 2 }] }), 'quantity must be text'],
    ['waste', (d) => ({ ...d, waste: { used: -1, thrown: 0 } }), 'waste must count'],
    ['products', (d) => ({ ...d, products: { 'x1': { name: 'a' } } }), 'is not a barcode'],
  ])('reports %s', (_label, mutate, text) => {
    const problems = validate(mutate(good()));
    expect(problems.join(' | ')).toContain(text);
  });
});

describe('Open Food Facts mapping (mocked)', () => {
  it('builds the v2 product URL with the fields and the app name', () => {
    const url = new URL(productUrl('5449000000996', '0.8.0'));
    expect(url.href.startsWith(`${OFF_PRODUCT_URL}5449000000996?`)).toBe(true);
    expect(url.origin).toBe('https://world.openfoodfacts.org');
    expect(url.searchParams.get('fields').split(',')).toEqual(expect.arrayContaining(['product_name', 'brands', 'product_name_bg']));
    expect(url.searchParams.get('app_name')).toBe('TheHub');
    expect(url.searchParams.get('app_version')).toBe('0.8.0');
  });

  it('maps a found product: name, first brand, English and Bulgarian names (text only)', () => {
    const r = mapResponse(200, { status: 1, code: '1', product: { product_name: ' Halfvolle melk ', brands: 'Campina, FrieslandCampina', product_name_en: 'Semi-skimmed milk', product_name_bg: 'Мляко', image_url: 'http://x' } });
    expect(r).toEqual({ status: 'found', product: { name: 'Halfvolle melk', brand: 'Campina', nameEn: 'Semi-skimmed milk', nameBg: 'Мляко' } });
    expect(mapProduct({ generic_name: 'Rice' })).toEqual({ name: 'Rice', brand: '', nameEn: '', nameBg: '' });
  });

  it('maps not found (404, or status 0, or a product without a name or brand)', () => {
    expect(mapResponse(404, { status: 0, status_verbose: 'product not found' })).toEqual({ status: 'not-found' });
    expect(mapResponse(200, { status: 0 })).toEqual({ status: 'not-found' });
    expect(mapResponse(200, { status: 1, product: {} })).toEqual({ status: 'not-found' });
  });

  it('maps errors (server trouble, rate limit, unreadable answers)', () => {
    expect(mapResponse(500, null).status).toBe('error');
    expect(mapResponse(429, {}).status).toBe('error');
    expect(mapResponse(200, null).status).toBe('error');
    expect(mapResponse(200, { status: 'weird' }).status).toBe('error');
  });

  it('lookupProduct: found, not found and error with a mocked fetch', async () => {
    const found = vi.fn(async () => okJson({ status: 1, product: { product_name: 'Cola', brands: 'Coca-Cola' } }));
    expect(await lookupProduct('5449000000996', { fetch: found, online: true, appVersion: '0.8.0' })).toEqual({ status: 'found', product: { name: 'Cola', brand: 'Coca-Cola', nameEn: '', nameBg: '' } });
    const [url, init] = found.mock.calls[0];
    expect(url).toContain('/api/v2/product/5449000000996?');
    expect(init).toMatchObject({ method: 'GET', credentials: 'omit' });
    expect(Object.keys(init.headers)).toEqual(['Accept']); // a CORS-safe request: no custom headers

    const missing = vi.fn(async () => okJson({ status: 0 }, 404));
    expect(await lookupProduct('96385074', { fetch: missing, online: true })).toEqual({ status: 'not-found' });

    const down = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await lookupProduct('96385074', { fetch: down, online: true })).toEqual({ status: 'error', message: 'Failed to fetch' });

    const badJson = vi.fn(async () => ({ status: 502, json: async () => { throw new SyntaxError('x'); } }));
    expect((await lookupProduct('96385074', { fetch: badJson, online: true })).status).toBe('error');
  });

  it('lookupProduct does not try when the phone is offline, and times out', async () => {
    const f = vi.fn();
    expect(await lookupProduct('96385074', { fetch: f, online: false })).toEqual({ status: 'error', message: 'offline' });
    expect(f).not.toHaveBeenCalled();

    const hang = vi.fn((url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))));
    expect(await lookupProduct('96385074', { fetch: hang, online: true, timeoutMs: 10 })).toEqual({ status: 'error', message: 'timed out' });
  });
});

describe('offline scans: queued, then resolved later', () => {
  const scannedOffline = () => {
    let data = addItem(defaultData(), { name: '', barcode: '5449000000996', lookup: 'pending', expiry: TODAY }, NOW).data;
    data = addItem(data, { name: 'My own name', barcode: '5449000000996', lookup: 'pending' }, NOW).data;
    data = addItem(data, { name: '', barcode: '96385074', lookup: 'pending' }, NOW).data;
    data = addItem(data, { name: 'Bread' }, NOW).data;
    return data;
  };

  it('keeps the queue while still offline (an error stops the run)', async () => {
    const data = scannedOffline();
    const lookup = vi.fn(async () => ({ status: 'error', message: 'offline' }));
    const r = await resolvePending(data, lookup, { now: NOW });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ resolved: 0, found: 0, remaining: 3 });
    expect(r.data).toBe(data);
  });

  it('fills stand-in names and empty brands once online; a typed name is kept; unknown codes stop waiting', async () => {
    const data = scannedOffline();
    const lookup = vi.fn(async (code) =>
      code === '5449000000996' ? { status: 'found', product: { name: 'Cola', brand: 'Coca-Cola', nameEn: 'Cola', nameBg: 'Кола' } } : { status: 'not-found' },
    );
    const r = await resolvePending(data, lookup, { now: NOW });
    expect(lookup.mock.calls.map((c) => c[0])).toEqual(['5449000000996', '96385074']); // one request per barcode
    expect(r).toMatchObject({ resolved: 2, found: 1, remaining: 0 });
    const [a, b, c, d] = r.data.items;
    expect(a).toMatchObject({ name: 'Cola', brand: 'Coca-Cola', nameAuto: false, lookup: null, expiry: TODAY });
    expect(b).toMatchObject({ name: 'My own name', brand: 'Coca-Cola', lookup: null });
    expect(c).toMatchObject({ name: 'Barcode 96385074', nameAuto: true, lookup: null });
    expect(d.name).toBe('Bread');
    expect(r.data.products['5449000000996']).toMatchObject({ name: 'Cola', nameBg: 'Кола' });
    expect(pendingItems(r.data)).toEqual([]);
    expect(validate(r.data)).toEqual([]);
  });

  it('looks up at most `max` barcodes per run', async () => {
    const lookup = vi.fn(async () => ({ status: 'not-found' }));
    const r = await resolvePending(scannedOffline(), lookup, { max: 1 });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(r.remaining).toBe(1);
  });
});

describe('the Bulgarian word offered', () => {
  it('uses the English product name when there is one, else the item name', () => {
    const item = { name: 'Halfvolle melk' };
    expect(bulgarianOffer(item, { nameEn: 'Milk' }, ' мляко ')).toEqual({ bg: 'мляко', en: 'Milk', topic: 'food' });
    expect(bulgarianOffer(item, null, '')).toEqual({ bg: '', en: 'Halfvolle melk', topic: 'food' });
  });
});

describe('isCalendarDate', () => {
  it('accepts real dates only', () => {
    expect(isCalendarDate('2026-10-18')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('18-10-2026')).toBe(false);
    expect(isCalendarDate(null)).toBe(false);
  });
});
