// Daily checks on the home screen (todayWidget: one big tick button per check, under the "Today" heading) and on
// their own page (#/daily: the last two weeks, and naming, adding and removing checks). Logic: data.js.
import { h, mount } from '../../core/dom.js';
import { localDate } from '../../core/dates.js';
import { MAX_CHECKS, MAX_NAME, addCheck, doneToday, editCheck, lastDays, removeCheck, streak, toggle } from './data.js';

const streakText = (n) => (n >= 2 ? `${n} days in a row` : '');

/**
 * The home screen's checks. ctx: { data, readOnly, save } (the core's widget context). A tap ticks or unticks today.
 * It redraws itself when the day changes while it is on screen (the app left open overnight).
 */
export function todayWidget(ctx, { now = () => new Date() } = {}) {
  let data = ctx.data;
  if (!data || !data.checks.length) return null;
  const list = h('div', { class: 'daily__list' });
  const msg = h('p', { class: 'status status--bad', role: 'status', hidden: true, 'data-testid': 'daily-msg' });
  let day = localDate(now());

  const draw = () => {
    mount(
      list,
      data.checks.map((c) => {
        const done = doneToday(data, c.id, now());
        return h(
          'button',
          {
            type: 'button',
            class: `daily-check${done ? ' daily-check--done' : ''}`,
            'aria-pressed': done ? 'true' : 'false',
            disabled: ctx.readOnly,
            'data-testid': `daily-${c.id}`,
            onclick: async () => {
              const next = toggle(data, c.id, now());
              try {
                await ctx.save(next);
              } catch (err) {
                msg.hidden = false;
                msg.textContent = `Not saved: ${err.message}`;
                return;
              }
              msg.hidden = true;
              data = next;
              draw();
            },
          },
          h('span', { class: 'daily-check__icon', 'aria-hidden': 'true' }, c.icon),
          h('span', { class: 'daily-check__text' }, h('span', { class: 'daily-check__name' }, c.name), h('span', { class: 'daily-check__sub' }, done ? `Done today${streakText(streak(data, c.id, now())) ? ` · ${streakText(streak(data, c.id, now()))}` : ''}` : 'Not yet today')),
          h('span', { class: 'daily-check__box', 'aria-hidden': 'true' }, done ? '✓' : ''),
        );
      }),
    );
  };
  draw();

  const node = h('section', { class: 'daily', 'data-module': 'daily', 'data-testid': 'daily-widget', 'aria-label': 'Daily checks' }, list, msg, h('a', { class: 'daily__edit', href: '#/daily', 'data-testid': 'daily-page-link' }, 'History and edit ›'));
  const timer = setInterval(() => {
    if (!node.isConnected) return clearInterval(timer);
    const d = localDate(now());
    if (d !== day) {
      day = d;
      draw();
    }
  }, 60_000);
  return node;
}

/** The page: each check's last 14 days and streak, then rename, remove and add. */
export function renderDaily(ctx, { now = () => new Date() } = {}) {
  const { root, readOnly } = ctx;
  let data = ctx.data;
  const msg = h('p', { class: 'status', role: 'status', 'aria-live': 'polite', 'data-testid': 'daily-page-msg' });

  const commit = async (next, done) => {
    try {
      await ctx.save(next);
    } catch (err) {
      msg.className = 'status status--bad';
      msg.textContent = `Not saved: ${err.message}`;
      return;
    }
    data = next;
    draw();
    msg.className = 'status status--good';
    msg.textContent = done;
  };

  const history = (c) =>
    h(
      'section',
      { class: 'card', 'data-testid': `daily-history-${c.id}` },
      h('h2', {}, `${c.icon} ${c.name}`),
      h(
        'ol',
        { class: 'daily-days', 'aria-label': 'The last 14 days' },
        lastDays(data, c.id, 14, now()).map((d) =>
          h('li', { class: `daily-day${d.done ? ' daily-day--done' : ''}`, title: d.day, 'aria-label': `${d.day}: ${d.done ? 'done' : 'not done'}` }, d.day.slice(8)),
        ),
      ),
      h('p', { class: 'muted' }, streak(data, c.id, now()) ? `${streak(data, c.id, now())} day${streak(data, c.id, now()) === 1 ? '' : 's'} in a row.` : 'No streak yet.'),
    );

  const editor = (c) => {
    const icon = h('input', { type: 'text', value: c.icon, maxlength: '4', class: 'daily-edit__icon', 'aria-label': 'Icon', 'data-testid': `daily-icon-${c.id}` });
    const name = h('input', { type: 'text', value: c.name, maxlength: String(MAX_NAME), 'aria-label': 'Name', 'data-testid': `daily-name-${c.id}` });
    return h(
      'div',
      { class: 'row daily-edit' },
      icon,
      name,
      h('button', { type: 'button', class: 'btn', disabled: readOnly, 'data-testid': `daily-save-${c.id}`, onclick: () => commit(editCheck(data, c.id, name.value, icon.value), 'Saved.') }, 'Save'),
      h(
        'button',
        {
          type: 'button',
          class: 'btn',
          disabled: readOnly,
          'data-testid': `daily-remove-${c.id}`,
          onclick: () => {
            if (typeof confirm === 'function' && !confirm(`Remove "${c.name}" and its history?`)) return;
            commit(removeCheck(data, c.id), 'Removed.');
          },
        },
        'Remove',
      ),
    );
  };

  const draw = () => {
    const newIcon = h('input', { type: 'text', placeholder: '✅', maxlength: '4', class: 'daily-edit__icon', 'aria-label': 'Icon', 'data-testid': 'daily-new-icon' });
    const newName = h('input', { type: 'text', placeholder: 'Something to do once a day', maxlength: String(MAX_NAME), 'aria-label': 'Name', 'data-testid': 'daily-new-name' });
    const full = data.checks.length >= MAX_CHECKS;
    mount(
      root,
      h(
        'div',
        { class: 'stack', 'data-testid': 'daily-page' },
        data.checks.length ? data.checks.map(history) : h('section', { class: 'card' }, h('p', {}, 'No daily checks. Add one below and it appears on the home screen.')),
        h(
          'section',
          { class: 'card stack' },
          h('h2', {}, 'Edit'),
          h('p', { class: 'muted' }, 'Each check shows on the home screen under "Today". Tap it once you have done it; it resets every day.'),
          data.checks.map(editor),
          h(
            'div',
            { class: 'row daily-edit' },
            newIcon,
            newName,
            h('button', { type: 'button', class: 'btn btn--primary', disabled: readOnly || full, 'data-testid': 'daily-add', onclick: () => commit(addCheck(data, newName.value, newIcon.value), 'Added.') }, 'Add'),
          ),
          full ? h('p', { class: 'muted' }, `At most ${MAX_CHECKS} checks.`) : null,
          msg,
        ),
      ),
    );
  };
  draw();
}
