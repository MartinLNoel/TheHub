// Backup screens: the "Backup" card in Settings (token, expiry, repo, test, back up now) and the
// Restore screen (#/settings/restore). The token is shown masked and never put in the page.
import { h, mount } from './dom.js';
import { countItems } from './transfer.js';
import { maskToken, relativeTime } from './backup.js';

function formatCounts(counts) {
  const parts = Object.entries(counts || {}).map(([k, n]) => `${k}: ${n}`);
  return parts.length ? parts.join(', ') : 'no items';
}

function setStatus(el, text, bad = false) {
  el.className = bad ? 'status status--bad' : 'status';
  el.textContent = text;
}

/** The Settings → Backup card. ctx: { backup (service), onChange() } */
export async function backupSettingsCard(ctx) {
  const { backup } = ctx;
  const [config, token, status] = await Promise.all([backup.getConfig(), backup.getToken(), backup.getStatus()]);
  const out = h('p', { class: 'status', role: 'status', 'aria-live': 'polite', 'data-testid': 'backup-status' });

  const tokenInput = h('input', {
    type: 'password',
    id: 'backup-token',
    'data-testid': 'backup-token',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    placeholder: token ? 'Paste a new token to replace it' : 'github_pat_…',
  });
  const expiryInput = h('input', { type: 'date', id: 'backup-expiry', 'data-testid': 'backup-expiry', value: config.tokenExpires || null });
  const ownerInput = h('input', { type: 'text', id: 'backup-owner', 'data-testid': 'backup-owner', value: config.owner, autocapitalize: 'off', spellcheck: 'false' });
  const repoInput = h('input', { type: 'text', id: 'backup-repo', 'data-testid': 'backup-repo', value: config.repo, autocapitalize: 'off', spellcheck: 'false' });

  const tokenLine = h('p', { 'data-testid': 'backup-token-masked' }, token ? `Token: ${maskToken(token)}` : 'No token yet.');

  async function run(label, fn) {
    setStatus(out, `${label}…`);
    try {
      await fn();
    } catch (err) {
      setStatus(out, err.message, true);
    }
  }

  const card = h(
    'section',
    { class: 'card', 'data-testid': 'backup-settings' },
    h('h2', {}, 'Backup'),
    h(
      'p',
      { class: 'muted' },
      'Backups go to your private GitHub repository, one commit each. The token is kept only on this phone: never in backups or exports.',
    ),
    tokenLine,
    h('label', { class: 'field', for: 'backup-token' }, 'Token (fine-grained, this repository only, Contents read and write)', tokenInput),
    h('label', { class: 'field', for: 'backup-expiry' }, 'Token expiry date', expiryInput),
    h(
      'details',
      {},
      h('summary', {}, 'Repository'),
      h('label', { class: 'field', for: 'backup-owner' }, 'Owner', ownerInput),
      h('label', { class: 'field', for: 'backup-repo' }, 'Repository', repoInput),
    ),
    h(
      'div',
      { class: 'row' },
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn--primary',
          'data-testid': 'backup-save',
          onclick: () =>
            run('Saving', async () => {
              await backup.saveConfig({ owner: ownerInput.value.trim(), repo: repoInput.value.trim(), tokenExpires: expiryInput.value });
              if (tokenInput.value.trim()) await backup.setToken(tokenInput.value);
              tokenInput.value = ''; // never keep the token in the page
              const saved = await backup.getToken();
              tokenLine.textContent = saved ? `Token: ${maskToken(saved)}` : 'No token yet.';
              setStatus(out, 'Saved.');
              ctx.onChange?.();
            }),
        },
        'Save',
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'btn',
          'data-testid': 'backup-test',
          onclick: () =>
            run('Testing', async () => {
              const r = await backup.testConnection();
              const write = r.canWrite === false ? ' but the token cannot write to it' : '';
              setStatus(out, `Connected to ${r.full}${write}${r.canWrite === false ? '.' : ' ✓'}`, r.canWrite === false);
            }),
        },
        'Test connection',
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'btn',
          'data-testid': 'backup-now-settings',
          onclick: () =>
            run('Backing up', async () => {
              const r = await backup.backupNow({ reason: 'manual' });
              if (r.ok) setStatus(out, 'Backup made and verified ✓');
              else setStatus(out, r.reason, true);
              ctx.onChange?.();
            }),
        },
        'Back up now',
      ),
      h('a', { class: 'btn', href: '#/settings/restore', 'data-testid': 'restore-link' }, 'Restore…'),
      token
        ? h(
            'button',
            {
              type: 'button',
              class: 'btn',
              'data-testid': 'backup-remove-token',
              onclick: () =>
                run('Removing', async () => {
                  await backup.clearToken();
                  tokenLine.textContent = 'No token yet.';
                  setStatus(out, 'Token removed from this phone.');
                  ctx.onChange?.();
                }),
            },
            'Remove token',
          )
        : null,
    ),
    h('p', { class: 'muted' }, status.lastVerifiedBackup ? `Last verified backup: ${relativeTime(status.lastVerifiedBackup)}` : 'No verified backup yet.'),
    out,
  );
  return card;
}

/**
 * The Restore screen. ctx: { backup, registry, state, reloadData(), navigate(hash) }
 */
export async function renderRestore(root, ctx) {
  const { backup } = ctx;
  const out = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  if (!(await backup.isConfigured())) {
    mount(
      root,
      h(
        'section',
        { class: 'card', 'data-testid': 'restore' },
        h('h2', {}, 'Restore'),
        h('p', {}, 'Backups are not set up yet. Enter the token in Settings → Backup first.'),
        h('a', { class: 'btn btn--primary', href: '#/settings' }, 'Settings'),
      ),
    );
    return;
  }
  const list = h('ul', { class: 'list', 'data-testid': 'restore-list' });
  mount(
    root,
    h(
      'section',
      { class: 'card', 'data-testid': 'restore' },
      h('h2', {}, 'Restore from a backup'),
      h('p', { class: 'muted' }, 'Pick a backup to see what it holds. Nothing changes until you confirm.'),
      list,
      out,
      h('a', { class: 'btn', href: '#/settings' }, 'Back to Settings'),
    ),
  );
  setStatus(out, 'Loading the backup history…');
  let commits;
  try {
    commits = await backup.listBackups();
  } catch (err) {
    setStatus(out, err.message, true);
    return;
  }
  setStatus(out, commits.length ? '' : 'There are no backups in the repository yet.');
  mount(
    list,
    commits.map((c, i) =>
      h(
        'li',
        {},
        h(
          'button',
          {
            type: 'button',
            class: 'btn',
            'data-testid': 'restore-pick',
            'data-sha': c.sha,
            onclick: () => renderPreview(root, ctx, c),
          },
          `${c.date ? new Date(c.date).toLocaleString() : 'unknown date'}${i === 0 ? ' (latest)' : ''}`,
        ),
        h('br'),
        h('span', { class: 'muted' }, c.message.split('\n')[0]),
      ),
    ),
  );
}

async function renderPreview(root, ctx, commit) {
  const out = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' }, 'Downloading and verifying…');
  mount(root, h('section', { class: 'card', 'data-testid': 'restore-preview' }, h('h2', {}, 'Checking the backup'), out));
  let verified;
  try {
    verified = await ctx.backup.loadBackup(commit.sha);
  } catch (err) {
    setStatus(out, err.message, true);
    root.firstChild.append(h('a', { class: 'btn', href: '#/settings/restore' }, 'Back'));
    return;
  }
  if (!verified.ok) {
    mount(
      root,
      h(
        'section',
        { class: 'card card--bad', 'data-testid': 'restore-preview' },
        h('h2', {}, 'This backup did not verify'),
        h('ul', { class: 'list' }, verified.problems.map((p) => h('li', {}, p))),
        h('button', { type: 'button', class: 'btn', onclick: () => renderRestore(root, ctx) }, 'Back'),
      ),
    );
    return;
  }
  const rows = Object.entries(verified.modules).map(([id, m]) => {
    const mod = ctx.registry.get(id);
    const migrated = m.fromVersion !== m.schemaVersion ? ` (converted from data version ${m.fromVersion})` : '';
    return h(
      'li',
      { 'data-module': id },
      h('strong', {}, `${mod.icon} ${mod.name}`),
      h('br'),
      `Now: ${formatCounts(countItems(ctx.state[id]?.data))}`,
      h('br'),
      `In backup: ${formatCounts(m.counts)}${migrated}`,
    );
  });
  const confirmOut = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const confirmBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn btn--danger',
      'data-testid': 'restore-confirm',
      onclick: async () => {
        confirmBtn.disabled = true;
        setStatus(confirmOut, 'Backing up your current data first…');
        try {
          await ctx.backup.restore(verified);
        } catch (err) {
          confirmBtn.disabled = false;
          setStatus(confirmOut, err.message, true);
          return;
        }
        await ctx.reloadData();
        mount(
          root,
          h(
            'section',
            { class: 'card', 'data-testid': 'restore-done' },
            h('h2', {}, 'Restore done'),
            h('p', {}, 'Your data was replaced with the backup. The data from before is in a new backup, in case you need it.'),
            h('a', { class: 'btn btn--primary', href: '#/today' }, 'Go to Today'),
          ),
        );
      },
    },
    'Restore this backup',
  );
  mount(
    root,
    h(
      'section',
      { class: 'card card--warn', 'data-testid': 'restore-preview' },
      h('h2', {}, 'Replace data with this backup?'),
      h('p', {}, `Backup made ${verified.createdAt ? new Date(verified.createdAt).toLocaleString() : 'on an unknown date'}. It verified ✓. Restoring replaces:`),
      h('ul', { class: 'list' }, rows),
      verified.skipped.length ? h('p', { class: 'muted' }, `Not restored (not in this app version): ${verified.skipped.join(', ')}.`) : null,
      h('div', { class: 'row' }, confirmBtn, h('button', { type: 'button', class: 'btn', onclick: () => renderRestore(root, ctx) }, 'Cancel')),
      confirmOut,
    ),
  );
}
