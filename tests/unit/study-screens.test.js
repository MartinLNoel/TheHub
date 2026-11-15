// Study engine screens in jsdom: the answer is never in the DOM before submission, lessons render a
// safe markdown subset, Cyrillic cards render unchanged, Ask Claude builds and delivers its message.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkCourse } from '../../src/core/study/content.js';
import { questionView } from '../../src/core/study/screens.js';
import { renderMarkdown } from '../../src/core/study/markdown.js';
import {
  ASK_END, CLAUDE_ANDROID_INTENT, CLAUDE_WEB_URL, askClaudeButtons, askClaudeSettingsCard, buildAskMessage, claudeAppUrl, deliver, prefillUrl,
} from '../../src/core/study/ask-claude.js';
import { createStudyModule } from '../../src/core/study/index.js';
import { defaultProgress } from '../../src/core/study/progress.js';
import { checkModule } from '../../src/core/registry.js';
import { resolveRoute } from '../../src/core/router.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'sample-course');
const read = (n) => JSON.parse(readFileSync(join(DIR, `${n}.json`), 'utf8'));
const content = { lessons: read('lessons'), questions: read('questions'), cards: read('cards') };
const course = checkCourse(content).course;
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => document.body.replaceChildren());

describe('question runner: nothing is revealed before the answer is submitted', () => {
  it.each(course.questions.map((q) => [q.id, q]))('%s', (_id, q) => {
    const el = questionView({ question: q, chosen: undefined, onSubmit: () => {} });
    document.body.append(el);
    const html = el.outerHTML;
    // Stem and all four options are there...
    expect(el.textContent).toContain(q.stem);
    for (const o of q.options) expect(el.textContent).toContain(o);
    expect(el.textContent).toContain('Select ONE option.');
    // ...but no explanation, no distractor notes, no marker of the correct option.
    expect(html).not.toContain(q.why);
    for (const note of Object.values(q.distractorNotes)) expect(html).not.toContain(note);
    expect(html).not.toMatch(/option--|data-answer=|correct/i);
    expect(el.querySelectorAll('.option--correct, .option--wrong, [data-testid="q-verdict"], [data-testid="q-why"]')).toHaveLength(0);
    const skeletons = [...el.querySelectorAll('[data-option]')].map((b) => {
      const c = b.cloneNode(true);
      c.removeAttribute('data-option');
      c.removeAttribute('data-testid');
      c.querySelector('.option__letter').textContent = '?';
      c.querySelector('.option__text').textContent = 'TEXT';
      return c.outerHTML;
    });
    // Every option's markup is identical apart from its own letter and text.
    expect(new Set(skeletons).size).toBe(1);
  });

  it('submitting calls back once; the answered view shows the answer, why and each distractor note', () => {
    const q = course.questions[0];
    const onSubmit = vi.fn();
    const el = questionView({ question: q, chosen: undefined, onSubmit });
    el.querySelector('[data-testid="q-submit"]').click(); // nothing selected yet
    expect(onSubmit).not.toHaveBeenCalled();
    el.querySelector('[data-option="A"]').click();
    el.querySelector('[data-testid="q-submit"]').click();
    el.querySelector('[data-testid="q-submit"]').click();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('A');

    const after = questionView({ question: q, chosen: 'A', onSubmit });
    expect(after.textContent).toContain(q.why);
    for (const note of Object.values(q.distractorNotes)) expect(after.textContent).toContain(note);
    expect(after.querySelector('.option--correct').dataset.option).toBe(q.answer);
  });
});

describe('lesson markdown subset', () => {
  it('renders headings, lists, bold, italic, code and tables, and never HTML', () => {
    const nodes = renderMarkdown(course.lessons[0].body + '\n\n<img src=x onerror=alert(1)>');
    const div = document.createElement('div');
    div.append(...nodes);
    expect(div.querySelector('h3').textContent).toBe('A star nearby');
    expect(div.querySelector('strong').textContent).toBe('star');
    expect(div.querySelector('em').textContent).toBe('8 minutes');
    expect(div.querySelectorAll('ul li')).toHaveLength(2);
    expect(div.querySelectorAll('table tbody tr')).toHaveLength(2);
    expect(div.querySelector('th').textContent).toBe('Fact');
    expect(div.querySelector('code').textContent).toBe('<script>');
    expect(div.querySelector('script, img')).toBe(null);
    expect(div.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('ordered lists', () => {
    const div = document.createElement('div');
    div.append(...renderMarkdown(course.lessons[1].body));
    expect([...div.querySelectorAll('ol li')].map((li) => li.textContent)).toEqual(['Mercury', 'Venus', 'Earth', 'Mars']);
  });
});

function mountModule(mod, route, data, extra = {}) {
  const root = document.createElement('main');
  document.body.append(root);
  const saved = [];
  const ctx = {
    root,
    data,
    readOnly: false,
    params: '',
    settings: { askClaude: 'copy' },
    save: vi.fn(async (d) => {
      saved.push(d);
      ctx.data = d;
    }),
    navigate: vi.fn(),
    ...extra,
  };
  const found = resolveRoute(mod.routes, route);
  return { root, ctx, saved, done: found.render(ctx) };
}

describe('flashcards', () => {
  it('Cyrillic renders unchanged, large, with its language set; both directions come up', async () => {
    const mod = createStudyModule({ id: 'sample', name: 'Sample', icon: '📚', content });
    const { root, done } = mountModule(mod, 'cards', defaultProgress());
    await done;
    const front = root.querySelector('[data-testid="card-front"]');
    expect(front.textContent).toBe('Здравей');
    expect(front.textContent.normalize('NFC')).toBe('Здравей'.normalize('NFC'));
    expect([...front.textContent].map((c) => c.codePointAt(0).toString(16))).toEqual(['417', '434', '440', '430', '432', '435', '439']);
    expect(front.getAttribute('lang')).toBe('bg');
    expect(front.className).toBe('flashcard__text');
    root.querySelector('[data-testid="card-show"]').click();
    expect(root.querySelector('[data-testid="card-back"]').textContent).toBe('Hello');
    expect(root.querySelector('[data-testid="card-back"]').getAttribute('lang')).toBe('en');
    root.querySelector('[data-testid="grade-good"]').click();
    await flush();
    // Next: the reverse side, English first.
    expect(root.querySelector('[data-testid="flashcard"]').dataset.card).toBe('c-hello~rev');
    expect(root.querySelector('[data-testid="card-front"]').textContent).toBe('Hello');
    root.querySelector('[data-testid="card-show"]').click();
    expect(root.querySelector('[data-testid="card-back"]').textContent).toBe('Здравей');
  });
});

describe('course hooks on the engine screens (Part 7)', () => {
  it('config.tabs replaces the sub-tabs; the default stays the five engine tabs', async () => {
    const plain = mountModule(createStudyModule({ id: 'sample', name: 'Sample', icon: '📚', content }), 'cards', defaultProgress());
    await plain.done;
    expect([...plain.root.querySelectorAll('.subtab__label')].map((a) => a.textContent)).toEqual(['Home', 'Lessons', 'Cards', 'Mocks', 'Feedback']);
    expect([...plain.root.querySelectorAll('.subtab__icon')]).toHaveLength(5); // an icon over each name (0.9.4)
    const own = mountModule(createStudyModule({ id: 'sample', name: 'Sample', icon: '📚', content, tabs: [['', 'Home'], ['cards', 'Cards']] }), 'cards', defaultProgress());
    await own.done;
    expect([...own.root.querySelectorAll('.subtab')].map((a) => a.getAttribute('href'))).toEqual(['#/sample', '#/sample/cards']);
  });

  it('cardExtras adds to each shown face, onCardGraded changes the saved data, feedbackTitle names targets', async () => {
    const faces = [];
    const mod = createStudyModule({
      id: 'sample', name: 'Sample', icon: '📚', content,
      cardExtras: ({ face, text, lang }) => (faces.push([face, text, lang]), document.createElement('i')),
      onCardGraded: (d, info) => ({ ...d, graded: info }),
      feedbackTitle: (f) => (f.targetKind === 'letter' ? `Letter ${f.targetId}` : null),
    });
    const { root, done, saved } = mountModule(mod, 'cards', defaultProgress());
    await done;
    expect(faces).toEqual([['front', 'Здравей', 'bg']]);
    root.querySelector('[data-testid="card-show"]').click();
    expect(faces.slice(-2)).toEqual([['front', 'Здравей', 'bg'], ['back', 'Hello', 'en']]);
    root.querySelector('[data-testid="grade-good"]').click();
    await flush();
    expect(saved[0].graded).toMatchObject({ key: 'c-hello', grade: 'good' });
    const fb = mountModule(mod, 'feedback', { ...defaultProgress(), feedback: [{ id: 'f1', targetId: 'sht', targetKind: 'letter', text: 'x', at: '2026-10-18T08:00:00Z', resolved: false }] });
    await fb.done;
    expect(fb.root.querySelector('[data-testid="feedback-item"] strong').textContent).toBe('Letter sht');
  });
});

describe('Ask Claude', () => {
  const lesson = course.lessons[0];
  const q = course.questions.find((x) => x.id === 'q-1-1-b');

  it('a question message holds every context field and ends with "My question: "', () => {
    const msg = buildAskMessage({ name: 'Sample course' }, { kind: 'question', question: q, chosen: 'C', lesson });
    for (const part of [
      'Course: Sample course',
      `Section: ${lesson.section} ${lesson.title}`,
      `Objective: ${q.objective} (${q.kLevel})`,
      `Question: ${q.stem}`,
      `A) ${q.options[0]}`,
      `B) ${q.options[1]}`,
      `C) ${q.options[2]}`,
      `D) ${q.options[3]}`,
      `My answer: C) ${q.options[2]}`,
      `Correct answer: B) ${q.options[1]}`,
    ]) {
      expect(msg).toContain(part);
    }
    expect(msg.endsWith(ASK_END)).toBe(true);
    expect(ASK_END).toBe('My question: ');
  });

  it('refuses a question that is not answered yet; lesson and card messages', () => {
    expect(() => buildAskMessage({ name: 'S' }, { kind: 'question', question: q })).toThrow();
    const l = buildAskMessage({ name: 'S' }, { kind: 'lesson', lesson });
    expect(l).toContain('Objectives: S-1.1');
    expect(l).toContain('The Sun is a **star**');
    const c = buildAskMessage({ name: 'S' }, { kind: 'card', card: course.cards[0], reverse: true });
    expect(c).toContain('Flashcard front: Hello');
    expect(c).toContain('Flashcard back: Здравей');
    expect(c.endsWith(ASK_END)).toBe(true);
  });

  it('share: uses navigator.share with the text', async () => {
    const share = vi.fn(async () => {});
    const open = vi.fn();
    expect(await deliver('hi', 'share', { navigator: { share }, open })).toEqual({ method: 'share', ok: true });
    expect(share).toHaveBeenCalledWith({ text: 'hi' });
    expect(open).not.toHaveBeenCalled();
  });

  it('share cancelled: nothing else happens; share missing or failing: copy', async () => {
    const open = vi.fn();
    const abort = Object.assign(new Error('x'), { name: 'AbortError' });
    expect(await deliver('hi', 'share', { navigator: { share: async () => Promise.reject(abort) }, open })).toMatchObject({ cancelled: true });
    expect(open).not.toHaveBeenCalled();
    const writeText = vi.fn(async () => {});
    const toast = vi.fn();
    const r = await deliver('hi', 'share', { navigator: { clipboard: { writeText }, userAgent: 'Linux; Android 14' }, open, toast });
    expect(r).toEqual({ method: 'copy', ok: true });
    expect(writeText).toHaveBeenCalledWith('hi');
    expect(toast).toHaveBeenCalledWith('Message copied — paste it');
    expect(open).toHaveBeenCalledWith(CLAUDE_ANDROID_INTENT);
  });

  it('link: opens the prefill address with the message encoded', async () => {
    const open = vi.fn();
    await deliver('a b&c', 'link', { navigator: {}, open });
    expect(open).toHaveBeenCalledWith('https://claude.ai/new?q=a%20b%26c');
    expect(prefillUrl('x')).toBe('https://claude.ai/new?q=x');
    expect(claudeAppUrl('Windows NT')).toBe(CLAUDE_WEB_URL);
  });

  it('buttons: share by default with "Copy instead"; copy alone when there is no share sheet', () => {
    const withShare = askClaudeButtons({ makeMessage: () => 'm', delivery: 'share', env: { navigator: { share: () => {} } } });
    expect(withShare.querySelector('[data-testid="ask-claude-button"]').dataset.delivery).toBe('share');
    expect(withShare.querySelector('[data-testid="ask-claude-copy"]').textContent).toBe('Copy instead');
    const without = askClaudeButtons({ makeMessage: () => 'm', delivery: 'share', env: { navigator: {} } });
    expect(without.querySelector('[data-testid="ask-claude-button"]').dataset.delivery).toBe('copy');
    expect(without.querySelector('[data-testid="ask-claude-copy"]')).toBe(null);
  });

  it('Settings card: link is not the default; a choice is stored', async () => {
    const onChoose = vi.fn();
    const card = askClaudeSettingsCard({ onChoose });
    expect(card.querySelector('[aria-pressed="true"]').dataset.deliveryChoice).toBe('share');
    card.querySelector('[data-delivery-choice="link"]').click();
    await flush();
    expect(onChoose).toHaveBeenCalledWith('link');
    expect(card.querySelectorAll('[data-testid^="ask-test-"]')).toHaveLength(3);
  });
});

describe('createStudyModule', () => {
  const mod = createStudyModule({ id: 'sample', name: 'Sample', icon: '📚', content });

  it('follows the module contract, with valid default data', () => {
    expect(checkModule(mod)).toEqual([]);
    expect(mod.validate(mod.defaultData())).toEqual([]);
    expect(Object.keys(mod.routes)).toEqual(expect.arrayContaining(['', 'session', 'lessons', 'lesson/*', 'mock', 'cards', 'feedback']));
  });

  it('module-specific fields: extendDefault and validateExtra', () => {
    const m = createStudyModule({ id: 'x', name: 'X', icon: 'x', content, extendDefault: (d) => ({ ...d, readiness: [] }), validateExtra: (d) => (Array.isArray(d.readiness) ? [] : ['readiness must be a list']) });
    expect(m.defaultData().readiness).toEqual([]);
    expect(m.validate({ ...m.defaultData(), readiness: 1 })).toEqual(['readiness must be a list']);
  });

  it('every route renders with fresh data', async () => {
    await mod.getCourse();
    for (const route of ['', 'session', 'lessons', 'lesson/s-1-1', 'mock', 'cards', 'feedback']) {
      document.body.replaceChildren();
      const { root, done, ctx } = mountModule(mod, route, mod.defaultData(), { params: route.startsWith('lesson/') ? 's-1-1' : '' });
      await done;
      expect(root.children.length, route).toBeGreaterThan(0);
      expect(ctx.save).not.toHaveBeenCalled();
    }
  });

  it('the Today card shows the next lesson and what is due', async () => {
    await mod.getCourse();
    const card = mod.todayCard(mod.defaultData());
    expect(card.lines).toContain('Next: 1.1 The Sun');
    expect(card.lines).toContain('Review items due: 0');
    expect(card.lines).toContain('Cards due: 5');
    expect(card.action).toEqual({ label: 'Study', route: 'sample' });
  });

  it('feedback from a lesson is saved and listed', async () => {
    const { root, done, saved } = mountModule(mod, 'lesson/s-1-1', mod.defaultData(), { params: 's-1-1' });
    await done;
    root.querySelector('[data-testid="feedback-button"]').click();
    root.querySelector('[data-testid="feedback-text"]').value = 'Add a picture';
    root.querySelector('[data-testid="feedback-save"]').click();
    await flush();
    expect(saved.at(-1).feedback).toEqual([expect.objectContaining({ targetId: 's-1-1', targetKind: 'lesson', text: 'Add a picture', resolved: false })]);
    const list = mountModule(mod, 'feedback', saved.at(-1));
    await list.done;
    expect(list.root.querySelector('[data-testid="feedback-open"]').textContent).toContain('Lesson 1.1 The Sun');
    expect(list.root.querySelector('[data-testid="feedback-open"]').textContent).toContain('Add a picture');
  });
});

describe('resolveRoute', () => {
  const routes = { '': () => 'home', log: () => 'log', 'lesson/*': () => 'lesson' };
  it('exact routes first, then <first>/* with params', () => {
    expect(resolveRoute(routes, '').params).toBe('');
    expect(resolveRoute(routes, 'log').render()).toBe('log');
    expect(resolveRoute(routes, 'lesson/3.1')).toMatchObject({ params: '3.1' });
    expect(resolveRoute(routes, 'lesson/a/b').params).toBe('a/b');
    expect(resolveRoute(routes, 'lesson')).toBe(null);
    expect(resolveRoute(routes, 'nothing-here')).toBe(null);
    expect(resolveRoute(routes, 'log/x')).toBe(null);
  });
});
