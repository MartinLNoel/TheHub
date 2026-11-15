// The clearer Gym layout (0.9.3): today's card first, a numbered card per exercise, the program settings last.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import gym from '../../src/modules/gym/index.js';
import { defaultData } from '../../src/modules/gym/data.js';
import { HOME_PLAN } from '../../src/modules/gym/program.js';
import { resetScreenState } from '../../src/modules/gym/screens.js';

beforeEach(() => {
  resetScreenState();
  document.body.replaceChildren();
});

function workout(data) {
  const root = document.createElement('main');
  document.body.append(root);
  gym.routes['']({ root, data, readOnly: false, save: vi.fn(async () => {}), navigate: vi.fn() });
  return root.querySelector('.gym');
}

describe('the Workout screen layout', () => {
  it("opens with today's card and ends with the program settings", () => {
    const g = workout({ ...defaultData(), program: 'home' });
    const cards = [...g.querySelectorAll(':scope > .card, :scope > section')];
    expect(cards[0].classList.contains('gym-hero')).toBe(true);
    expect(cards[0].querySelector('[data-testid="gym-day"]').textContent).toBe('Day A');
    expect(cards.at(-1).classList.contains('gym-settings')).toBe(true);
    expect(cards.at(-1).querySelector('[data-testid="program-home"]')).not.toBeNull();
  });

  it('shows this week as dots, one per session, filled when done', () => {
    const data = { ...defaultData(), program: 'home', workoutLogs: [{ id: 1, date: new Date().toISOString().slice(0, 10), day: 'Day A', mode: 'home', exercises: [{ name: 'Plank', sets: [{ weight: 0, reps: 30 }] }] }] };
    const dots = [...workout(data).querySelectorAll('.gym-hero .gym-dot')];
    expect(dots).toHaveLength(3);
    expect(dots.filter((d) => d.classList.contains('done'))).toHaveLength(1);
  });

  it('numbers each exercise in its own card, with its sets as rows', () => {
    const g = workout({ ...defaultData(), program: 'home' });
    const exercises = [...g.querySelectorAll('.gym-ex.card')];
    expect(exercises).toHaveLength(HOME_PLAN['Day A'].exercises.length);
    expect(exercises.map((e) => e.querySelector('.gym-ex__num').textContent)).toEqual(exercises.map((_, i) => String(i + 1)));
    expect([...exercises[0].querySelectorAll('.gym-set__label')].map((l) => l.textContent)).toEqual(['Set 1', 'Set 2', 'Set 3']);
    expect(g.querySelector('.gym-log-btn')).not.toBeNull();
  });

  it('the sub-tabs have an icon and a name', () => {
    const tabs = [...workout(defaultData()).querySelectorAll('.gym-tab')];
    expect(tabs.map((t) => t.querySelector('.gym-tab__label').textContent)).toEqual(['Workout', 'History', 'Fighter', 'Protein', 'Check-in']);
    expect(tabs.every((t) => t.querySelector('.gym-tab__icon').textContent.length > 0)).toBe(true);
  });
});
