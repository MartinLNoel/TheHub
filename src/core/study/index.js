// The study engine's entry point: createStudyModule(config) returns a module object that follows
// the module contract (docs/plans/part-0-overview.md). ISTQB (Part 6) and Bulgarian (Part 7) are
// both made with it; how to use it is in src/core/study/README.md.
import { checkCourse, loadCourse } from './content.js';
import { defaultProgress, dueReviews, nextSessionNo, validateProgress } from './progress.js';
import { nextLesson } from './session.js';
import { dueSides, localDate } from './scheduler.js';
import { formatClock, isExpired, remainingMs } from './mock.js';
import { renderCards, renderFeedback, renderHome, renderLesson, renderLessons, renderMock, renderSession } from './screens.js';

export { buildAskMessage, deliver } from './ask-claude.js';
export { checkCourse, loadCourse } from './content.js';

/**
 * config:
 *   id, name, icon                 as in the module contract
 *   content                        { lessons, questions, cards } given directly, or
 *   contentBase                    a folder URL relative to the app, e.g. 'content/istqb/'
 *   schemaVersion, migrations      default 1, {} (the module's own versions)
 *   extendDefault(data)            adds module-specific fields to the default progress
 *   validateExtra(data)            problems with those fields
 *   session                        { drillSize, quizSize, retrievalCount, passMark } (session.js)
 *   mocks                          [{ id, label, kind, count?, minutes, perChapter?, chapters? }]
 *   cards                          { newPerDay } (scheduler.js)
 *   extraCards(data)               cards kept in the progress (e.g. offered by another module)
 *   handledFeedback                feedback ids the content loop has handled (list or function)
 *   routes                         extra or replacement routes, merged over the engine's
 *   todayCard(data, course)        replaces the default Today card (course may be null while loading)
 */
export function createStudyModule(config) {
  let loading = null;
  let loaded = null;
  const getCourse = () => {
    if (!loading) {
      loading = config.content
        ? Promise.resolve(checkCourse(config.content))
        : loadCourse(new URL(config.contentBase, globalThis.document?.baseURI ?? globalThis.location?.href).href);
      loading.then((c) => (loaded = c));
    }
    return loading;
  };

  const env = {
    id: config.id,
    name: config.name,
    config,
    getCourse,
    allCards: (course, data) => [...course.cards, ...(config.extraCards ? config.extraCards(data) : [])],
    handled: () => (typeof config.handledFeedback === 'function' ? config.handledFeedback() : config.handledFeedback || []),
  };
  const route = (fn) => (ctx) => fn(ctx, env);

  function defaultTodayCard(data) {
    getCourse();
    if (!data) return null;
    const course = loaded?.course;
    const lines = [];
    if (data.activeMock) {
      lines.push(isExpired(data.activeMock) ? `${data.activeMock.label}: time is up, see your results.` : `${data.activeMock.label} in progress: ${formatClock(remainingMs(data.activeMock))} left.`);
    }
    if (data.activeSession) lines.push(`Session ${data.activeSession.no} in progress.`);
    else if (course) {
      const lesson = nextLesson(course, data);
      lines.push(lesson ? `Next: ${lesson.section} ${lesson.title}` : 'All lessons done: review your weakest objectives.');
    }
    lines.push(`Review items due: ${dueReviews(data, data.activeSession?.no ?? nextSessionNo(data)).length}`);
    if (course) {
      const cards = env.allCards(course, data);
      if (cards.length) lines.push(`Cards due: ${dueSides(cards, data.cardState, localDate(), config.cards).length}`);
    }
    return {
      title: config.name,
      lines,
      action: { label: data.activeSession ? 'Resume session' : 'Study', route: data.activeSession ? `${config.id}/session` : config.id },
    };
  }

  return {
    id: config.id,
    name: config.name,
    icon: config.icon,
    study: true,
    schemaVersion: config.schemaVersion ?? 1,
    migrations: config.migrations ?? {},
    defaultData: () => (config.extendDefault ? config.extendDefault(defaultProgress()) : defaultProgress()),
    validate: (data) => [...validateProgress(data), ...(config.validateExtra && data ? config.validateExtra(data) : [])],
    routes: {
      '': route(renderHome),
      session: route(renderSession),
      lessons: route(renderLessons),
      'lesson/*': route(renderLesson),
      mock: route(renderMock),
      cards: route(renderCards),
      feedback: route(renderFeedback),
      ...(config.routes || {}),
    },
    todayCard: config.todayCard ? (data) => config.todayCard(data, loaded?.course ?? null) : defaultTodayCard,
    getCourse,
  };
}
