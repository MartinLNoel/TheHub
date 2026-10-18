// Fridge screens: home (#/fridge), scan (#/fridge/scan, the "Scan item" shortcut), add by hand
// (#/fridge/add), add a scanned code (#/fridge/add/<barcode>) and one item (#/fridge/item/<id>).
import { h, mount } from '../../core/dom.js';
import { addDays, localDate } from '../../core/dates.js';
import { NO_HUB } from '../../core/hub.js';
import { VERSION } from '../../version.js';
import { normalizeBarcode } from './barcode.js';
import {
  LOCATIONS,
  addItem,
  bulgarianOffer,
  cacheProduct,
  expiryLabel,
  expiryState,
  formatDate,
  pendingItems,
  removeItem,
  resolvePending,
  sortByExpiry,
  updateItem,
} from './data.js';
import { lookupProduct } from './off.js';
import { startScanner } from './scanner.js';

export const BULGARIAN = 'bulgarian';
const ATTRIBUTION = 'Product names from Open Food Facts (openfoodfacts.org), under the Open Database License.';

// Screen state kept between renders (reset by tests).
let flash = '';
let filter = 'all';
let resolving = false;
let stopScanner = null;

export function resetScreenState() {
  flash = '';
  filter = 'all';
  resolving = false;
  stopScanner?.();
  stopScanner = null;
}

const placeName = (id) => LOCATIONS.find((l) => l.id === id)?.name || id;
const placeIcon = (id) => LOCATIONS.find((l) => l.id === id)?.icon || '';
const lookup = (code) => lookupProduct(code, { appVersion: VERSION });

function takeFlash() {
  const text = flash;
  flash = '';
  return text ? h('p', { class: 'status fridge-flash', role: 'status', 'data-testid': 'fridge-flash' }, text) : null;
}

function readOnlyNote(readOnly) {
  return readOnly ? h('p', { class: 'card card--warn' }, 'Read-only until the app updates: nothing can be saved.') : null;
}

function backLink() {
  return h('a', { class: 'btn', href: '#/fridge', 'data-testid': 'fridge-back' }, '← Fridge');
}

// ---------------------------------------------------------------------------------------------- home

function itemRow(item, now) {
  const state = expiryState(item, now);
  const meta = [item.brand, item.quantity, `${placeIcon(item.location)} ${placeName(item.location)}`].filter(Boolean).join(' · ');
  return h(
    'li',
    {},
    h(
      'a',
      { class: 'fridge-item', href: `#/fridge/item/${item.id}`, 'data-testid': 'fridge-item', 'data-expiry': state },
      h('span', { class: 'fridge-item__main' }, h('strong', { class: 'fridge-item__name' }, item.name), h('span', { class: 'fridge-item__meta' }, meta)),
      h('span', { class: `fridge-exp fridge-exp--${state}`, 'data-testid': 'fridge-item-expiry' }, item.lookup === 'pending' ? `${expiryLabel(item, now)} · lookup waiting` : expiryLabel(item, now)),
    ),
  );
}

export function renderHome(ctx) {
  const { root, readOnly } = ctx;
  const data = ctx.data;
  const now = new Date();
  const pending = pendingItems(data);
  const shown = sortByExpiry(filter === 'all' ? data.items : data.items.filter((it) => it.location === filter));
  const lookupStatus = h('p', { class: 'status', role: 'status', 'aria-live': 'polite', 'data-testid': 'fridge-lookup-status' });

  const runLookup = async (auto) => {
    if (resolving || readOnly) return;
    resolving = true;
    if (!auto) lookupStatus.textContent = 'Looking up…';
    try {
      const result = await resolvePending(data, lookup);
      // Only apply when this screen is still showing, so a newer save is never overwritten.
      if (!page.isConnected) return;
      if (result.resolved > 0) {
        await ctx.save(result.data);
        flash = `Looked up ${result.resolved} barcode${result.resolved === 1 ? '' : 's'}${result.found < result.resolved ? ` (${result.resolved - result.found} not on Open Food Facts)` : ''}.`;
        renderHome({ ...ctx, data: result.data });
      } else if (!auto) {
        lookupStatus.textContent = 'Still offline (or Open Food Facts did not answer). TheHub tries again later.';
      }
    } catch (err) {
      if (page.isConnected) lookupStatus.textContent = `Could not save the lookups: ${err.message}`;
    } finally {
      resolving = false;
    }
  };

  const counts = Object.fromEntries(LOCATIONS.map((l) => [l.id, data.items.filter((it) => it.location === l.id).length]));
  const filters = [{ id: 'all', name: 'All', count: data.items.length }, ...LOCATIONS.map((l) => ({ id: l.id, name: l.name, count: counts[l.id] }))];
  const filterButtons = filters.map((f) =>
    h(
      'button',
      {
        type: 'button',
        class: 'seg',
        'aria-pressed': String(filter === f.id),
        'data-testid': `fridge-filter-${f.id}`,
        onclick: () => {
          filter = f.id;
          renderHome(ctx);
        },
      },
      `${f.name} (${f.count})`,
    ),
  );

  const page = h(
    'div',
    { class: 'stack fridge', 'data-testid': 'fridge-home' },
    takeFlash(),
    readOnlyNote(readOnly),
    h(
      'div',
      { class: 'row' },
      h('a', { class: 'btn btn--primary', href: '#/fridge/scan', 'data-testid': 'fridge-scan' }, '📷 Scan item'),
      h('a', { class: 'btn', href: '#/fridge/add', 'data-testid': 'fridge-add' }, '＋ Add by hand'),
    ),
    pending.length
      ? h(
          'section',
          { class: 'card card--warn', 'data-testid': 'fridge-pending' },
          h('p', {}, `${pending.length} scanned item${pending.length === 1 ? '' : 's'} still to look up (scanned while offline).`),
          h('button', { type: 'button', class: 'btn', 'data-testid': 'fridge-lookup-now', disabled: readOnly, onclick: () => runLookup(false) }, 'Look up now'),
          lookupStatus,
        )
      : null,
    h('div', { class: 'segmented', role: 'group', 'aria-label': 'Place' }, filterButtons),
    shown.length
      ? h('ul', { class: 'fridge-list', 'data-testid': 'fridge-list' }, shown.map((it) => itemRow(it, now)))
      : h('p', { class: 'muted', 'data-testid': 'fridge-empty' }, data.items.length ? 'Nothing stored here.' : 'Nothing here yet. Scan an item or add one by hand.'),
    h(
      'p',
      { class: 'muted', 'data-testid': 'fridge-waste' },
      `Used up: ${data.waste.used} · Thrown away: ${data.waste.thrown}`,
    ),
    h('p', { class: 'muted fridge-small' }, ATTRIBUTION),
  );
  mount(root, page);

  if (pending.length && globalThis.navigator?.onLine !== false) runLookup(true);
}

// ---------------------------------------------------------------------------------------------- form

/** The item form: name, brand, place, quantity, expiry. Returns { el, values(), setIfEmpty(field, v) }. */
function itemForm(initial = {}) {
  const name = h('input', { type: 'text', autocomplete: 'off', 'data-testid': 'fridge-name', placeholder: 'e.g. Volle melk', value: initial.name || '' });
  const brand = h('input', { type: 'text', autocomplete: 'off', 'data-testid': 'fridge-brand', value: initial.brand || '' });
  const quantity = h('input', { type: 'text', autocomplete: 'off', 'data-testid': 'fridge-qty', placeholder: 'e.g. 1 L, 500 g, 6', value: initial.quantity || '' });
  const expiry = h('input', { type: 'date', 'data-testid': 'fridge-expiry', value: initial.expiry || '' });
  let place = initial.location || 'fridge';
  const placeButtons = LOCATIONS.map((l) =>
    h(
      'button',
      {
        type: 'button',
        class: 'seg',
        'aria-pressed': String(place === l.id),
        'data-testid': `fridge-place-${l.id}`,
        onclick: () => {
          place = l.id;
          placeButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(LOCATIONS[i].id === place)));
        },
      },
      `${l.icon} ${l.name}`,
    ),
  );
  const chips = [
    ['Today', 0],
    ['+3 days', 3],
    ['+1 week', 7],
    ['+1 month', 30],
  ].map(([label, days]) =>
    h('button', { type: 'button', class: 'btn fridge-chip', 'data-testid': `fridge-exp-plus-${days}`, onclick: () => (expiry.value = addDays(localDate(), days)) }, label),
  );
  chips.push(h('button', { type: 'button', class: 'btn fridge-chip', 'data-testid': 'fridge-exp-none', onclick: () => (expiry.value = '') }, 'No date'));

  const el = h(
    'div',
    { class: 'fridge-form' },
    h('label', { class: 'field' }, 'Name', name),
    h('label', { class: 'field' }, 'Brand (optional)', brand),
    h('p', { class: 'field' }, 'Where'),
    h('div', { class: 'segmented', role: 'group', 'aria-label': 'Where' }, placeButtons),
    h('label', { class: 'field' }, 'Quantity (optional)', quantity),
    h('label', { class: 'field' }, 'Expiry date (from the pack)', expiry),
    h('div', { class: 'row fridge-chips' }, chips),
  );
  return {
    el,
    name,
    values: () => ({ name: name.value, brand: brand.value, location: place, quantity: quantity.value, expiry: expiry.value || null }),
    setIfEmpty(field, value) {
      const input = { name, brand }[field];
      if (input && !input.value.trim() && value) input.value = value;
    },
  };
}

/** After an item is added (or from its screen): offer its name to the Bulgarian module, if one accepts. */
function renderOffer(ctx, item, product, { after = `Added ${item.name}.` } = {}) {
  const hub = ctx.hub || NO_HUB;
  const suggestion = bulgarianOffer(item, product, product?.nameBg);
  const en = h('input', { type: 'text', 'data-testid': 'fridge-bg-en', value: suggestion.en });
  const bg = h('input', { type: 'text', lang: 'bg', autocomplete: 'off', 'data-testid': 'fridge-bg-word', placeholder: 'e.g. мляко', value: suggestion.bg });
  const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const add = h(
    'button',
    {
      type: 'button',
      class: 'btn btn--primary',
      'data-testid': 'fridge-bg-add',
      disabled: !suggestion.bg,
      onclick: async () => {
        add.disabled = true;
        const offered = { bg: bg.value.trim(), en: en.value.trim() || item.name, topic: suggestion.topic };
        const result = await hub.offer(BULGARIAN, offered);
        const lead = after ? `${after} ` : '';
        if (result.accepted) flash = `${lead}Bulgarian card added: ${offered.bg}.`;
        else if (result.reason === 'declined') flash = `${lead}${offered.bg} is already in your Bulgarian cards.`;
        else flash = `${lead}The Bulgarian card could not be added.`;
        ctx.navigate('#/fridge');
      },
    },
    'Add Bulgarian card',
  );
  bg.addEventListener('input', () => (add.disabled = !bg.value.trim()));
  mount(
    ctx.root,
    h(
      'div',
      { class: 'stack fridge' },
      after ? h('p', { class: 'status', 'data-testid': 'fridge-saved' }, after) : null,
      h(
        'section',
        { class: 'card', 'data-testid': 'fridge-bg-offer' },
        h('h2', {}, '🇧🇬 Learn its Bulgarian name?'),
        h('p', { class: 'muted' }, product?.nameBg ? 'Open Food Facts has a Bulgarian name: check it before adding.' : 'Type the Bulgarian word (check it in your book or with Claude).'),
        h('label', { class: 'field' }, 'English', en),
        h('label', { class: 'field' }, 'Bulgarian', bg),
        h(
          'div',
          { class: 'row' },
          add,
          h(
            'button',
            {
              type: 'button',
              class: 'btn',
              'data-testid': 'fridge-bg-skip',
              onclick: () => {
                flash = after;
                ctx.navigate('#/fridge');
              },
            },
            'Not now',
          ),
        ),
        status,
      ),
    ),
  );
}

// ---------------------------------------------------------------------------------------------- add

export function renderAdd(ctx) {
  const { root, readOnly } = ctx;
  let data = ctx.data;
  const raw = ctx.params || '';
  const barcode = raw ? normalizeBarcode(raw) : null;
  if (raw && !barcode) {
    mount(
      root,
      h(
        'div',
        { class: 'stack fridge' },
        h('section', { class: 'card card--warn', 'data-testid': 'fridge-bad-code' }, h('p', {}, `"${raw}" is not a valid EAN or UPC barcode. Check the digits, or add the item by hand.`)),
        h('div', { class: 'row' }, h('a', { class: 'btn btn--primary', href: '#/fridge/scan' }, 'Scan again'), h('a', { class: 'btn', href: '#/fridge/add' }, 'Add by hand'), backLink()),
      ),
    );
    return;
  }

  const form = itemForm();
  const lookupLine = h('p', { class: 'status', role: 'status', 'aria-live': 'polite', 'data-testid': 'fridge-lookup' });
  const problem = h('p', { class: 'status status--bad', role: 'alert', 'data-testid': 'fridge-form-problem' });
  // 'none' (no barcode) | 'loading' | 'found' | 'not-found' | 'error'
  let lookupState = barcode ? 'loading' : 'none';
  let product = null;

  const save = h(
    'button',
    {
      type: 'button',
      class: 'btn btn--primary',
      'data-testid': 'fridge-save',
      disabled: readOnly,
      onclick: async () => {
        const values = form.values();
        const waiting = lookupState === 'loading' || lookupState === 'error';
        if (!values.name.trim() && !(barcode && waiting)) {
          problem.textContent = 'Give it a name.';
          form.name.focus();
          return;
        }
        save.disabled = true;
        let next = data;
        if (barcode && product && lookupState === 'found' && !data.products[barcode]) next = cacheProduct(next, barcode, product);
        const added = addItem(next, { ...values, barcode, lookup: barcode && waiting ? 'pending' : null });
        try {
          await ctx.save(added.data);
        } catch (err) {
          problem.textContent = `Not saved: ${err.message}`;
          save.disabled = false;
          return;
        }
        data = added.data;
        const after = `Added ${added.item.name}.${added.item.lookup === 'pending' ? ' Its barcode is looked up when you are online.' : ''}`;
        if ((ctx.hub || NO_HUB).accepts(BULGARIAN)) renderOffer({ ...ctx, data }, added.item, product, { after });
        else {
          flash = after;
          ctx.navigate('#/fridge');
        }
      },
    },
    'Save',
  );

  mount(
    root,
    h(
      'div',
      { class: 'stack fridge', 'data-testid': 'fridge-add-screen' },
      readOnlyNote(readOnly),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, barcode ? 'Add a scanned item' : 'Add an item'),
        barcode ? h('p', { class: 'muted', 'data-testid': 'fridge-barcode' }, `Barcode ${barcode}`) : null,
        lookupLine,
        form.el,
        problem,
        h('div', { class: 'row' }, save, backLink()),
      ),
      barcode ? h('p', { class: 'muted fridge-small' }, ATTRIBUTION) : null,
    ),
  );
  if (!barcode) {
    form.name.focus();
    return;
  }

  const known = data.products[barcode];
  const apply = (result) => {
    if (!lookupLine.isConnected) return; // Martin already saved or left the screen
    lookupState = result.status;
    if (result.status === 'found') {
      product = result.product;
      form.setIfEmpty('name', product.name);
      form.setIfEmpty('brand', product.brand);
      lookupLine.textContent = known ? 'Known product: filled in from an earlier lookup.' : 'Found on Open Food Facts: check the name and set the expiry date.';
    } else if (result.status === 'not-found') {
      lookupLine.textContent = 'Not on Open Food Facts: type the name.';
      form.name.focus();
    } else {
      lookupLine.textContent = 'Offline (or Open Food Facts did not answer): save it now, with or without a name, and TheHub looks the barcode up later.';
    }
  };
  if (known) apply({ status: 'found', product: known });
  else {
    lookupLine.textContent = 'Looking it up on Open Food Facts…';
    lookup(barcode).then(apply);
  }
}

// ---------------------------------------------------------------------------------------------- scan

export function renderScan(ctx) {
  const { root, readOnly, navigate } = ctx;
  stopScanner?.();
  const video = h('video', { class: 'fridge-video', muted: true, playsinline: true, autoplay: true, 'data-testid': 'scan-video' });
  video.muted = true;
  const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite', 'data-testid': 'scan-status' }, 'Starting the camera…');
  const kind = h('p', { class: 'muted fridge-small', 'data-testid': 'scan-kind' });
  const codeInput = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', 'data-testid': 'scan-code', placeholder: '13 digits under the bars' });
  const codeProblem = h('p', { class: 'status status--bad', role: 'alert', 'data-testid': 'scan-code-problem' });
  const camera = h('div', { class: 'fridge-camera' }, video, h('div', { class: 'fridge-camera__guide', 'aria-hidden': 'true' }));

  const lookUpTyped = () => {
    const code = normalizeBarcode(codeInput.value);
    if (!code) {
      codeProblem.textContent = 'That is not a valid EAN or UPC barcode: check the digits.';
      return;
    }
    navigate(`#/fridge/add/${code}`);
  };

  mount(
    root,
    h(
      'div',
      { class: 'stack fridge', 'data-testid': 'fridge-scan-screen' },
      readOnlyNote(readOnly),
      h('section', { class: 'card' }, h('h2', {}, '📷 Scan a barcode'), camera, status, kind),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, 'Or type the barcode'),
        h('label', { class: 'field' }, 'Barcode', codeInput),
        codeProblem,
        h(
          'div',
          { class: 'row' },
          h('button', { type: 'button', class: 'btn btn--primary', 'data-testid': 'scan-code-go', onclick: lookUpTyped }, 'Look up'),
          h('a', { class: 'btn', href: '#/fridge/add', 'data-testid': 'scan-manual' }, 'Add without a barcode'),
          backLink(),
        ),
      ),
    ),
  );
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') lookUpTyped();
  });

  stopScanner = startScanner({
    video,
    onReady: (k) => {
      status.textContent = 'Point the camera at the barcode.';
      kind.textContent = k === 'native' ? "Scanner: the phone's own barcode reader." : "Scanner: TheHub's built-in reader (zxing).";
    },
    onProblem: ({ denied, message }) => {
      camera.hidden = true;
      status.textContent = message;
      status.className = 'status status--bad';
      status.dataset.denied = String(denied);
      status.setAttribute('data-testid', 'scan-problem');
      codeInput.focus();
    },
    onCode: (code) => {
      status.textContent = `Read ${code}.`;
      navigator.vibrate?.(80);
      navigate(`#/fridge/add/${code}`);
    },
  });
}

// ---------------------------------------------------------------------------------------------- item

export function renderItem(ctx) {
  const { root, readOnly } = ctx;
  let data = ctx.data;
  const item = data.items.find((it) => it.id === ctx.params);
  if (!item) {
    mount(root, h('div', { class: 'stack fridge' }, h('section', { class: 'card', 'data-testid': 'fridge-item-gone' }, h('p', {}, 'This item is no longer in the fridge.')), backLink()));
    return;
  }
  const now = new Date();
  const form = itemForm(item);
  const problem = h('p', { class: 'status status--bad', role: 'alert' });
  const hub = ctx.hub || NO_HUB;

  const take = (outcome, text) =>
    h(
      'button',
      {
        type: 'button',
        class: outcome === 'thrown' ? 'btn btn--danger' : outcome === 'used' ? 'btn btn--primary' : 'btn',
        'data-testid': `fridge-${outcome}`,
        disabled: readOnly,
        onclick: async () => {
          const next = removeItem(data, item.id, outcome);
          try {
            await ctx.save(next);
          } catch (err) {
            problem.textContent = `Not saved: ${err.message}`;
            return;
          }
          flash = outcome === 'used' ? `${item.name}: used up.` : outcome === 'thrown' ? `${item.name}: thrown away.` : `${item.name} removed.`;
          ctx.navigate('#/fridge');
        },
      },
      text,
    );

  mount(
    root,
    h(
      'div',
      { class: 'stack fridge', 'data-testid': 'fridge-item-screen' },
      readOnlyNote(readOnly),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, item.name),
        h('p', { class: `fridge-exp fridge-exp--${expiryState(item, now)}` }, expiryLabel(item, now)),
        h('p', { class: 'muted' }, `Added ${formatDate(item.added)}${item.barcode ? ` · barcode ${item.barcode}` : ''}`),
        item.lookup === 'pending' ? h('p', { class: 'muted' }, 'Scanned while offline: its name is looked up when you are online.') : null,
        h('div', { class: 'row' }, take('used', '✓ Used it'), take('thrown', '🗑 Thrown away')),
      ),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, 'Change'),
        form.el,
        problem,
        h(
          'div',
          { class: 'row' },
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn--primary',
              'data-testid': 'fridge-update',
              disabled: readOnly,
              onclick: async () => {
                const values = form.values();
                if (!values.name.trim()) {
                  problem.textContent = 'Give it a name.';
                  return;
                }
                const next = updateItem(data, item.id, values);
                try {
                  await ctx.save(next);
                } catch (err) {
                  problem.textContent = `Not saved: ${err.message}`;
                  return;
                }
                data = next;
                flash = `${values.name.trim()}: saved.`;
                ctx.navigate('#/fridge');
              },
            },
            'Save changes',
          ),
          backLink(),
        ),
      ),
      hub.accepts(BULGARIAN) && !readOnly
        ? h(
            'button',
            {
              type: 'button',
              class: 'btn',
              'data-testid': 'fridge-bg-open',
              onclick: () => renderOffer({ ...ctx, data }, item, item.barcode ? data.products[item.barcode] : null, { after: '' }),
            },
            '🇧🇬 Learn its Bulgarian name',
          )
        : null,
      h('div', {}, take('mistake', 'Remove (added by mistake)')),
    ),
  );
}

export const routes = {
  '': renderHome,
  scan: renderScan,
  add: renderAdd,
  'add/*': renderAdd,
  'item/*': renderItem,
};
