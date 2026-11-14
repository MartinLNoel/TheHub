// The quote of the day on the Gym's Today card (Martin's choice of kinds, 2026-11-14).
import { describe, expect, it } from 'vitest';
import { todayCard } from '../../src/modules/gym/index.js';
import { defaultData } from '../../src/modules/gym/data.js';
import { QUOTES, quoteFor, quoteLine } from '../../src/modules/gym/quotes.js';

describe('the quote of the day', () => {
  it('is the same all day and changes the next day', () => {
    expect(quoteFor('2026-11-14')).toBe(quoteFor('2026-11-14'));
    expect(quoteFor('2026-11-15')).not.toBe(quoteFor('2026-11-14'));
    const seen = new Set();
    for (let d = 1; d <= QUOTES.length; d++) seen.add(quoteFor(`2026-01-${String(d).padStart(2, '0')}`));
    expect(seen.size).toBe(Math.min(QUOTES.length, 31));
  });

  it('only the kinds Martin chose: no blunt ones, and no story names (no spoilers)', () => {
    const all = JSON.stringify(QUOTES);
    expect(all).not.toMatch(/nobody is coming/i);
    expect(all).not.toMatch(/\b(Tad|Vira|Pip|Brannoc|Grubb|Mossback|Gullet)\b/);
    expect(quoteLine({ text: 'Small plates add up.' })).toBe('💬 “Small plates add up.”');
    expect(quoteLine({ text: 'x', by: 'Someone' })).toBe('💬 “x” — Someone');
  });

  it('is on the Today card', () => {
    const now = new Date('2026-01-07T10:00:00Z');
    expect(todayCard(defaultData(), now).lines).toContain(quoteLine(quoteFor('2026-01-07')));
  });
});

