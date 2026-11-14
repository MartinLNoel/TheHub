// No default body weight (Gym schema 5): the protein target waits until Martin enters his weight.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import gym, { todayCard } from '../../src/modules/gym/index.js';
import { SCHEMA_VERSION, defaultData, validate } from '../../src/modules/gym/data.js';
import { addCheckIn, proteinTarget, setBodyweight } from '../../src/modules/gym/logic.js';
import { resetScreenState } from '../../src/modules/gym/screens.js';
import { runMigrations } from '../../src/core/db.js';

const WED = new Date('2026-01-07T10:00:00Z');
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('body weight', () => {
  it('a fresh store has none, and is valid; a weight must be positive', () => {
    expect(SCHEMA_VERSION).toBe(5);
    expect(defaultData().bodyweight).toBeNull();
    expect(validate(defaultData())).toEqual([]);
    expect(validate({ ...defaultData(), bodyweight: 0 })).toContain('bodyweight must be null or a positive number');
    expect(validate({ ...defaultData(), bodyweight: '75' })).toContain('bodyweight must be null or a positive number');
  });

  it('version 4 data keeps its weight', () => {
    const v4 = { ...defaultData(), bodyweight: 78.5 };
    expect(runMigrations(v4, 4, 5, gym.migrations)).toEqual(v4);
  });

  it('no weight, no target; a weight gives 1.8 g per kg; a check-in sets it', () => {
    expect(proteinTarget(defaultData())).toBeNull();
    expect(proteinTarget(setBodyweight(defaultData(), '80'))).toBe(144);
    expect(addCheckIn(defaultData(), { weight: 77, cals: null, notes: '' }, WED).bodyweight).toBe(77);
  });

  it('the Today card asks for the weight, then counts down', () => {
    expect(todayCard(defaultData(), WED).lines[2]).toBe('Protein: enter your weight (Gym → Protein) for a daily target');
    expect(todayCard({ ...defaultData(), bodyweight: 80 }, WED).lines[2]).toBe('Protein: 144g left today');
  });
});

describe('the Protein screen without a weight', () => {
  beforeEach(() => {
    resetScreenState();
    document.body.replaceChildren();
  });

  it('puts the weight field first, and saving it sets the target', async () => {
    const root = document.createElement('main');
    document.body.append(root);
    const saved = [];
    gym.routes.protein({ root, data: defaultData(), readOnly: false, save: vi.fn(async (d) => saved.push(d)), navigate: vi.fn() });
    expect(root.querySelector('[data-testid="gym-protein-left"]').textContent).toBe('No target yet: enter your weight above.');
    const field = root.querySelector('[data-testid="gym-bodyweight"]');
    expect(field.value).toBe('');
    expect(root.querySelectorAll('[data-testid="gym-bodyweight"]')).toHaveLength(1);
    field.value = '79';
    field.dispatchEvent(new Event('change'));
    await flush();
    expect(saved[0].bodyweight).toBe(79);
    expect(root.querySelector('[data-testid="gym-protein-left"]').textContent).toBe('⚡ 142g remaining');
  });
});
