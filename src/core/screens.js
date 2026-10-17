// Small shared screens: "coming soon" and "something went wrong".
import { h, mount } from './dom.js';

// Modules that are planned but may not be in this build yet (docs/plans/part-4..8).
export const PLANNED = {
  gym: { name: 'Gym', icon: '🏋️', part: 4 },
  istqb: { name: 'ISTQB', icon: '🧪', part: 6 },
  bulgarian: { name: 'Bulgarian', icon: '🇧🇬', part: 7 },
  fridge: { name: 'Fridge', icon: '🧊', part: 8 },
};

export function renderComingSoon(root, { section, screen }) {
  const planned = PLANNED[section];
  const title = planned ? `${planned.icon} ${planned.name}` : 'Not here yet';
  const text = planned
    ? `${planned.name} is coming soon. It arrives with a later update.`
    : `There is no screen at "#/${[section, screen].filter(Boolean).join('/')}".`;
  mount(
    root,
    h(
      'section',
      { class: 'card coming-soon', 'data-testid': 'coming-soon' },
      h('h2', {}, title),
      h('p', {}, text),
      h('a', { class: 'btn', href: '#/today' }, 'Back to Today'),
    ),
  );
}

export function renderProblem(root, title, message) {
  mount(
    root,
    h(
      'section',
      { class: 'card card--warn', role: 'alert' },
      h('h2', {}, title),
      h('p', {}, message),
      h('a', { class: 'btn', href: '#/today' }, 'Back to Today'),
    ),
  );
}
