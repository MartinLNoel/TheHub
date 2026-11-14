// The home plan's moving demonstrations (src/modules/gym/demos.js).
import { describe, expect, it } from 'vitest';
import { DEMOS, PAIRS, demoFigure, demoVideoUrl, poseAt } from '../../src/modules/gym/demos.js';
import { HOME_PLAN } from '../../src/modules/gym/program.js';

describe('demonstrations', () => {
  const all = Object.values(HOME_PLAN).flatMap((d) => d.exercises);

  it('every exercise has a demonstration, and every demonstration is used', () => {
    expect(all.filter((ex) => !DEMOS[ex.demo])).toEqual([]);
    expect(Object.keys(DEMOS).sort()).toEqual([...new Set(all.map((ex) => ex.demo))].sort());
  });

  it('no cue needs a band or a towel, or a jump', () => {
    expect(JSON.stringify(DEMOS)).not.toMatch(/band|towel|jump/i);
  });

  it.each(Object.keys(DEMOS))('%s: the end pose moves the same points, dumbbells sit on a hand, bones have both ends', (key) => {
    const d = DEMOS[key];
    if (d.B) expect(Object.keys(d.B).filter((k) => !(k in d.A))).toEqual([]);
    for (const k of d.db || []) expect(d.A[k], `${key} holds a dumbbell at ${k}`).toBeDefined();
    expect(PAIRS.some(([a, b]) => d.A[a] && d.A[b])).toBe(true);
    expect(d.cue.length).toBeGreaterThan(20);
    expect(demoVideoUrl(key)).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=/);
  });

  it('poseAt goes from A at 0 to B at 1; a hold stays put', () => {
    const d = DEMOS.curl;
    expect(poseAt(d, 0).w).toEqual(d.A.w);
    expect(poseAt(d, 1).w).toEqual(d.B.w);
    expect(poseAt(DEMOS.plank, 0.5)).toBe(DEMOS.plank.A);
  });

  it('a figure draws the body, the end outline and the dumbbells; a hold says HOLD', () => {
    const moving = demoFigure('lateral', 'Lateral raise');
    expect(moving.getAttribute('aria-label')).toBe('Lateral raise: how to do it');
    expect(moving.querySelector('.gym-demo__ghost')).not.toBeNull();
    expect(moving.querySelectorAll('.gym-demo__db')).toHaveLength(2);
    expect(moving.querySelector('.gym-demo__body circle').getAttribute('cx')).toBe('100');

    const hold = demoFigure('plank');
    expect(hold.textContent).toBe('HOLD');
    expect(hold.querySelector('.gym-demo__ghost')).toBeNull();
    expect(demoFigure('nope')).toBeNull();
  });

  it('a chair is drawn where the exercise uses one', () => {
    expect(demoFigure('dip').querySelector('.gym-demo__seat')).not.toBeNull();
    expect(demoFigure('pushup').querySelector('.gym-demo__seat')).toBeNull();
  });
});
