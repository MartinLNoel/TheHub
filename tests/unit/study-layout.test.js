// The clearer study home (0.9.4): the session card first, mastery as a bar per chapter.
import { describe, expect, it } from 'vitest';
import { homeCards } from '../../src/modules/istqb/screens.js';

const objectives = [
  { code: 'FL-1.1.1', chapter: 1, kLevel: 'K1' },
  { code: 'FL-1.1.2', chapter: 1, kLevel: 'K2' },
  { code: 'FL-3.1.1', chapter: 3, kLevel: 'K1' },
];

describe('the ISTQB mastery bars', () => {
  it('shows a bar per chapter, its parts in proportion, best first, and the counts in words', async () => {
    const { setExtras } = await import('../../src/modules/istqb/screens.js');
    setExtras({ objectives });
    const data = {
      sessions: [], attempts: [], reviewQueue: [], feedback: [], cardState: {}, pointer: null,
      mastery: { 'FL-1.1.1': 'exam-ready', 'FL-1.1.2': 'shaky', 'FL-3.1.1': 'untested' },
    };
    const card = await homeCards({ moduleId: 'istqb' }, { lessons: [], questions: [] }, data);
    const bars = [...card.querySelectorAll('.mbar')];
    expect(bars).toHaveLength(6);
    const ch1 = bars[0];
    expect([...ch1.querySelectorAll('.mbar__seg')].map((s) => [s.className.replace('mbar__seg mbar__seg--', ''), s.style.flexGrow])).toEqual([
      ['exam-ready', '0.5'],
      ['shaky', '0.5'],
    ]);
    expect(ch1.querySelector('.mbar__words').textContent).toBe('★ 1 exam-ready · ◐ 1 shaky');
    expect(ch1.querySelector('.mbar__bar').getAttribute('aria-label')).toBe('Chapter 1: ★ 1 exam-ready · ◐ 1 shaky');
    expect([...card.querySelectorAll('.mbar__key')].map((k) => k.textContent)).toEqual(['exam-ready', 'solid', 'shaky', 'untested']);
  });
});
