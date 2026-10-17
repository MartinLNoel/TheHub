// E2E for the ISTQB module at a phone viewport, with the real shipped content (content/istqb/):
// import of progress (a SYNTHETIC Notion-shaped fixture, converted the way scripts/istqb-import.mjs
// does), a session, a chapter mini-mock and a full mock. The bank grows with each content run, so
// the tests read how many questions there are instead of assuming a number.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { convertNotionExtract } from '../../scripts/istqb-import.mjs';
import { buildBackup } from '../../src/core/transfer.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const MANIFEST = read('../../content/istqb/index.json');
const QUESTIONS = MANIFEST.questions.flatMap((f) => read(`../../content/istqb/${f}`));
const OBJECTIVES = read('../../content/istqb/objectives.json');
const SYNTHETIC = read('../fixtures/istqb-notion.synthetic.json');

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

async function importSynthetic(page) {
  const { data, problems } = convertNotionExtract(SYNTHETIC, OBJECTIVES);
  expect(problems).toEqual([]);
  const file = await buildBackup({ modules: { istqb: { schemaVersion: 1, data } }, appVersion: 'test' });
  await open(page, '#/settings');
  await page.getByTestId('import-istqb-notion-progress').setInputFiles({ name: 'istqb-progress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(page.getByTestId('module-import-summary')).toContainText('Sessions: 3 (last: session 3, 2026-01-09)');
  await expect(page.getByTestId('module-import-summary')).toContainText('Chapters done: 1/6');
  await page.getByTestId('module-import-apply').click();
  await expect(page.getByTestId('module-import-done')).toBeVisible();
}

test.describe('just after local midnight (Q-18)', () => {
  // Pinned to Amsterdam and 00:20 on 18 October 2026 (22:20 UTC on the 17th): the hour where a UTC
  // date and the local date disagree. The run's result no longer depends on the machine's clock.
  test.use({ timezoneId: 'Europe/Amsterdam' });
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-17T22:20:00Z'));
  });

  test('import progress, then a session: warm-up rule, lesson 3.1, quiz, debrief', async ({ page }) => {
    await open(page, '#/istqb');
    await expect(page.getByTestId('istqb-chapters')).toHaveText('Chapters 0/6');
    await expect(page.getByTestId('istqb-readiness')).toContainText('Readiness: Not Ready');

    await importSynthetic(page);
    await open(page, '#/istqb');
    await expect(page.getByTestId('istqb-chapters')).toHaveText('Chapters 1/6');
    await expect(page.getByTestId('istqb-readiness')).toContainText('Readiness: Building');
    await expect(page.getByTestId('istqb-next')).toHaveText('Next: session 4, Chapter 3 §3.1 Static testing basics');
    // The fixture's last session is long ago: the warm-up note shows.
    await expect(page.getByTestId('istqb-gap')).toContainText('the next session opens with a 5-question warm-up');
    await expect(page.getByTestId('istqb-review-link')).toHaveText('Wrong answers (3)');

    // Today shows the ISTQB card.
    await open(page, '#/today');
    await expect(page.locator('[data-module="istqb"]')).toContainText('Chapters 1/6 · Readiness: Building');

    await open(page, '#/istqb');
    await page.getByTestId('study-start').click();
    await expect(page).toHaveURL(/#\/istqb\/session$/);
    // Warm-up questions come first only when there are questions on studied objectives (Chapter 1
    // questions arrive in a later content run); then the lesson.
    const progress = page.getByTestId('session-progress');
    while ((await progress.textContent()).includes('Warm-up')) {
      await page.getByTestId(`option-${await answerFor(page)}`).click();
      await page.getByTestId('q-submit').click();
      await page.getByTestId('session-next').click();
    }
    await expect(progress).toContainText('Session 4 · Step');
    await expect(progress).toContainText('Lesson');
    await expect(page.getByTestId('lesson')).toContainText('What static testing is');
    await expect(page.getByTestId('objective-chips')).toContainText('FL-3.1.1 · K1');
    await page.getByTestId('session-next').click();

    let answered = 0;
    // Wait for the next screen (a question or the debrief) before deciding whether to go on.
    const nextScreen = () => page.getByTestId('q-submit').or(page.getByTestId('session-debrief')).first();
    while ((await nextScreen().getAttribute('data-testid')) === 'q-submit') {
      await expect(progress).toContainText('Quiz');
      await expect(page.getByTestId('q-why')).toHaveCount(0);
      const right = await answerFor(page);
      await page.getByTestId(`option-${right}`).click();
      await page.getByTestId('q-submit').click();
      await expect(page.getByTestId('q-verdict')).toContainText('Correct');
      answered++;
      await page.getByTestId('session-next').click();
    }
    expect(answered).toBe(5);
    await expect(page.getByTestId('debrief-score')).toHaveText('5/5 (100 %)');
    await page.getByTestId('debrief-done').click();
    await expect(page.getByTestId('istqb-gap')).toHaveText('Last session: today.');
  });
});

test('the Chapter 3 mini-mock and the full mock run, time and score', async ({ page }) => {
  for (const [id, label] of [['mini-3', 'Chapter 3 mini-mock'], ['full', 'Full mock exam']]) {
    await open(page, '#/istqb');
    await page.locator('#screen .subtab', { hasText: 'Mocks' }).click();
    await expect(page.getByTestId('mock-list')).toContainText(label);
    await page.getByTestId(`mock-start-${id}`).click();
    await expect(page.getByTestId('mock-clock')).toHaveText(id === 'full' ? /^(1:00:00|59:5\d)$/ : /^(15:00|14:5\d)$/);
    const total = Number(/of (\d+)/.exec(await page.getByTestId('mock-progress').textContent())[1]);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(id === 'full' ? 40 : 10);
    for (let i = 0; i < total; i++) {
      await expect(page.getByTestId('mock-progress')).toContainText(`Question ${i + 1} of ${total}`);
      await page.getByTestId(`option-${await answerFor(page)}`).click();
      await expect(page.getByTestId('q-verdict')).toHaveCount(0);
      if (i < total - 1) await page.getByTestId('mock-next').click();
    }
    await page.getByTestId('mock-submit').click();
    await expect(page.getByTestId('mock-score')).toHaveText(`${total}/${total} (100 %)`);
    await expect(page.getByTestId('mock-debrief')).toContainText('By chapter');
  }
  // A short full mock (bank not complete) never meets the readiness gate.
  await open(page, '#/istqb');
  await expect(page.getByTestId('istqb-readiness')).toContainText('none yet');
});

test('wrong-answer review shows imported answers with their text, and the ISTQB screens fit the phone', async ({ page }) => {
  await importSynthetic(page);
  await open(page, '#/istqb/review');
  await expect(page.getByTestId('legacy-wrong')).toHaveCount(3);
  await expect(page.getByTestId('legacy-wrong').first()).toContainText('Synthetic mock question?');
  for (const hash of ['#/istqb', '#/istqb/review', '#/istqb/lesson/3.1', '#/istqb/mock', '#/istqb/cards']) {
    await open(page, hash);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), hash).toBeLessThanOrEqual(0);
    for (const loc of await page.locator('#screen .btn, #screen .subtab, #screen summary').all()) {
      const box = await loc.boundingBox();
      if (box) expect(box.height, `${hash}: ${await loc.textContent()}`).toBeGreaterThanOrEqual(48);
    }
  }
});

test('the Study shortcut opens the ISTQB course', async ({ page }) => {
  await open(page, '#/istqb');
  await expect(page.getByTestId('study-home')).toHaveAttribute('data-module', 'istqb');
});
