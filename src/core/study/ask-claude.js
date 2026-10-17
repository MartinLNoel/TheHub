// "Ask Claude": builds a message with the full context of a lesson, an answered question or a card,
// ending with "My question: ", and hands it to the Claude app (Martin's subscription, no API).
//
// Three deliveries (docs/plans/part-5-study-engine.md, item 7); the choice is in Settings → Ask Claude:
//   share  Android share sheet, navigator.share({ text }): pick Claude, the text lands in a new chat.
//          The default. Without navigator.share it falls back to copy.
//   link   opens claude.ai/new?q=<message>. UNDOCUMENTED for normal chats (support.claude.com article
//          14898120, checked 2026-10-17, documents prefill links only for Claude Code), so it is off
//          unless chosen in Settings.
//   copy   copies the message, opens the Claude app, toast "Message copied — paste it".
// "Copy instead" (copy) is always offered next to the main button.
// PLACEHOLDER(Q-13): which of the three works on Martin's phone is untested.
import { h } from '../dom.js';
import { LETTERS } from './content.js';

export const DELIVERIES = [
  { id: 'share', label: 'Share sheet' },
  { id: 'link', label: 'Link (experimental)' },
  { id: 'copy', label: 'Copy and open Claude' },
];
export const DEFAULT_DELIVERY = 'share';
export const ASK_END = 'My question: ';
const BODY_LIMIT = 1500;

// PLACEHOLDER(Q-13): how to open the Claude app. On Android an intent URL names the app's package
// (com.anthropic.claude, unverified) and falls back to claude.ai/new in the browser; elsewhere the web.
export const CLAUDE_WEB_URL = 'https://claude.ai/new';
export const CLAUDE_ANDROID_INTENT =
  'intent://claude.ai/new#Intent;scheme=https;package=com.anthropic.claude;S.browser_fallback_url=https%3A%2F%2Fclaude.ai%2Fnew;end';
export const PREFILL_URL = 'https://claude.ai/new?q=';

export function claudeAppUrl(userAgent = globalThis.navigator?.userAgent || '') {
  return /Android/i.test(userAgent) ? CLAUDE_ANDROID_INTENT : CLAUDE_WEB_URL;
}

export const prefillUrl = (message) => PREFILL_URL + encodeURIComponent(message);

const optionLine = (q, letter) => `${letter}) ${q.options[LETTERS.indexOf(letter)]}`;

/**
 * Builds the message. target is one of:
 *   { kind: 'lesson', lesson }
 *   { kind: 'question', question, chosen, lesson? }    (only after the answer is submitted)
 *   { kind: 'card', card, reverse }
 * course: { name } (and the lesson gives section and chapter).
 */
export function buildAskMessage(course, target) {
  const lines = [`I'm studying with my TheHub app. Course: ${course.name}.`];
  const sectionOf = (l) => (l ? `Section: ${l.section} ${l.title} (chapter ${l.chapter})` : null);
  if (target.kind === 'lesson') {
    const l = target.lesson;
    lines.push(sectionOf(l), `Objectives: ${l.objectives.join(', ')}`, '', 'Lesson text:', clip(l.body));
  } else if (target.kind === 'question') {
    const q = target.question;
    if (target.chosen === undefined) throw new Error('Ask Claude about a question only after answering it.');
    lines.push(
      sectionOf(target.lesson),
      `Objective: ${q.objective} (${q.kLevel})`,
      '',
      `Question: ${q.stem}`,
      ...LETTERS.map((L) => optionLine(q, L)),
      '',
      `My answer: ${target.chosen ? optionLine(q, target.chosen) : '(none, time ran out)'}`,
      `Correct answer: ${optionLine(q, q.answer)}`,
      `Explanation in the app: ${q.why}`,
    );
  } else if (target.kind === 'card') {
    const c = target.card;
    const [front, back] = target.reverse ? [c.back, c.front] : [c.front, c.back];
    lines.push(`Topic: ${c.topic}`, `Flashcard front: ${front}`, `Flashcard back: ${back}`);
  } else {
    throw new Error(`unknown Ask Claude target "${target.kind}"`);
  }
  return [...lines.filter((x) => x !== null), '', ASK_END].join('\n');
}

function clip(text) {
  const t = String(text || '').trim();
  return t.length > BODY_LIMIT ? `${t.slice(0, BODY_LIMIT)}…` : t;
}

async function copyText(text, env) {
  try {
    await env.navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older WebViews: a hidden textarea and execCommand.
    try {
      const doc = env.document;
      const ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      doc.body.append(ta);
      ta.select();
      const ok = doc.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Delivers the message. Returns { method, ok, cancelled? }. env defaults to the browser; tests pass
 * { navigator, open, toast, document }.
 */
export async function deliver(message, method = DEFAULT_DELIVERY, env = {}) {
  const e = {
    navigator: env.navigator ?? globalThis.navigator,
    open: env.open ?? ((url) => globalThis.window.open(url, '_blank', 'noopener')),
    toast: env.toast ?? (() => {}),
    document: env.document ?? globalThis.document,
  };
  if (method === 'share' && typeof e.navigator?.share === 'function') {
    try {
      await e.navigator.share({ text: message });
      return { method: 'share', ok: true };
    } catch (err) {
      if (err?.name === 'AbortError') return { method: 'share', ok: false, cancelled: true };
      // Share failed for another reason: fall through to copy.
    }
  }
  if (method === 'link') {
    e.open(prefillUrl(message));
    return { method: 'link', ok: true };
  }
  const copied = await copyText(message, e);
  e.toast(copied ? 'Message copied — paste it' : 'Could not copy: select the text and copy it');
  e.open(claudeAppUrl(e.navigator?.userAgent));
  return { method: 'copy', ok: copied };
}

/**
 * The Ask Claude buttons: the main one uses the chosen delivery; "Copy instead" is the fallback.
 * makeMessage() is called on tap, so it always has the latest answer.
 */
export function askClaudeButtons({ makeMessage, delivery = DEFAULT_DELIVERY, toast, env = {} }) {
  const canShare = typeof (env.navigator ?? globalThis.navigator)?.share === 'function';
  const main = delivery === 'share' && !canShare ? 'copy' : delivery;
  const run = (method) => async () => {
    try {
      await deliver(makeMessage(), method, { toast, ...env });
    } catch (err) {
      toast?.(err.message);
    }
  };
  return h(
    'div',
    { class: 'row study-ask', 'data-testid': 'ask-claude' },
    h('button', { type: 'button', class: 'btn', 'data-testid': 'ask-claude-button', 'data-delivery': main, onclick: run(main) }, '💬 Ask Claude'),
    main !== 'copy'
      ? h('button', { type: 'button', class: 'btn', 'data-testid': 'ask-claude-copy', onclick: run('copy') }, 'Copy instead')
      : null,
  );
}

/**
 * Settings → Ask Claude: which delivery the button uses, and a test button per delivery so each can
 * be tried on the phone without a course. onChoose(id) stores the choice; toast(msg) shows results.
 */
export function askClaudeSettingsCard({ current = DEFAULT_DELIVERY, onChoose, toast, env = {} }) {
  const nav = env.navigator ?? globalThis.navigator;
  const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite', 'data-testid': 'ask-status' });
  const say = toast || ((msg) => (status.textContent = msg));
  const buttons = DELIVERIES.map((d) =>
    h(
      'button',
      {
        type: 'button',
        class: 'seg',
        'data-delivery-choice': d.id,
        'aria-pressed': String(current === d.id),
        onclick: async () => {
          await onChoose(d.id);
          buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.deliveryChoice === d.id)));
        },
      },
      d.label,
    ),
  );
  const sample = [
    "I'm studying with my TheHub app. This is a test of the Ask Claude button.",
    'If you can read this in a new chat, the delivery works.',
    '',
    ASK_END,
  ].join('\n');
  return h(
    'section',
    { class: 'card', 'data-testid': 'ask-claude-settings' },
    h('h2', {}, 'Ask Claude'),
    h('p', {}, 'How the 💬 Ask Claude button hands its message to the Claude app. "Copy instead" is always offered too.'),
    h('div', { class: 'segmented', role: 'group', 'aria-label': 'Ask Claude delivery' }, buttons),
    h(
      'p',
      { class: 'muted' },
      typeof nav?.share === 'function'
        ? 'Share sheet: pick Claude in the list. Link: an undocumented claude.ai address that may or may not fill in the message.'
        : 'This browser has no share sheet, so "Share sheet" copies the message instead. Link: an undocumented claude.ai address.',
    ),
    h('p', {}, 'Try each one:'),
    h(
      'div',
      { class: 'row' },
      DELIVERIES.map((d) =>
        h(
          'button',
          {
            type: 'button',
            class: 'btn',
            'data-testid': `ask-test-${d.id}`,
            onclick: async () => {
              const r = await deliver(sample, d.id, { toast: say, ...env });
              if (r.cancelled) say('Share cancelled.');
              else if (r.method !== d.id) say(`${d.label} is not available here: copied instead.`);
            },
          },
          `Test: ${d.label}`,
        ),
      ),
    ),
    status,
  );
}
