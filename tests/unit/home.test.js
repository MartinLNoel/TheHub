// The phone-style home screen (0.9.2): the clock, an icon per app and Settings, then the Today widgets.
import { beforeEach, describe, expect, it } from 'vitest';
import { APP_COLORS, renderToday } from '../../src/core/today.js';
import { createRegistry } from '../../src/core/registry.js';
import demo from '../fixtures/demo-module.js';

beforeEach(() => document.body.replaceChildren());

function home(mods) {
  const root = document.createElement('main');
  document.body.append(root);
  const registry = createRegistry(mods);
  const state = Object.fromEntries(mods.map((m) => [m.id, { data: m.defaultData(), readOnly: false }]));
  renderToday(root, { registry, state });
  return root;
}

describe('the home screen', () => {
  it('shows an icon for every app, then Settings, each linking to it', () => {
    const root = home([demo]);
    const icons = [...root.querySelectorAll('[data-testid="home-apps"] .app-icon')];
    expect(icons.map((a) => [a.dataset.app, a.getAttribute('href'), a.textContent])).toEqual([
      ['demo', '#/demo', `${demo.icon}${demo.name}`],
      ['settings', '#/settings', '⚙️Settings'],
    ]);
    expect(icons[0].getAttribute('style')).toBe(`--app:${APP_COLORS.demo}`);
  });

  it('has the time and date at the top, and the Today widgets below the icons', () => {
    const root = home([demo]);
    expect(root.querySelector('.home__time').textContent).toMatch(/^\d{2}:\d{2}$/);
    expect(root.querySelector('.home__date').textContent.length).toBeGreaterThan(5);
    const order = [...root.querySelector('[data-testid="today"]').children].map((el) => el.className || el.tagName);
    expect(order.indexOf('home__apps')).toBeLessThan(order.findIndex((c) => String(c).startsWith('card')));
    expect(root.querySelector('[data-module="demo"]')).not.toBeNull();
    expect(root.querySelector('[data-module="core-backup"]')).not.toBeNull();
  });

  it('an app without a colour of its own gets the default one', () => {
    const root = home([{ ...demo, id: 'newapp', name: 'New' }]);
    expect(root.querySelector('[data-app="newapp"]').getAttribute('style')).toBe('--app:#5b6270');
  });
});
