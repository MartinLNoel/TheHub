// Settings cards for module importers (module contract, optional `importers`): bring data in from
// another app, e.g. Gym's "Import from gainz-tracker". The module's prepare(text, currentData)
// maps and merges without writing; this file shows its summary, takes a verified TheHub backup
// first (when backups are set up), checks the result with the module's validate, then saves it.
import { h, mount } from './dom.js';

/** Runs an importer's prepare() safely: a thrown error becomes a refusal. */
export function runPrepare(importer, text, current) {
  try {
    const result = importer.prepare(text, current);
    return result && typeof result === 'object' ? result : { ok: false, problems: ['The importer returned nothing.'] };
  } catch (err) {
    return { ok: false, problems: [`The file could not be read (${err.message}).`] };
  }
}

/**
 * Saves a prepared import. beforeSave (optional) runs first; if it throws, nothing is saved.
 * Returns the saved data.
 */
export async function applyModuleImport({ mod, prepared, save, beforeSave }) {
  if (!prepared?.ok) throw new Error('Refusing to import data that did not pass its checks.');
  const problems = mod.validate(prepared.data) || [];
  if (problems.length) throw new Error(`Import stopped: ${problems.join('; ')}`);
  if (beforeSave) await beforeSave();
  await save(prepared.data);
  return prepared.data;
}

/** The Settings cards, one per importer of every registered module. ctx: the Settings context. */
export function importerCards(root, ctx, rerenderSettings) {
  const cards = [];
  for (const mod of ctx.registry.list()) {
    for (const importer of mod.importers || []) {
      const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
      const inputId = `import-${mod.id}-${importer.id}`;
      const start = (text) => {
        const entry = ctx.state[mod.id];
        if (!entry || entry.data === null || entry.readOnly) {
          status.className = 'status status--bad';
          status.textContent = `${mod.name} cannot be changed right now${entry?.error ? `: ${entry.error}` : ''}.`;
          return;
        }
        const prepared = runPrepare(importer, text, entry.data);
        if (!prepared.ok) {
          mount(status, h('strong', {}, 'Import refused. '), (prepared.problems || []).join(' '));
          status.className = 'status status--bad';
          return;
        }
        renderImportConfirm(root, ctx, { mod, importer, prepared }, rerenderSettings);
      };
      const fileInput = h('input', {
        type: 'file',
        accept: 'application/json,.json',
        class: 'visually-hidden',
        id: inputId,
        'data-testid': inputId,
        onchange: async () => {
          const file = fileInput.files?.[0];
          if (!file) return;
          const text = await file.text();
          fileInput.value = '';
          start(text);
        },
      });
      let local = null;
      try {
        local = importer.findLocal ? importer.findLocal() : null;
      } catch {
        local = null;
      }
      cards.push(
        h(
          'section',
          { class: 'card', 'data-importer': `${mod.id}/${importer.id}` },
          h('h2', {}, `${mod.icon} ${importer.title}`),
          importer.description ? h('p', {}, importer.description) : null,
          h('label', { class: 'btn btn--primary', for: inputId }, 'Choose the export file…'),
          fileInput,
          local
            ? h('button', { type: 'button', class: 'btn', 'data-testid': `${inputId}-local`, onclick: () => start(local) }, importer.localLabel || 'Use the data found on this phone')
            : null,
          status,
        ),
      );
    }
  }
  return cards;
}

async function renderImportConfirm(root, ctx, { mod, importer, prepared }, rerenderSettings) {
  const backedUp = Boolean(await ctx.backup?.isConfigured());
  const result = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const entry = ctx.state[mod.id];

  mount(
    root,
    h(
      'section',
      { class: 'card card--warn', 'data-testid': 'module-import-confirm' },
      h('h2', {}, `${mod.icon} ${importer.title}`),
      h('ul', { class: 'list', 'data-testid': 'module-import-summary' }, (prepared.summary || []).map((line) => h('li', {}, line))),
      prepared.nothingNew
        ? null
        : h(
            'p',
            { class: 'muted' },
            backedUp
              ? 'Your current TheHub data is backed up to GitHub first. Nothing in TheHub is deleted: the file is added to it.'
              : 'Backups are not set up, so TheHub cannot back up first. Nothing in TheHub is deleted (the file is added to it), but export everything first if you want a copy.',
          ),
      h(
        'div',
        { class: 'row' },
        prepared.nothingNew
          ? null
          : h(
              'button',
              {
                type: 'button',
                class: 'btn btn--primary',
                'data-testid': 'module-import-apply',
                onclick: async (event) => {
                  const button = event.currentTarget;
                  button.disabled = true;
                  try {
                    await applyModuleImport({
                      mod,
                      prepared,
                      save: async (data) => {
                        await ctx.storage.save(mod, data);
                        entry.data = data;
                      },
                      beforeSave: backedUp
                        ? async () => {
                            result.className = 'status';
                            result.textContent = 'Backing up your current data first…';
                            const r = await ctx.backup.backupNow({ reason: `before ${importer.title.toLowerCase()}` });
                            if (!r.ok && r.step !== 'nothing') {
                              throw new Error(`Import stopped: the backup of your current data failed (${r.reason}). Nothing was changed.`);
                            }
                          }
                        : undefined,
                    });
                  } catch (err) {
                    button.disabled = false;
                    result.className = 'status status--bad';
                    result.textContent = err.message;
                    return;
                  }
                  mount(
                    root,
                    h(
                      'section',
                      { class: 'card', 'data-testid': 'module-import-done' },
                      h('h2', {}, 'Import done'),
                      h('p', {}, `${mod.name} now holds the imported data.`),
                      h('a', { class: 'btn btn--primary', href: `#/${mod.id}` }, `Open ${mod.name}`),
                      h('a', { class: 'btn', href: '#/today' }, 'Go to Today'),
                    ),
                  );
                },
              },
              'Import',
            ),
        h('button', { type: 'button', class: 'btn', 'data-testid': 'module-import-cancel', onclick: () => rerenderSettings() }, prepared.nothingNew ? 'Back' : 'Cancel'),
      ),
      result,
    ),
  );
}
