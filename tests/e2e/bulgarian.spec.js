// E2E tests for the Bulgarian module (Part 7, before the book) at a phone viewport: an alphabet practice
// round, the Fridge → Bulgarian "From my home" flow, and a two-way card session. speechSynthesis is
// replaced in every test (with or without a bg-BG voice), so the result never depends on the PC's voices.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ALPHABET = JSON.parse(readFileSync(new URL('../../content/bulgarian/alphabet.json', import.meta.url), 'utf8'));

async function open(page, hash = '') {
  await page.goto(`./${hash}`);
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
}

/** Runs in the page before the app: a fake speechSynthesis with a Bulgarian voice or none. */
function fakeSpeech({ bg }) {
  const voices = bg ? [{ name: 'Test Bulgarian', lang: 'bg-BG', localService: true, default: false, voiceURI: 'test-bg' }] : [];
  window.__spoken = [];
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => voices,
      addEventListener() {},
      removeEventListener() {},
      cancel() {},
      speak(u) {
        window.__spoken.push({ text: u.text, lang: u.lang });
      },
    },
  });
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
}

test.beforeEach(async ({ context }) => {
  // The Fridge flow never needs Open Food Facts here: block it, as the Fridge tests do.
  await context.route('https://world.openfoodfacts.org/**', (route) => route.abort('blockedbyclient'));
});

test('an alphabet practice round: letter → sound, one mistake, results saved', async ({ page }) => {
  await page.addInitScript(fakeSpeech, { bg: false });
  await open(page, '#/bulgarian');
  await expect(page.getByTestId('bg-book-panel')).toContainText('Lessons start when your course book is added');
  await expect(page.getByTestId('bg-alphabet-progress')).toHaveText('Alphabet: 0/30 letters learned');

  await page.locator('.subtab', { hasText: 'Alphabet' }).click();
  await expect(page.getByTestId('bg-letter')).toHaveCount(30);
  const sht = page.locator('[data-letter="sht"]');
  await sht.locator('summary').click();
  await expect(sht).toContainText('Bulgarian Щ is simply "sht"');
  await expect(sht.getByTestId('speak')).toBeHidden(); // no bg-BG voice in this test

  await page.getByTestId('practice-to-sound').click();
  for (let i = 0; i < 10; i++) {
    await expect(page.getByTestId('practice-progress')).toHaveText(`Letter → sound · ${i + 1} of 10`);
    const prompt = await page.getByTestId('practice-prompt').textContent();
    const letter = ALPHABET.letters.find((l) => `${l.upper} ${l.lower}` === prompt);
    expect(letter, prompt).toBeTruthy();
    const choices = page.locator('[data-testid^="choice-"]');
    await expect(choices).toHaveCount(4);
    const texts = await choices.allTextContents();
    const right = texts.indexOf(letter.sound);
    expect(right).toBeGreaterThanOrEqual(0);
    const pick = i === 0 ? (right + 1) % 4 : right;
    await choices.nth(pick).click();
    await expect(page.getByTestId('practice-verdict')).toContainText(i === 0 ? 'Not quite' : 'Right');
    if (i === 0) await expect(page.getByTestId('practice-verdict')).toContainText(letter.sound);
    await expect(page.getByTestId('ask-claude')).toBeVisible();
    await page.getByTestId('practice-next').click();
  }
  await expect(page.getByTestId('practice-score')).toHaveText('9/10');

  // Saved as answered: after a reload the streak counts today.
  await page.reload();
  await expect(page.locator('html[data-ready="true"]')).toBeAttached();
  await open(page, '#/bulgarian');
  await expect(page.getByTestId('bg-streak')).toHaveText('Streak: 1 day');
  await page.locator('#nav [data-section="today"]').click();
  await expect(page.locator('[data-module="bulgarian"]')).toContainText('Alphabet: 0/30 letters learned');
  await expect(page.locator('[data-module="bulgarian"]')).toContainText('Streak: 1 day');

  // Reading practice works too.
  await open(page, '#/bulgarian/practice/reading');
  await expect(page.getByTestId('practice-progress')).toHaveText('Reading practice · 1 of 10');
  await page.getByTestId('choice-0').click();
  await expect(page.getByTestId('practice-verdict')).toBeVisible();
});

test('Fridge → Bulgarian: a word from the kitchen becomes two-way cards; a card session with 🔊', async ({ page }) => {
  await page.addInitScript(fakeSpeech, { bg: true });
  await open(page, '#/bulgarian');
  await expect(page.getByTestId('bg-home-empty')).toBeVisible();

  // Add an item in the Fridge; it asks for the Bulgarian word.
  await open(page, '#/fridge');
  await page.getByTestId('fridge-add').click();
  await page.getByTestId('fridge-name').fill('Milk');
  await page.getByTestId('fridge-save').click();
  await expect(page.getByTestId('fridge-bg-offer')).toBeVisible();
  await expect(page.getByTestId('fridge-bg-en')).toHaveValue('Milk');
  await page.getByTestId('fridge-bg-word').fill('мляко');
  await page.getByTestId('fridge-bg-add').click();
  await expect(page.getByTestId('fridge-flash')).toHaveText('Added Milk. Bulgarian card added: мляко.');

  // Offering it again (from the item's screen) is declined as a duplicate.
  await page.getByTestId('fridge-item').first().click();
  await page.getByTestId('fridge-bg-open').click();
  await page.getByTestId('fridge-bg-word').fill('Мляко');
  await page.getByTestId('fridge-bg-add').click();
  await expect(page.getByTestId('fridge-flash')).toHaveText('Мляко is already in your Bulgarian cards.');

  // The Bulgarian home shows it in "From my home", once.
  await page.locator('#nav [data-section="bulgarian"]').click();
  await expect(page.getByTestId('bg-home-word')).toHaveCount(1);
  await expect(page.getByTestId('bg-home-word')).toContainText('мляко — Milk');
  await expect(page.getByTestId('bg-words-learned')).toHaveText('Words learned: 0 of 1');
  await expect(page.getByTestId('bg-cards-link')).toHaveText('Cards (2 due)');

  // A card session: Bulgarian → English, then English → Bulgarian, each scheduled on its own.
  await page.getByTestId('bg-cards-link').click();
  await expect(page.getByTestId('cards-left')).toHaveText('2 to go · food');
  await expect(page.getByTestId('card-front')).toHaveText('мляко');
  await expect(page.getByTestId('card-front')).toHaveAttribute('lang', 'bg');
  const speak = page.getByTestId('flashcard').getByTestId('speak');
  await expect(speak).toBeVisible(); // the mocked bg-BG voice
  await speak.click();
  expect(await page.evaluate(() => window.__spoken)).toEqual([{ text: 'мляко', lang: 'bg-BG' }]);
  await page.getByTestId('card-show').click();
  await expect(page.getByTestId('card-back')).toHaveText('Milk');
  await page.getByTestId('grade-good').click();

  await expect(page.getByTestId('cards-left')).toHaveText('1 to go · food · reverse');
  await expect(page.getByTestId('card-front')).toHaveText('Milk');
  await expect(page.getByTestId('flashcard').getByTestId('speak')).toHaveCount(0); // English side
  await page.getByTestId('card-show').click();
  await expect(page.getByTestId('card-back')).toHaveText('мляко');
  await expect(page.getByTestId('flashcard').getByTestId('speak')).toBeVisible();
  await page.getByTestId('grade-good').click();
  await expect(page.getByTestId('cards-done')).toContainText('All done for today');

  await page.locator('.subtab', { hasText: 'Home' }).click();
  await expect(page.getByTestId('bg-words-learned')).toHaveText('Words learned: 1 of 1');
  await expect(page.getByTestId('bg-cards-link')).toHaveText('Cards (0 due)');
  await expect(page.getByTestId('bg-streak')).toHaveText('Streak: 1 day');

  // Settings → Diagnostics reports the voice.
  await open(page, '#/settings');
  await expect(page.getByTestId('diag-voice-bg')).toHaveText('Speech voice bg-BG: available (Test Bulgarian, bg-BG).');
});

test('Diagnostics without a Bulgarian voice', async ({ page }) => {
  await page.addInitScript(fakeSpeech, { bg: false });
  await open(page, '#/settings');
  await expect(page.getByTestId('diag-voice-bg')).toHaveText('Speech voice bg-BG: not available (the 🔊 buttons stay hidden).', { timeout: 5000 });
});

test('every Bulgarian screen fits the phone width and has 48 px touch targets', async ({ page }) => {
  await page.addInitScript(fakeSpeech, { bg: true });
  for (const hash of ['#/bulgarian', '#/bulgarian/alphabet', '#/bulgarian/practice/to-letter', '#/bulgarian/practice/reading', '#/bulgarian/cards', '#/bulgarian/feedback']) {
    await open(page, hash);
    await expect(page.locator('#screen .subtabs')).toBeVisible();
    if (hash === '#/bulgarian/alphabet') await page.locator('[data-letter="schwa"] summary').click();
    if (hash.includes('practice')) await page.getByTestId('choice-0').click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, hash).toBeLessThanOrEqual(0);
    const targets = page.locator('#screen .btn, #screen .subtab, #screen .option, #screen summary');
    const count = await targets.count();
    for (let i = 0; i < count; i++) {
      const box = await targets.nth(i).boundingBox();
      if (!box) continue;
      expect(box.height, `${hash}: ${await targets.nth(i).textContent()}`).toBeGreaterThanOrEqual(48);
      expect(box.width, `${hash}: ${await targets.nth(i).textContent()}`).toBeGreaterThanOrEqual(48);
    }
  }
});
