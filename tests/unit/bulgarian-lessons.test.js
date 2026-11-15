// Bulgarian, ready for the book (2026-11-15): once the course has lessons, the Lessons tab and the session card
// appear by themselves; until then the home names the book. The lesson here is PRACTICE content made up for the
// test (not the book's): the module is fed through a stubbed fetch.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const real = (name) => JSON.parse(readFileSync(join(ROOT, 'content', 'bulgarian', name), 'utf8'));
const LESSON = { id: 'bgT.1', chapter: 1, section: '1.1', title: 'Test greetings', objectives: ['BG-T.1'], body: '# Здравей\nA practice lesson for the test.' };
const QUESTION = {
  id: 'qT-1', objective: 'BG-T.1', kLevel: 'K1', stem: 'How do you say hello to a friend?', options: ['Здравей', 'Довиждане', 'Благодаря', 'Моля'],
  answer: 'A', why: 'Здравей is a friendly hello.', distractorNotes: { B: 'Goodbye.', C: 'Thank you.', D: 'Please.' }, source: 'generated',
};
const flush = () => new Promise((r) => setTimeout(r, 0));
let fetchSpy;
let bulgarian;
let screens;

beforeAll(async () => {
  const files = {
    'index.json': { ...real('index.json'), chapters: [{ chapter: 1, title: 'Test chapter', files: {} }], lessons: ['lessons-ch1.json'], questions: ['questions-ch1.json'] },
    'lessons-ch1.json': [LESSON],
    'questions-ch1.json': [QUESTION],
    'alphabet.json': real('alphabet.json'),
    'reading.json': real('reading.json'),
    'handled-feedback.json': real('handled-feedback.json'),
  };
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const name = String(url).split('/').pop();
    return files[name] ? { ok: true, status: 200, json: async () => structuredClone(files[name]) } : { ok: false, status: 404, json: async () => null };
  });
  bulgarian = (await import('../../src/modules/bulgarian/index.js')).default;
  screens = await import('../../src/modules/bulgarian/screens.js');
});
afterAll(() => fetchSpy.mockRestore());

function mount(route, data) {
  const root = document.createElement('main');
  document.body.replaceChildren(root);
  const saved = [];
  const ctx = { root, data, readOnly: false, moduleId: 'bulgarian', save: vi.fn(async (d) => saved.push(d)), navigate: vi.fn() };
  bulgarian.routes[route](ctx);
  return { root, saved, ctx };
}

describe('Bulgarian with lessons', () => {
  it('shows the Lessons tab and the session card instead of the waiting panel', async () => {
    const { root } = mount('', bulgarian.defaultData());
    for (let i = 0; i < 10 && !root.querySelector('[data-testid="bg-home"]'); i++) await flush();
    expect([...root.querySelectorAll('.subtab__label')].map((t) => t.textContent)).toEqual(['Home', 'Lessons', 'Alphabet', 'Cards', 'Feedback']);
    expect(root.querySelector('[data-testid="bg-book-panel"]')).toBeNull();
    const card = root.querySelector('[data-testid="study-session-card"]');
    expect(card.textContent).toContain('Session 1');
    expect(card.textContent).toContain('Next lesson: 1.1 Test greetings');
  });

  it('starting the session saves it and opens the session screen', async () => {
    const { root, saved, ctx } = mount('', bulgarian.defaultData());
    for (let i = 0; i < 10 && !root.querySelector('[data-testid="study-start"]'); i++) await flush();
    root.querySelector('[data-testid="study-start"]').click();
    await flush();
    expect(saved.at(-1).activeSession.steps.length).toBeGreaterThan(0);
    expect(ctx.navigate).toHaveBeenCalledWith('#/bulgarian/session');
  });

  it('withLessonsTab adds the tab once, and only when there are lessons', () => {
    const tabs = screens.withLessonsTab({ lessons: [LESSON] });
    expect(tabs.filter(([r]) => r === 'lessons')).toHaveLength(1);
    expect(screens.BOOK.title).toBe('Learn Bulgarian the Easy Way');
  });
});
