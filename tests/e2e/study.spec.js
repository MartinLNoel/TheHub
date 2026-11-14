// E2E tests for the study engine at a phone viewport, with the SAMPLE course (tests/fixtures/
// sample-course, added only to the test build as the "sample" module): a whole session, stopping
// halfway and resuming, a 5-question timed mock, feedback, and Ask Claude.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const QUESTIONS = JSON.parse(readFileSync(new URL('../fixtures/sample-course/questions.json', import.meta.url), 'utf8'));
const answerFor = async (page) => {
  const stem = await page.getByTestId('q-stem').textContent();
  const q = QUESTIONS.find((x) => x.stem === stem);
  if (!q) throw new Error(`unknown stem ${stem}`);
  return q.answer;
};

async function open(page, hash = '') {
  await page.goto(`./${hash}`);
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
}

test.beforeEach(async ({ page }) => {
  // A share sheet that records what it was given (the real one is tested on Martin's phone, Q-13).
  await page.addInitScript(() => {
    window.__shared = [];
    window.__opened = [];
    navigator.share = async (data) => {
      window.__shared.push(data);
    };
    window.open = (url) => {
      window.__opened.push(url);
      return null;
    };
  });
});

/** Answers the current question (correctly unless wrong=true) and goes on. */
async function answer(page, { wrong = false } = {}) {
  await expect(page.getByTestId('q-submit')).toBeVisible(); // a new, unanswered question is showing
  const right = await answerFor(page);
  const pick = wrong ? ['A', 'B', 'C', 'D'].find((l) => l !== right) : right;
  await page.getByTestId(`option-${pick}`).click();
  await page.getByTestId('q-submit').click();
  await expect(page.getByTestId('q-verdict')).toContainText(wrong ? 'Not quite' : 'Correct');
}

test('a sample session end to end: lesson, quiz, debrief, next pointer', async ({ page }) => {
  await open(page, '#/sample');
  await expect(page.getByTestId('study-session-card')).toContainText('Next lesson: 1.1 The Sun');
  await page.getByTestId('study-start').click();
  await expect(page).toHaveURL(/#\/sample\/session$/);
  await expect(page.getByTestId('session-progress')).toHaveText('Session 1 · Step 1 of 4 · Lesson');
  await expect(page.getByTestId('lesson')).toContainText('A star nearby');
  await expect(page.getByTestId('objective-chips')).toContainText('S-1.1 · K1');
  await page.getByTestId('session-next').click();

  for (let i = 0; i < 3; i++) {
    await expect(page.getByTestId('session-progress')).toContainText(`Step ${i + 2} of 4 · Quiz`);
    // Before submitting: no verdict, no explanation.
    await expect(page.getByTestId('q-why')).toHaveCount(0);
    await expect(page.getByTestId('ask-claude')).toHaveCount(0);
    await answer(page, { wrong: i === 0 });
    await expect(page.getByTestId('q-why')).toBeVisible();
    await page.getByTestId('session-next').click();
  }
  await expect(page.getByTestId('debrief-score')).toHaveText('2/3 (67 %)');
  await expect(page.getByTestId('session-debrief')).toContainText('On pace');
  await expect(page.getByTestId('debrief-changes')).toContainText('S-1.1: untested → shaky');
  await expect(page.getByTestId('debrief-next')).toHaveText('Next session: 1.2 The inner planets');
  await page.getByTestId('debrief-done').click();

  await expect(page.getByTestId('study-session-card')).toContainText('Session 2');
  await expect(page.getByTestId('study-session-card')).toContainText('Review items due: 1');
  await page.locator('#nav [data-section="today"]').click();
  await expect(page.locator('[data-module="sample"]')).toContainText('Next: 1.2 The inner planets');

  // Session 2 opens with the drill on the question answered wrong.
  await open(page, '#/sample');
  await page.getByTestId('study-start').click();
  await expect(page.getByTestId('session-progress')).toContainText('Session 2 · Step 1 of');
  await expect(page.getByTestId('session-progress')).toContainText('Review drill');
});

test('stop halfway, reload, and resume where it stopped', async ({ page }) => {
  await open(page, '#/sample');
  await page.getByTestId('study-start').click();
  await page.getByTestId('session-next').click();
  await answer(page);
  const stem = await page.getByTestId('q-stem').textContent();
  await page.getByTestId('session-stop').click();
  await expect(page.getByTestId('study-session-card')).toContainText('Session 1 in progress');

  await page.reload();
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
  await expect(page.locator('[data-testid="study-session-card"]')).toContainText('Step 2 of 4');
  await page.getByTestId('study-resume').click();
  // The answered question comes back answered (never twice), then the session carries on.
  await expect(page.getByTestId('q-stem')).toHaveText(stem);
  await expect(page.getByTestId('q-verdict')).toContainText('Correct');
  await expect(page.getByTestId('q-submit')).toHaveCount(0);
  await page.getByTestId('session-next').click();
  await answer(page);
  await page.getByTestId('session-next').click();
  await answer(page);
  await page.getByTestId('session-next').click();
  await expect(page.getByTestId('debrief-score')).toHaveText('3/3 (100 %)');
});

test('a 5-question timed mock: no feedback until the end, then a per-objective debrief', async ({ page }) => {
  await open(page, '#/sample/mock');
  await page.getByTestId('mock-start-quick').click();
  await expect(page.getByTestId('mock-progress')).toContainText('Question 1 of 5');
  await expect(page.getByTestId('mock-clock')).toHaveText(/^(5:00|4:5\d)$/);

  const answers = [];
  for (let i = 0; i < 5; i++) {
    await expect(page.getByTestId('mock-progress')).toContainText(`Question ${i + 1} of 5`);
    const right = await answerFor(page);
    const pick = i < 3 ? right : ['A', 'B', 'C', 'D'].find((l) => l !== right);
    answers.push(pick === right);
    await page.getByTestId(`option-${pick}`).click();
    await expect(page.getByTestId(`option-${pick}`)).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('q-verdict')).toHaveCount(0);
    await expect(page.getByTestId('q-why')).toHaveCount(0);
    if (i < 4) await page.getByTestId('mock-next').click();
  }
  await expect(page.getByTestId('mock-progress')).toContainText('5 answered');

  // Reload mid-mock: the clock carries on from the timestamps.
  await page.reload();
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
  await page.goto('./#/sample/mock');
  await expect(page.getByTestId('mock-run')).toBeVisible();
  await expect(page.getByTestId('mock-clock')).toHaveText(/^4:[0-5]\d$/);

  await page.getByTestId('mock-submit').click();
  await expect(page.getByTestId('mock-score')).toHaveText('3/5 (60 %)');
  await expect(page.getByTestId('mock-by-objective').locator('tr')).not.toHaveCount(0);
  await expect(page.getByTestId('mock-debrief').getByTestId('q-why')).toHaveCount(5);
});

test('a mock ends by itself when the time is up, even with the screen off', async ({ page }) => {
  await page.clock.install();
  await open(page, '#/sample/mock');
  await page.getByTestId('mock-start-quick').click();
  await page.getByTestId('option-A').click();
  // Five minutes pass without the page ticking (as when the phone is locked).
  await page.clock.fastForward('05:01');
  await expect(page.getByTestId('mock-debrief')).toBeVisible();
  await expect(page.getByTestId('mock-debrief')).toContainText('Time ran out.');
});

test('leave feedback on a lesson and see it in the Feedback list', async ({ page }) => {
  await open(page, '#/sample/lesson/s-1-2');
  await expect(page.getByTestId('lesson')).toContainText('Rocky worlds');
  await page.getByTestId('feedback-button').click();
  await page.getByTestId('feedback-text').fill('Add the dwarf planet Ceres?');
  await page.getByTestId('feedback-save').click();
  await expect(page.locator('#study-toast')).toHaveText('Feedback saved');

  await page.goto('./#/sample/feedback');
  const open1 = page.getByTestId('feedback-open');
  await expect(open1.getByTestId('feedback-item')).toHaveCount(1);
  await expect(open1).toContainText('Lesson 1.2 The inner planets');
  await expect(open1).toContainText('Add the dwarf planet Ceres?');
  await open1.getByTestId('feedback-toggle').click();
  await expect(page.getByTestId('feedback-resolved')).toContainText('Add the dwarf planet Ceres?');
  await expect(page.getByTestId('feedback-open')).toHaveCount(0);

  // It is part of the module's data, so it is in exports and backups.
  await page.reload();
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
  await expect(page.getByTestId('feedback-resolved')).toContainText('Add the dwarf planet Ceres?');
});

test('Ask Claude after answering: share sheet by default, "Copy instead" copies and opens Claude', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, '#/sample');
  await page.getByTestId('study-start').click();
  await page.getByTestId('session-next').click();
  await answer(page, { wrong: true });
  await page.getByTestId('ask-claude-button').click();
  const shared = await page.evaluate(() => window.__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0].text).toContain('Course: Sample course.');
  expect(shared[0].text).toContain('Objective: S-1.1');
  expect(shared[0].text).toContain('Correct answer:');
  expect(shared[0].text.endsWith('My question: ')).toBe(true);

  await page.getByTestId('ask-claude-copy').click();
  await expect(page.locator('#study-toast')).toHaveText('Message copied — paste it');
  // (The Windows clipboard turns \n into \r\n.)
  expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n')).toBe(shared[0].text);
  expect(await page.evaluate(() => window.__opened)).toEqual(['https://claude.ai/new']);
});

test('Settings → Ask Claude: choose the delivery and test each one', async ({ page }) => {
  await open(page, '#/settings');
  const card = page.getByTestId('ask-claude-settings');
  await expect(card.locator('[data-delivery-choice="share"]')).toHaveAttribute('aria-pressed', 'true');
  await card.getByTestId('ask-test-share').click();
  expect((await page.evaluate(() => window.__shared))[0].text).toContain('test of the Ask Claude button');
  await card.getByTestId('ask-test-link').click();
  expect((await page.evaluate(() => window.__opened))[0]).toMatch(/^https:\/\/claude\.ai\/new\?q=I'm%20studying/);
  await card.locator('[data-delivery-choice="link"]').click();
  // The button shows the choice only once it is saved: wait for that before reloading, or a slow runner reloads
  // first and the choice is lost (the first GitHub run failed this way, 2026-11-14).
  await expect(card.locator('[data-delivery-choice="link"]')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
  await expect(page.getByTestId('ask-claude-settings').locator('[data-delivery-choice="link"]')).toHaveAttribute('aria-pressed', 'true');
});

test('flashcards: Cyrillic shows large and both directions come up', async ({ page }) => {
  await open(page, '#/sample/cards');
  await expect(page.getByTestId('card-front')).toHaveText('Здравей');
  await expect(page.getByTestId('card-front')).toHaveAttribute('lang', 'bg');
  const size = await page.getByTestId('card-front').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(28);
  await page.getByTestId('card-show').click();
  await expect(page.getByTestId('card-back')).toHaveText('Hello');
  await page.getByTestId('grade-good').click();
  await expect(page.getByTestId('card-front')).toHaveText('Hello');
  await expect(page.getByTestId('cards-left')).toContainText('reverse');
});

test('every study screen fits the phone width and has 48 px touch targets', async ({ page }) => {
  for (const hash of ['#/sample', '#/sample/lessons', '#/sample/lesson/s-1-1', '#/sample/cards', '#/sample/mock', '#/sample/feedback']) {
    await open(page, hash);
    await expect(page.locator('#screen .subtabs')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, hash).toBeLessThanOrEqual(0);
    const targets = page.locator('#screen .btn, #screen .subtab, #screen .option, #screen .lesson-link, #screen summary');
    const count = await targets.count();
    for (let i = 0; i < count; i++) {
      const box = await targets.nth(i).boundingBox();
      if (!box) continue;
      expect(box.height, `${hash}: ${await targets.nth(i).textContent()}`).toBeGreaterThanOrEqual(48);
    }
  }
  // The question and mock screens.
  await open(page, '#/sample');
  await page.getByTestId('study-start').click();
  await page.getByTestId('session-next').click();
  await expect(page.getByTestId('q-submit')).toBeVisible();
  for (const loc of await page.locator('#screen .option, #screen .btn').all()) {
    const box = await loc.boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(48);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
