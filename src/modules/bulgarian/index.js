// The Bulgarian module (docs/plans/part-7-bulgarian.md), built before the course book (Q-4): the alphabet
// trainer, reading practice, two-way cards and the "From my home" deck the Fridge fills through hub.offer.
// It is a study module on the shared engine (src/core/study/README.md): the engine gives the cards
// (each direction scheduled on its own), Ask Claude and Feedback; this file is its config. Lessons,
// vocabulary and chapter quizzes follow the book once it is added (docs/bulgarian-content-guide.md).
import { createStudyModule } from '../../core/study/index.js';
import { dueSides, localDate } from '../../core/study/scheduler.js';
import { speakButton } from '../../core/speech.js';
import { SCHEMA_VERSION, acceptOffer, migrations, extendDefault, lettersLearned, markActivity, streak, validateExtra } from './data.js';
import { BASE, MANIFEST, getTrainer, trainer } from './content.js';
import { withLessonsTab } from './screens.js';
import { wordOfDayWidget } from './word-of-day.js';
import { CARDS, ID, NAME, TABS, VOICE, feedbackTitle, renderAlphabet, renderHome, renderPractice } from './screens.js';

/** Today's card: cards due (course and home deck), alphabet progress and the streak. */
export function todayCard(data, course, letters = trainer().alphabet.letters, now = new Date()) {
  if (!data) return null;
  const today = localDate(now);
  const cards = [...(course?.cards || []), ...data.homeDeck];
  const due = dueSides(cards, data.cardState, today, CARDS).length;
  const total = letters.length || 30;
  const learned = lettersLearned(data, letters);
  const days = streak(data, today);
  const lines = [`Cards due: ${due}`, `Alphabet: ${learned}/${total} letters learned`];
  if (days) lines.push(`Streak: ${days} day${days === 1 ? '' : 's'}`);
  let action = { label: 'Open', route: ID };
  if (due) action = { label: 'Review cards', route: `${ID}/cards` };
  else if (learned < total) action = { label: 'Practise letters', route: `${ID}/alphabet` };
  return { title: NAME, lines, action };
}

/** The word of the day from the reading words: the same word all day, the next one tomorrow. */
export function wordOfTheDay(words, now = new Date()) {
  if (!words.length) return null;
  const [y, m, d] = localDate(now).split('-').map(Number);
  const day = Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
  return words[day % words.length];
}

const pickWord = (t, now) => {
  const word = wordOfTheDay(t.reading, now);
  return word ? { word, letters: t.alphabet.letters } : null;
};

/**
 * The home screen's word of the day under "Today" (0.9.14; it was a tile in the strip in 0.9.11): a quiz card
 * (word-of-day.js). The reading words load in the background the first time.
 */
export function todayWidget(ctx, { now = () => new Date() } = {}) {
  return wordOfDayWidget(ctx, {
    getWord: () => pickWord(trainer(), now()),
    load: () => getTrainer().then((t) => pickWord(t, now())),
    contentCards: () => loadedCards,
    voice: VOICE,
    now,
  });
}

// The course's own cards, once loaded, so accept() also declines a word the course already teaches.
let loadedCards = [];
let warming = null;
function warm() {
  if (!warming) {
    warming = study.getCourse().then(({ course }) => {
      loadedCards = course.cards;
      withLessonsTab(course); // the Lessons tab appears once the book's first chapter is written
    });
  }
  getTrainer();
}

const study = createStudyModule({
  id: ID,
  name: NAME,
  icon: '🇧🇬',
  schemaVersion: SCHEMA_VERSION,
  migrations,
  contentBase: BASE,
  contentManifest: MANIFEST,
  cards: CARDS,
  tabs: TABS,
  extendDefault,
  validateExtra,
  extraCards: (d) => d.homeDeck || [],
  // The 🔊 button under every Bulgarian side of a card, shown only when the phone has a bg-BG voice.
  cardExtras: ({ text, lang }) => (lang && lang.startsWith('bg') ? speakButton(text, VOICE) : null),
  onCardGraded: (d, { today }) => markActivity(d, today),
  feedbackTitle: (f) => feedbackTitle(f, trainer()),
  handledFeedback: () => trainer().handled,
  routes: {
    '': (ctx) => (warm(), renderHome(ctx, study)),
    alphabet: (ctx) => (warm(), renderAlphabet(ctx)),
    'practice/*': (ctx) => (warm(), renderPractice(ctx)),
  },
  todayCard: (data, course) => {
    warm(); // start loading, so the next Today render knows the course and the alphabet
    return todayCard(data, course);
  },
});

export default {
  ...study,
  todayWidget: (ctx) => todayWidget(ctx),
  /** For the pet (0.9.12): each day of practice is a meal. */
  answers: { activities: (data) => (data.activity || []).map((date) => ({ id: `bg-${date}`, kind: 'bulgarian', date })) },
  // hub.offer('bulgarian', { bg, en, topic }): a word from another module (the Fridge) becomes a two-way
  // card in the "From my home" deck; null (declined) when it is already a card.
  accept: (item, data) => acceptOffer(item, data, { contentCards: loadedCards }),
};
