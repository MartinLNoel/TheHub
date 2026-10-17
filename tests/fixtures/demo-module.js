// A tiny module used ONLY by tests, to exercise the module contract. It never ships.
import { h, mount } from '../../src/core/dom.js';

export default {
  id: 'demo',
  name: 'Demo',
  icon: '🧩',
  schemaVersion: 2,
  migrations: {
    // v1 stored notes as plain strings; v2 stores { text } objects.
    2: (data) => ({ ...data, notes: (data.notes || []).map((n) => (typeof n === 'string' ? { text: n } : n)) }),
  },
  defaultData: () => ({ notes: [] }),
  validate: (data) => {
    const problems = [];
    if (!data || !Array.isArray(data.notes)) problems.push('notes must be a list');
    else if (data.notes.some((n) => typeof n?.text !== 'string')) problems.push('every note needs text');
    return problems;
  },
  routes: {
    '': ({ root, data, save }) => {
      const count = h('p', { 'data-testid': 'demo-count' }, `${data.notes.length} notes`);
      mount(
        root,
        h(
          'section',
          { class: 'card', 'data-testid': 'demo-home' },
          h('h2', {}, 'Demo module'),
          count,
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn--primary',
              'data-testid': 'demo-add',
              onclick: async () => {
                const next = { ...data, notes: [...data.notes, { text: `note ${data.notes.length + 1}` }] };
                await save(next);
                data = next;
                count.textContent = `${data.notes.length} notes`;
              },
            },
            'Add a note',
          ),
          h('a', { class: 'btn', href: '#/demo/detail' }, 'Detail'),
        ),
      );
    },
    detail: ({ root }) => mount(root, h('section', { class: 'card', 'data-testid': 'demo-detail' }, h('h2', {}, 'Demo detail'))),
  },
  todayCard: (data) => ({
    title: 'Demo',
    lines: [`${data.notes.length} notes`],
    action: { label: 'Open demo', route: 'demo' },
  }),
};
