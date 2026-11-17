// The ISTQB CTFL v4.0 module (docs/plans/part-6-istqb.md): the v2 course, continued inside TheHub.
// Built on the shared study engine (src/core/study/README.md); this file is its config plus the
// course rules of rules.js (mocks, X/6 chapters, readiness gate, 10-day warm-up).
import { createStudyModule } from '../../core/study/index.js';
import { dueReviews, nextSessionNo } from '../../core/study/progress.js';
import { formatClock, isExpired, remainingMs } from '../../core/study/mock.js';
import { adjustSession, chaptersDone, daysSinceLastSession, mockConfigs, needsWarmup, nextStep, readiness } from './rules.js';
import { ISTQB_SCHEMA_VERSION, prepareIstqbImport } from './import.js';
import { extras, getExtras, homeCards, renderReview } from './screens.js';

export const CONTENT_BASE = 'content/istqb/';

/** Today's card: the next session, review items due, days since the last session, chapters and readiness. */
export function todayCard(data, course, objectives = extras().objectives, now = new Date()) {
  getExtras();
  if (!data) return null;
  const lines = [];
  if (data.activeMock) {
    lines.push(isExpired(data.activeMock, now) ? `${data.activeMock.label}: time is up, see your results.` : `${data.activeMock.label} in progress: ${formatClock(remainingMs(data.activeMock, now))} left.`);
  }
  const no = data.activeSession?.no ?? nextSessionNo(data);
  if (data.activeSession) lines.push(`Session ${no} in progress.`);
  else if (course && objectives.length) {
    const step = nextStep(course, data, objectives);
    if (step.kind === 'lesson') lines.push(`Next: session ${no}, ${step.lesson.section} ${step.lesson.title}`);
    else if (step.kind === 'mini-mock') lines.push(`Next: the Chapter ${step.chapter} mini-mock`);
    else if (step.kind === 'full-mock') lines.push('Next: a full mock exam (40 questions, 60 minutes)');
    else if (step.kind === 'ready') lines.push('Readiness gate met: time to book the exam.');
    else lines.push('More lessons are on the way: review your weakest objectives meanwhile.');
  }
  lines.push(`Review items due: ${dueReviews(data, no).length}`);
  const days = daysSinceLastSession(data, now);
  if (days !== null) {
    lines.push(`Last session: ${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`}${needsWarmup(data, now) && !data.activeSession ? ' · next one opens with a warm-up' : ''}`);
  }
  lines.push(`Chapters ${chaptersDone(data).length}/6 · Readiness: ${readiness(data).level}`);
  return {
    title: 'ISTQB',
    lines,
    action: { label: data.activeSession ? 'Resume session' : 'Study', route: data.activeSession ? 'istqb/session' : 'istqb' },
  };
}

/** The home screen's "today" tile: the next session and the review items due. */
export function homeTile(data) {
  if (!data) return null;
  const no = data.activeSession?.no ?? nextSessionNo(data);
  return { title: 'ISTQB', text: data.activeSession ? `Session ${no} in progress` : `Session ${no} next`, sub: `${dueReviews(data, no).length} to review`, href: data.activeSession ? '#/istqb/session' : '#/istqb' };
}

const study = createStudyModule({
  id: 'istqb',
  name: 'ISTQB',
  icon: '🧪',
  schemaVersion: ISTQB_SCHEMA_VERSION,
  contentBase: CONTENT_BASE,
  contentManifest: 'index.json',
  // The tutor prompt's session: 3–5 drill items, a short quiz, 1–2 delayed-retrieval questions,
  // re-teach below 65 % (engine defaults, Q-14).
  session: { drillSize: 4, quizSize: 5, retrievalCount: 2, passMark: 65 },
  mocks: mockConfigs(),
  cards: { newPerDay: 10 },
  handledFeedback: () => extras().handled,
  adjustSession: (session, course, data) => adjustSession(session, course, data),
  homeCards,
  // Module routes get only the screen context; the review screen also needs the course.
  routes: { review: (ctx) => renderReview(ctx, study) },
  todayCard: (data, course) => {
    study.getCourse(); // start loading the course, so the next Today render knows the next lesson
    return todayCard(data, course);
  },
});

export default {
  ...study,
  homeTile: (data) => homeTile(data),
  /** For the pet (0.9.12): each finished session or mock is a meal. */
  answers: { activities: (data) => (data.sessions || []).map((s) => ({ id: `istqb-${s.no}-${s.kind}-${s.date}`, kind: 'study', date: s.date })) },
  importers: [
    {
      id: 'notion-progress',
      title: 'Import ISTQB progress',
      description:
        'Brings in your ISTQB progress from the Claude Project tutor (Notion): pick the istqb-progress.json file a Claude Code session made for you. It holds your mastery of all 64 objectives, review items, wrong answers and session history. Importing the same file again changes nothing.',
      prepare: prepareIstqbImport,
    },
  ],
};
