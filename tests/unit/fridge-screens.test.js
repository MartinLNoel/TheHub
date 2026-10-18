// Fridge screens in jsdom, the core's hub.offer, the scanner loop (camera and detector faked) and
// Settings → Diagnostics. fetch is always mocked: no test reaches Open Food Facts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fridge from '../../src/modules/fridge/index.js';
import { addItem, cacheProduct, defaultData } from '../../src/modules/fridge/data.js';
import { addDays, localDate } from '../../src/core/dates.js';
import { resetScreenState } from '../../src/modules/fridge/screens.js';
import { cameraProblem, createDetector, nativeFormats, startScanner } from '../../src/modules/fridge/scanner.js';
import { NO_HUB, createHub } from '../../src/core/hub.js';
import { checkModule, createRegistry } from '../../src/core/registry.js';
import { barcodeSupportLine, cameraLine } from '../../src/core/diagnostics.js';

const flush = async (n = 5) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

function mountRoute(route, data, { params = '', hub = NO_HUB, readOnly = false } = {}) {
  const root = document.createElement('main');
  document.body.append(root);
  const saved = [];
  const ctx = {
    root,
    data,
    readOnly,
    params,
    hub,
    settings: {},
    save: vi.fn(async (d) => {
      saved.push(d);
    }),
    navigate: vi.fn(),
  };
  fridge.routes[route](ctx);
  return { root, ctx, saved };
}

const $ = (root, id) => root.querySelector(`[data-testid="${id}"]`);
function type(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}
const json = (body, status = 200) => ({ status, ok: status < 300, json: async () => body });

beforeEach(() => {
  resetScreenState();
  document.body.replaceChildren();
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('unexpected network call');
  }));
});
afterEach(() => {
  resetScreenState();
  vi.unstubAllGlobals();
});

describe('hub.offer (core)', () => {
  const target = (accept) => ({
    id: 'bulgarian',
    name: 'Bulgarian',
    icon: 'B',
    schemaVersion: 1,
    migrations: {},
    defaultData: () => ({ offered: [] }),
    validate: (d) => (Array.isArray(d?.offered) ? [] : ['offered must be a list']),
    routes: { '': () => {} },
    accept,
  });
  // A Part-7-like acceptor: adds the word, ignores a duplicate.
  const addUnique = (item, data) => (data.offered.some((o) => o.bg === item.bg) ? null : { ...data, offered: [...data.offered, item] });

  it('is ignored when no module with that id is installed (Part 8 before Part 7)', async () => {
    const save = vi.fn();
    const hub = createHub({ registry: createRegistry([]), state: {}, save });
    expect(hub.accepts('bulgarian')).toBe(false);
    expect(await hub.offer('bulgarian', { bg: 'мляко', en: 'Milk', topic: 'food' })).toEqual({ accepted: false, reason: 'no-module' });
    expect(save).not.toHaveBeenCalled();
  });

  it('is ignored by a module without accept, or whose data is read-only', async () => {
    const plain = { ...target(), accept: undefined };
    const hub = createHub({ registry: createRegistry([plain]), state: { bulgarian: { data: { offered: [] } } }, save: vi.fn() });
    expect(await hub.offer('bulgarian', { bg: 'x' })).toEqual({ accepted: false, reason: 'not-accepting' });
    const ro = createHub({ registry: createRegistry([target(addUnique)]), state: { bulgarian: { data: { offered: [] }, readOnly: true } }, save: vi.fn() });
    expect(ro.accepts('bulgarian')).toBe(false);
    expect((await ro.offer('bulgarian', { bg: 'x' })).accepted).toBe(false);
  });

  it('saves what the target accepts, updates the live state, and passes copies', async () => {
    const save = vi.fn(async () => {});
    const state = { bulgarian: { data: { offered: [] } } };
    const mod = target(addUnique);
    const hub = createHub({ registry: createRegistry([mod]), state, save });
    const item = { bg: 'мляко', en: 'Milk', topic: 'food' };
    expect(await hub.offer('bulgarian', item)).toEqual({ accepted: true });
    expect(save).toHaveBeenCalledWith(mod, { offered: [item] });
    expect(state.bulgarian.data).toEqual({ offered: [item] });
    expect(state.bulgarian.data.offered[0]).not.toBe(item);
    // The same word again: declined, nothing saved.
    expect(await hub.offer('bulgarian', item)).toEqual({ accepted: false, reason: 'declined' });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('never throws: a failing accept, invalid result or failing save is reported', async () => {
    const boom = target(() => {
      throw new Error('boom');
    });
    const state = { bulgarian: { data: { offered: [] } } };
    expect(await createHub({ registry: createRegistry([boom]), state, save: vi.fn() }).offer('bulgarian', {})).toEqual({ accepted: false, reason: 'error', message: 'boom' });
    const bad = target(() => ({ offered: 'no' }));
    expect((await createHub({ registry: createRegistry([bad]), state, save: vi.fn() }).offer('bulgarian', {})).reason).toBe('invalid');
    const failing = createHub({ registry: createRegistry([target(addUnique)]), state, save: vi.fn(async () => { throw new Error('disk full'); }) });
    expect(await failing.offer('bulgarian', { bg: 'a' })).toEqual({ accepted: false, reason: 'error', message: 'disk full' });
    expect(state.bulgarian.data).toEqual({ offered: [] });
  });

  it('the registry checks accept is a function', () => {
    expect(checkModule(target('nope'))).toContain('accept must be a function (or left out)');
    expect(checkModule(target(addUnique))).toEqual([]);
  });
});

describe('add by hand', () => {
  it('saves an item and goes back to the Fridge (no Bulgarian prompt while no module accepts)', async () => {
    const { root, ctx, saved } = mountRoute('add', defaultData());
    type($(root, 'fridge-name'), 'Milk');
    $(root, 'fridge-place-fridge').click();
    type($(root, 'fridge-qty'), '1 L');
    $(root, 'fridge-exp-plus-3').click();
    $(root, 'fridge-save').click();
    await flush();
    expect(saved).toHaveLength(1);
    expect(saved[0].items[0]).toMatchObject({ name: 'Milk', quantity: '1 L', location: 'fridge', barcode: null, lookup: null });
    expect(saved[0].items[0].expiry).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ctx.navigate).toHaveBeenCalledWith('#/fridge');
    expect($(root, 'fridge-bg-offer')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses an item without a name', async () => {
    const { root, saved } = mountRoute('add', defaultData());
    $(root, 'fridge-save').click();
    await flush();
    expect(saved).toEqual([]);
    expect($(root, 'fridge-form-problem').textContent).toBe('Give it a name.');
  });

  it('offers the name to the Bulgarian module when one accepts: hub.offer gets the right item', async () => {
    const hub = { accepts: vi.fn(() => true), offer: vi.fn(async () => ({ accepted: true })) };
    const { root, ctx } = mountRoute('add', defaultData(), { hub });
    type($(root, 'fridge-name'), 'Milk');
    $(root, 'fridge-save').click();
    await flush();
    expect(hub.accepts).toHaveBeenCalledWith('bulgarian');
    expect($(root, 'fridge-bg-offer')).not.toBeNull();
    expect($(root, 'fridge-bg-en').value).toBe('Milk');
    expect($(root, 'fridge-bg-add').disabled).toBe(true); // Martin types (confirms) the word first
    type($(root, 'fridge-bg-word'), ' мляко ');
    expect($(root, 'fridge-bg-add').disabled).toBe(false);
    $(root, 'fridge-bg-add').click();
    await flush();
    expect(hub.offer).toHaveBeenCalledTimes(1);
    expect(hub.offer).toHaveBeenCalledWith('bulgarian', { bg: 'мляко', en: 'Milk', topic: 'food' });
    expect(ctx.navigate).toHaveBeenCalledWith('#/fridge');
  });

  it('"Not now" offers nothing', async () => {
    const hub = { accepts: () => true, offer: vi.fn() };
    const { root, ctx } = mountRoute('add', defaultData(), { hub });
    type($(root, 'fridge-name'), 'Milk');
    $(root, 'fridge-save').click();
    await flush();
    $(root, 'fridge-bg-skip').click();
    expect(hub.offer).not.toHaveBeenCalled();
    expect(ctx.navigate).toHaveBeenCalledWith('#/fridge');
  });
});

describe('add a scanned barcode', () => {
  it('prefills name and brand from Open Food Facts, caches the product, and prefills the Bulgarian name', async () => {
    fetch.mockImplementation(async () => json({ status: 1, product: { product_name: 'Halfvolle melk', product_name_en: 'Milk', product_name_bg: 'Прясно мляко', brands: 'Campina' } }));
    const hub = { accepts: () => true, offer: vi.fn(async () => ({ accepted: true })) };
    const { root, saved } = mountRoute('add/*', defaultData(), { params: '8712345678906', hub }); // made up, valid check digit
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toMatch(/^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/\d{13}\?/);
    expect($(root, 'fridge-name').value).toBe('Halfvolle melk');
    expect($(root, 'fridge-brand').value).toBe('Campina');
    expect($(root, 'fridge-lookup').textContent).toContain('Found on Open Food Facts');
    $(root, 'fridge-save').click();
    await flush();
    const data = saved[0];
    const code = data.items[0].barcode;
    expect(data.items[0]).toMatchObject({ name: 'Halfvolle melk', brand: 'Campina', lookup: null });
    expect(data.products[code]).toMatchObject({ name: 'Halfvolle melk', nameEn: 'Milk', nameBg: 'Прясно мляко' });
    expect($(root, 'fridge-bg-word').value).toBe('Прясно мляко');
    expect($(root, 'fridge-bg-en').value).toBe('Milk');
    $(root, 'fridge-bg-add').click();
    await flush();
    expect(hub.offer).toHaveBeenCalledWith('bulgarian', { bg: 'Прясно мляко', en: 'Milk', topic: 'food' });
  });

  it('a product scanned before is filled in from the cache, with no network', async () => {
    const data = cacheProduct(defaultData(), '5449000000996', { name: 'Cola', brand: 'Coca-Cola' });
    const { root } = mountRoute('add/*', data, { params: '5449000000996' });
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect($(root, 'fridge-name').value).toBe('Cola');
    expect($(root, 'fridge-lookup').textContent).toContain('earlier lookup');
  });

  it('not found: Martin types the name', async () => {
    fetch.mockImplementation(async () => json({ status: 0, status_verbose: 'product not found' }, 404));
    const { root, saved } = mountRoute('add/*', defaultData(), { params: '5449000000996' });
    await flush();
    expect($(root, 'fridge-lookup').textContent).toContain('Not on Open Food Facts');
    $(root, 'fridge-save').click();
    await flush();
    expect(saved).toEqual([]); // a name is needed
    type($(root, 'fridge-name'), 'Cola zero');
    $(root, 'fridge-save').click();
    await flush();
    expect(saved[0].items[0]).toMatchObject({ name: 'Cola zero', barcode: '5449000000996', lookup: null });
    expect(saved[0].products).toEqual({});
  });

  it('offline: the scan is saved with its barcode, queued, and resolved on a later visit', async () => {
    fetch.mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });
    const { root, saved } = mountRoute('add/*', defaultData(), { params: '5449000000996' });
    await flush();
    expect($(root, 'fridge-lookup').textContent).toContain('looks the barcode up later');
    $(root, 'fridge-exp-plus-0').click();
    $(root, 'fridge-save').click(); // no name needed
    await flush();
    const queued = saved[0];
    expect(queued.items[0]).toMatchObject({ name: 'Barcode 5449000000996', nameAuto: true, lookup: 'pending', barcode: '5449000000996' });

    // Back online: the Fridge home looks the queued barcode up and fills the name in.
    fetch.mockImplementation(async () => json({ status: 1, product: { product_name: 'Cola', brands: 'Coca-Cola' } }));
    resetScreenState();
    const home = mountRoute('', queued);
    expect($(home.root, 'fridge-pending').textContent).toContain('1 scanned item still to look up');
    await flush(10);
    expect(home.saved).toHaveLength(1);
    expect(home.saved[0].items[0]).toMatchObject({ name: 'Cola', brand: 'Coca-Cola', lookup: null, nameAuto: false });
    expect($(home.root, 'fridge-flash').textContent).toBe('Looked up 1 barcode.');
    expect($(home.root, 'fridge-pending')).toBeNull();
  });

  it('a bad code in the address is refused', () => {
    const { root } = mountRoute('add/*', defaultData(), { params: '12345' });
    expect($(root, 'fridge-bad-code')).not.toBeNull();
  });
});

describe('home and item screens', () => {
  const NOW = new Date();
  const data = () => {
    let d = defaultData();
    d = addItem(d, { name: 'Peas', location: 'freezer', expiry: null }, NOW).data;
    d = addItem(d, { name: '<img src=x onerror=alert(1)>', location: 'pantry' }, NOW).data;
    d = addItem(d, { name: 'Milk', location: 'fridge', expiry: addDays(localDate(NOW), -2) }, NOW).data;
    return d;
  };

  it('lists items in expiry order, filters by place, and shows text as text', () => {
    const { root } = mountRoute('', data());
    const names = [...root.querySelectorAll('[data-testid="fridge-item"] .fridge-item__name')].map((n) => n.textContent);
    expect(names[0]).toBe('Milk');
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('[data-testid="fridge-item"]').dataset.expiry).toBe('expired');
    $(root, 'fridge-filter-freezer').click();
    expect([...root.querySelectorAll('.fridge-item__name')].map((n) => n.textContent)).toEqual(['Peas']);
    expect($(root, 'fridge-waste').textContent).toBe('Used up: 0 · Thrown away: 0');
  });

  it('marks an item used and thrown away (the waste count)', async () => {
    const d = data();
    const milk = d.items.find((i) => i.name === 'Milk');
    const a = mountRoute('item/*', d, { params: milk.id });
    $(a.root, 'fridge-used').click();
    await flush();
    expect(a.saved[0].waste).toEqual({ used: 1, thrown: 0 });
    expect(a.saved[0].items.some((i) => i.id === milk.id)).toBe(false);
    const peas = d.items.find((i) => i.name === 'Peas');
    const b = mountRoute('item/*', d, { params: peas.id });
    $(b.root, 'fridge-thrown').click();
    await flush();
    expect(b.saved[0].waste).toEqual({ used: 0, thrown: 1 });
  });

  it('edits an item', async () => {
    const d = data();
    const peas = d.items.find((i) => i.name === 'Peas');
    const { root, saved } = mountRoute('item/*', d, { params: peas.id });
    type($(root, 'fridge-name'), 'Garden peas');
    $(root, 'fridge-place-pantry').click();
    $(root, 'fridge-update').click();
    await flush();
    expect(saved[0].items.find((i) => i.id === peas.id)).toMatchObject({ name: 'Garden peas', location: 'pantry' });
  });

  it('read-only data cannot be changed', () => {
    const { root } = mountRoute('add', defaultData(), { readOnly: true });
    expect($(root, 'fridge-save').disabled).toBe(true);
  });

  it('an unknown item id says it is gone', () => {
    const { root } = mountRoute('item/*', data(), { params: 'nope' });
    expect($(root, 'fridge-item-gone')).not.toBeNull();
  });
});

describe('scanner', () => {
  const fakeVideo = () => {
    const video = document.createElement('video');
    document.body.append(video);
    Object.defineProperty(video, 'readyState', { value: 4 });
    video.play = vi.fn(async () => {});
    return video;
  };
  const fakeStream = () => {
    const track = { stop: vi.fn() };
    return { track, stream: { getTracks: () => [track] } };
  };

  it('asks for the back camera, reads a valid code once, ignores bad ones, and stops the camera', async () => {
    const video = fakeVideo();
    const { track, stream } = fakeStream();
    const mediaDevices = { getUserMedia: vi.fn(async () => stream) };
    const answers = [[], [{ rawValue: '5449000000995', format: 'ean_13' }], [{ rawValue: '5449000000996', format: 'ean_13' }]];
    const detect = vi.fn(async () => answers.shift() || []);
    const onCode = vi.fn();
    const onReady = vi.fn();
    startScanner({ video, onCode, onReady, mediaDevices, detectorFactory: async () => ({ kind: 'native', detect }), intervalMs: 1 });
    await vi.waitFor(() => expect(onCode).toHaveBeenCalled());
    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    expect(onReady).toHaveBeenCalledWith('native');
    expect(onCode).toHaveBeenCalledTimes(1);
    expect(onCode).toHaveBeenCalledWith('5449000000996');
    expect(track.stop).toHaveBeenCalled();
  });

  it('a refused camera is reported as a refusal, and nothing is read', async () => {
    const onProblem = vi.fn();
    const detect = vi.fn();
    startScanner({
      video: fakeVideo(),
      onCode: vi.fn(),
      onProblem,
      mediaDevices: { getUserMedia: async () => { throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }); } },
      detectorFactory: async () => ({ kind: 'native', detect }),
    });
    await vi.waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(onProblem.mock.calls[0][0].denied).toBe(true);
    expect(onProblem.mock.calls[0][0].message).toContain('Camera access was refused');
    expect(detect).not.toHaveBeenCalled();
  });

  it('stop() before the camera opens releases it at once', async () => {
    const { track, stream } = fakeStream();
    let open;
    const mediaDevices = { getUserMedia: () => new Promise((r) => (open = r)) };
    const stop = startScanner({ video: fakeVideo(), onCode: vi.fn(), mediaDevices, detectorFactory: async () => ({ kind: 'native', detect: vi.fn() }) });
    stop();
    open(stream);
    await flush();
    expect(track.stop).toHaveBeenCalled();
  });

  it('explains the other camera problems', () => {
    expect(cameraProblem({ name: 'NotFoundError' }).message).toContain('No camera');
    expect(cameraProblem({ name: 'NotReadableError' }).message).toContain('busy');
    expect(cameraProblem({ name: 'Unsupported' }).denied).toBe(false);
    expect(cameraProblem({ name: 'NotSupportedError' }).message).toContain('cannot open the camera');
  });

  it("uses the phone's own detector when it reads EAN-13", async () => {
    class FakeBD {
      static getSupportedFormats = async () => ['qr_code', 'ean_13', 'ean_8', 'upc_a'];
      constructor(opts) {
        this.opts = opts;
      }
      detect = async () => [];
    }
    expect(await nativeFormats({ BarcodeDetector: FakeBD })).toEqual(['qr_code', 'ean_13', 'ean_8', 'upc_a']);
    const d = await createDetector({ win: { BarcodeDetector: FakeBD } });
    expect(d.kind).toBe('native');
    expect(d.formats).toEqual(['ean_13', 'ean_8', 'upc_a']);
    expect(await nativeFormats({})).toBeNull();
  });

  it('the scan screen shows the refusal and keeps manual entry', async () => {
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: async () => { throw Object.assign(new Error('no'), { name: 'NotAllowedError' }); } } });
    const { root, ctx } = mountRoute('scan', defaultData());
    await vi.waitFor(() => expect($(root, 'scan-problem')).not.toBeNull());
    expect($(root, 'scan-problem').dataset.denied).toBe('true');
    type($(root, 'scan-code'), '5449000000995');
    $(root, 'scan-code-go').click();
    expect($(root, 'scan-code-problem').textContent).toContain('not a valid');
    type($(root, 'scan-code'), '5449000000996');
    $(root, 'scan-code-go').click();
    expect(ctx.navigate).toHaveBeenCalledWith('#/fridge/add/5449000000996');
    expect($(root, 'scan-manual').getAttribute('href')).toBe('#/fridge/add');
  });
});

describe('Settings → Diagnostics', () => {
  it('reports the BarcodeDetector formats, or that it is missing', async () => {
    expect(await barcodeSupportLine({ BarcodeDetector: Object.assign(function BD() {}, { getSupportedFormats: async () => ['ean_13', 'qr_code'] }) })).toBe('BarcodeDetector formats: ean_13, qr_code');
    expect(await barcodeSupportLine({})).toContain('not available');
    expect(cameraLine({ navigator: { mediaDevices: { getUserMedia() {} } } })).toContain('available');
    expect(cameraLine({ navigator: {} })).toContain('not available');
  });
});
