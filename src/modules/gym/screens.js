// The Gym screens, ported from gainz-tracker's render functions (renderToday, renderLog,
// renderFighter, renderNutrition, renderCheckin) into TheHub's shell and theme. Same content and
// rules; built with h() instead of HTML strings, so stored text is always shown as text.
import { h, mount } from '../../core/dom.js';
import { DEMOS, demoFigure, demoVideoUrl } from './demos.js';
import { SEASON_1 } from './story/season1.js';
import { stageCanvas } from './story/render.js';
import { cachedReading, currentReading, describe, sceneEnv } from './story/weather.js';
import { QUICK_FOODS, STAGES } from './program.js';
import {
  activeProgram, addCheckIn, addMyFood, addProtein, checkinThisWeek, currentDayName, currentStage, deleteMyFood, fmtTime,
  formatDate, getStreak, initExInputs, isHomePlan, logWorkout, nextStage, proteinTarget, removeProtein, sessionsThisWeek,
  sessionsUntilPhase2, setBodyweight, setProgram, targetSessions, todayProtein, todayProteinLog, toggleOfficeDay, upgradePhase,
  weekStatus, workoutFor, currentStep, ladderOf, pbKey, readyToMoveUp, stepName,
} from './logic.js';

// Screen state that is not stored (as in gainz-tracker: it lives until the app closes).
let sessionMode = 'gym'; // 'gym' or 'home'
let sessionInputs = {}; // { exerciseName: [{ weight, reps }] }
let sessionKey = ''; // day + mode the inputs belong to
let sessionSteps = {}; // { exerciseName: ladder step } chosen on screen, not saved until logged
let selectedRestTime = 60;
let restInterval = null;
let previewStageId = null; // null = show the current stage

/** Resets the screen state (tests). */
export function resetScreenState() {
  sessionMode = 'gym';
  sessionInputs = {};
  sessionKey = '';
  sessionSteps = {};
  selectedRestTime = 60;
  previewStageId = null;
  if (restInterval) clearInterval(restInterval);
  restInterval = null;
}

const SUBNAV = [
  { route: '', href: '#/gym', label: 'Workout' },
  { route: 'history', href: '#/gym/history', label: 'History' },
  { route: 'fighter', href: '#/gym/fighter', label: 'Fighter' },
  { route: 'protein', href: '#/gym/protein', label: 'Protein' },
  { route: 'checkin', href: '#/gym/checkin', label: 'Check-in' },
];

// --- small shared pieces ---

function overlay(id, className) {
  let el = document.getElementById(id);
  if (!el) {
    el = h('div', { id, class: className, role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  return el;
}

let toastTimer = null;
export function showToast(msg) {
  const t = overlay('gym-toast', 'gym-toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

function startRestTimer(secs = 90) {
  if (restInterval) clearInterval(restInterval);
  const el = overlay('gym-rest-timer', 'gym-rest-timer');
  const timeEl = h('div', { class: 'gym-rest-time', 'data-testid': 'gym-rest-time' }, fmtTime(secs));
  mount(el, timeEl, h('div', { class: 'gym-rest-label' }, 'REST'));
  el.classList.add('active');
  let remaining = secs;
  restInterval = setInterval(() => {
    remaining--;
    timeEl.textContent = fmtTime(remaining);
    if (remaining <= 0) {
      clearInterval(restInterval);
      restInterval = null;
      el.classList.remove('active');
      showToast('REST DONE — GO!');
    }
  }, 1000);
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  children.forEach((c) => el.append(c));
  return el;
}

function progressBar(pct) {
  return h('div', { class: 'gym-progress' }, h('div', { class: 'gym-progress__fill', style: `width:${pct}%` }));
}

function sectionHeader(text) {
  return h('h3', { class: 'gym-section' }, text);
}

/** The strip above every Gym screen: date, week streak, sessions this week, and the sub-nav. */
function frame(ctx, active, ...content) {
  const now = new Date();
  const streak = getStreak(ctx.data, now);
  return h(
    'div',
    { class: 'gym', 'data-testid': `gym-${active || 'workout'}` },
    h(
      'div',
      { class: 'gym-head' },
      h('div', { class: 'gym-head__date' }, now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()),
      h(
        'div',
        { class: 'gym-head__week', 'data-testid': 'gym-week' },
        h('span', { class: 'gym-head__streak' }, streak > 0 ? `${streak} WK 🔥` : 'THIS WEEK'),
        h('strong', {}, `${sessionsThisWeek(ctx.data, now)}/${targetSessions(ctx.data)}`),
      ),
    ),
    h(
      'nav',
      { class: 'gym-tabs', 'aria-label': 'Gym' },
      SUBNAV.map((t) =>
        h('a', { href: t.href, class: 'gym-tab', 'aria-current': t.route === active ? 'page' : null }, t.label),
      ),
    ),
    ctx.readOnly ? h('p', { class: 'card card--warn' }, 'Read-only until the app updates: nothing can be saved.') : null,
    content,
  );
}

/**
 * Wraps the route context: commit(next) saves and re-renders the same screen; a failed save shows
 * the reason and keeps the old data.
 */
function screen(renderFn, active) {
  return function route(ctx) {
    const c = { ...ctx };
    c.commit = async (next) => {
      if (c.readOnly) {
        showToast('READ-ONLY — UPDATE THE APP');
        return false;
      }
      try {
        await ctx.save(next);
      } catch (err) {
        showToast('NOT SAVED: ' + err.message);
        return false;
      }
      c.data = next;
      return true;
    };
    c.rerender = () => mount(c.root, frame(c, active, renderFn(c)));
    c.rerender();
  };
}

// ============================================================
// WORKOUT (gainz "Today")
// ============================================================
/** How to do a home-plan exercise: the moving figure, the starting load, the cue and a video link. */
function demoBlock(ex) {
  const demo = DEMOS[ex.demo];
  if (!demo) return null;
  return h(
    'div',
    { class: 'gym-ex__demo' },
    demoFigure(ex.demo, ex.name),
    h(
      'div',
      { class: 'gym-ex__how' },
      ex.load ? h('p', { class: 'gym-ex__load' }, h('strong', {}, 'Start: '), ex.load) : null,
      h('p', { class: 'gym-ex__cue' }, demo.cue),
      h('a', { class: 'gym-ex__video', href: demoVideoUrl(ex.demo), target: '_blank', rel: 'noopener' }, 'Watch a demo ↗'),
    ),
  );
}

const PART_LABELS = { main: 'Main block', add: 'Arm + shoulder add-on' };

/**
 * A ladder exercise's step: − and + change it for this session (saved when the workout is logged), with
 * a nudge to move up when the last session at this step reached the top of the range on every set.
 */
function stepPicker(c, ex, step, saved) {
  const total = ladderOf(ex).steps.length;
  const go = (n) => {
    sessionSteps[ex.name] = n;
    c.rerender();
  };
  const moveUp = step === saved && readyToMoveUp(c.data, ex, step);
  return h(
    'div',
    { class: 'gym-step', 'data-testid': `gym-step-${ex.ladder}` },
    h(
      'div',
      { class: 'gym-step__row' },
      h('button', { type: 'button', class: 'btn gym-step__btn', 'aria-label': 'Easier step', disabled: step <= 1, onclick: () => go(step - 1) }, '−'),
      h('div', { class: 'gym-step__name' }, h('span', { class: 'muted gym-small' }, `Ladder step ${step} of ${total}`), h('strong', {}, stepName(ex, step))),
      h('button', { type: 'button', class: 'btn gym-step__btn', 'aria-label': 'Harder step', disabled: step >= total, onclick: () => go(step + 1) }, '+'),
    ),
    moveUp
      ? h('p', { class: 'gym-step__up', 'data-testid': 'gym-step-up' }, `⬆ Last time every set reached the top of the range. Move up to step ${step + 1}: ${stepName(ex, step + 1)}?`)
      : null,
  );
}

/** This week: a button per day (tap to mark or unmark an office day, this week only), sessions and free days left. */
function weekCard(c, now) {
  const week = weekStatus(c.data, now);
  return h(
    'section',
    { class: 'card gym-weekcard', 'data-testid': 'gym-weekcard' },
    h(
      'div',
      { class: 'gym-between' },
      h('h2', {}, 'This week'),
      h('span', { class: 'muted gym-small', 'data-testid': 'gym-week-left' }, `${week.left} left · ${week.freeLeft} free day${week.freeLeft === 1 ? '' : 's'} left`),
    ),
    h(
      'div',
      { class: 'gym-weekstrip', role: 'group', 'aria-label': 'Office days this week' },
      week.days.map((d) =>
        h(
          'button',
          {
            type: 'button',
            class: `gym-wd${d.today ? ' is-today' : ''}${d.past ? ' is-past' : ''}`,
            'aria-pressed': String(d.office),
            'aria-label': `${d.label}: ${d.office ? 'office day' : 'free day'}${d.trained ? `, ${d.trained} session${d.trained === 1 ? '' : 's'} done` : ''}`,
            'data-testid': `wd-${d.weekday}`,
            disabled: d.past,
            onclick: async () => {
              if (await c.commit(toggleOfficeDay(c.data, week.weekKey, d.weekday))) c.rerender();
            },
          },
          h('span', {}, d.label),
          h('span', { class: 'gym-wd__mark' }, d.trained ? '✓' : d.office ? '🏢' : '·'),
        ),
      ),
    ),
    week.warning ? h('p', { class: 'gym-week-warn', 'data-testid': 'gym-week-warning' }, week.warning) : null,
    h('p', { class: 'muted gym-small' }, 'Tap a day to mark it as an office day for this week. You can train on any day.'),
  );
}

function renderWorkout(c) {
  const now = new Date();
  const data = c.data;
  const home = isHomePlan(data);
  const dayName = currentDayName(data, now);
  const phase = activeProgram(data);
  const mode = home ? 'home' : sessionMode; // the home plan is always done at home
  const workout = workoutFor(dayName, mode);
  const key = `${dayName}|${mode}`;
  if (key !== sessionKey) {
    sessionInputs = {};
    sessionSteps = {};
    sessionKey = key;
  }
  const target = proteinTarget(data);
  const protein = todayProtein(data, now);

  const exercises = workout.exercises.map((ex, exIdx) => {
    const prevPart = workout.exercises[exIdx - 1]?.part;
    const partLabel = ex.part && ex.part !== prevPart ? h('h3', { class: 'gym-section gym-part' }, PART_LABELS[ex.part]) : null;
    const ladder = ladderOf(ex);
    const saved = ladder ? currentStep(data, ex) : null;
    const step = ladder ? (sessionSteps[ex.name] ?? saved) : null;
    const pb = data.personalBests[pbKey(ex.name, step)];
    const inputs = sessionInputs[ex.name] || initExInputs(data, ex, dayName);
    sessionInputs[ex.name] = inputs;
    const sets = [];
    for (let s = 0; s < ex.sets; s++) {
      const set = (field) =>
        h('input', {
          type: 'number',
          inputmode: 'decimal',
          class: 'gym-num',
          placeholder: field === 'weight' ? 'kg' : 'reps',
          step: field === 'weight' ? '0.5' : '1',
          min: '0',
          value: inputs[s]?.[field] || '',
          'aria-label': `${ex.name} set ${s + 1} ${field === 'weight' ? 'kg' : 'reps'}`,
          'data-testid': `set-${exIdx}-${s}-${field}`,
          oninput: (e) => {
            if (!sessionInputs[ex.name][s]) sessionInputs[ex.name][s] = {};
            sessionInputs[ex.name][s][field] = e.target.value;
          },
        });
      sets.push(h('div', { class: 'gym-set' }, h('span', { class: 'gym-set__label' }, `S${s + 1}`), set('weight'), h('span', { class: 'muted' }, '×'), set('reps')));
    }
    return [
      partLabel,
      h(
        'div',
        { class: 'gym-ex', 'data-testid': `gym-ex-${exIdx}` },
        h('div', { class: 'gym-ex__name' }, ex.name),
        h(
          'div',
          { class: 'gym-ex__meta' },
          `${ex.sets} sets · ${ex.reps} reps · `,
          h('span', { class: 'gym-hl' }, ex.muscle),
          pb ? [' · PB: ', h('span', { class: 'gym-hl' }, `${pb.weight}kg × ${pb.reps}`)] : null,
        ),
        ex.demo ? demoBlock(ex) : null,
        ladder ? stepPicker(c, ex, step, saved) : null,
        h('div', { class: 'gym-sets' }, sets),
      ),
    ];
  });

  const pct = Math.min(100, Math.round((protein / target) * 100));
  const restChips = [60, 70, 80, 90].map((s) =>
    h(
      'button',
      {
        type: 'button',
        class: 'seg',
        'aria-pressed': String(s === selectedRestTime),
        onclick: () => {
          selectedRestTime = s;
          c.rerender();
        },
      },
      `${s}s`,
    ),
  );

  let phasePrompt = null;
  if (!home && data.phase === 'phase1') {
    const left = sessionsUntilPhase2(data);
    phasePrompt =
      left > 0
        ? h('p', { class: 'gym-note' }, `${left} sessions until Phase 2 upgrade 💪`)
        : h(
            'button',
            {
              type: 'button',
              class: 'btn gym-note gym-note--go',
              onclick: async () => {
                if (!confirm('Ready to move to 4 days/week? This will switch to Phase 2.')) return;
                if (await c.commit(upgradePhase(c.data))) {
                  showToast('PHASE 2 UNLOCKED 🔥');
                  c.rerender();
                }
              },
            },
            '🔥 READY FOR PHASE 2? TAP TO UPGRADE TO 4 DAYS/WEEK',
          );
  }

  const programSwitch = h(
    'div',
    { class: 'segmented gym-modes', role: 'group', 'aria-label': 'Program' },
    [['gym', '🏋️ GYM PROGRAM'], ['home', '🏠 HOME PLAN']].map(([program, label]) =>
      h(
        'button',
        {
          type: 'button',
          class: 'seg',
          'aria-pressed': String((home ? 'home' : 'gym') === program),
          'data-testid': `program-${program}`,
          onclick: async () => {
            if ((home ? 'home' : 'gym') === program) return;
            if (await c.commit(setProgram(c.data, program))) {
              sessionInputs = {};
              sessionKey = '';
              showToast(program === 'home' ? 'HOME PLAN ON 🏠' : 'GYM PROGRAM ON 🏋️');
              c.rerender();
            }
          },
        },
        label,
      ),
    ),
  );

  const dayOfPlan = home
    ? `HOME PLAN · DAY ${phase.days.indexOf(dayName) + 1} OF ${phase.days.length} · FULL BODY`
    : `${phase.days.length}-DAY SPLIT · DAY ${(data.dayIndex % phase.days.length) + 1} OF ${phase.days.length}`;

  return [
    h('div', { class: 'gym-badge' }, h('strong', {}, phase.label), `  ·  ${phase.weeks}`),
    programSwitch,
    weekCard(c, now),
    // The gym program's GYM/HOME versions of each day; the home plan has only one.
    home
      ? null
      : h(
          'div',
          { class: 'segmented gym-modes', role: 'group', 'aria-label': 'Where' },
          [['gym', '🏋️ GYM'], ['home', '🏠 HOME']].map(([where, label]) =>
            h(
              'button',
              {
                type: 'button',
                class: 'seg',
                'aria-pressed': String(sessionMode === where),
                'data-testid': `mode-${where}`,
                onclick: () => {
                  sessionMode = where;
                  sessionInputs = {};
                  c.rerender();
                },
              },
              label,
            ),
          ),
        ),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'gym-day-badge', 'data-testid': 'gym-day' }, dayName),
      h('div', { class: 'gym-day-name' }, workout.focus),
      h('div', { class: 'gym-day-sub' }, dayOfPlan),
      home
        ? h('p', { class: 'muted gym-small', 'data-testid': 'gym-kg-note' }, 'kg = the plates on one dumbbell, not the handle · bodyweight = 0 · holds: seconds in "reps"')
        : null,
      exercises,
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, "Today's protein"),
      h('p', {}, h('strong', { class: 'gym-big' }, `${protein}g`), h('span', { class: 'muted' }, ` / ${target}g`), h('span', { class: pct >= 100 ? 'gym-good' : 'muted' }, `  ${pct}%`)),
      progressBar(pct),
      h('p', { class: 'muted gym-small' }, pct >= 100 ? '✅ Target hit! Keep it up.' : '⚡ Go log your protein — muscles need it.'),
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Rest timer', h('span', { class: 'muted gym-small' }, `  ${selectedRestTime}s selected`)),
      h('div', { class: 'segmented', role: 'group', 'aria-label': 'Rest time' }, restChips),
      h('button', { type: 'button', class: 'btn gym-wide', onclick: () => startRestTimer(selectedRestTime) }, '⏱ START REST'),
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn--primary gym-wide',
        'data-testid': 'gym-log-workout',
        disabled: c.readOnly,
        onclick: async () => {
          const result = logWorkout(c.data, { dayName, mode, inputs: sessionInputs, steps: sessionSteps, now: new Date() });
          if (result.error) return showToast(result.error);
          if (!(await c.commit(result.data))) return;
          sessionInputs = {};
          sessionKey = '';
          sessionSteps = {};
          if (result.newStage.id > result.oldStage.id) {
            setTimeout(() => {
              showToast('🔓 STAGE UNLOCKED: ' + result.newStage.name);
              setTimeout(() => {
                if (location.hash.startsWith('#/gym')) c.navigate('#/gym/fighter');
              }, 1200);
            }, 400);
          } else {
            showToast('WORKOUT SAVED 💪');
          }
          c.rerender();
        },
      },
      '✔ LOG THIS WORKOUT',
    ),
    phasePrompt,
  ];
}

// ============================================================
// HISTORY (gainz "Log")
// ============================================================
function renderHistory(c) {
  const logs = c.data.workoutLogs;
  if (!logs.length) {
    return h('section', { class: 'card gym-empty', 'data-testid': 'gym-history-empty' }, h('div', { class: 'gym-empty__icon' }, '📋'), h('p', {}, 'No workouts logged yet.', h('br'), 'Get your first session in!'));
  }
  const entries = logs.map((log) =>
    h(
      'section',
      { class: 'card gym-log', 'data-testid': 'gym-log-entry' },
      h('div', { class: 'gym-log__date' }, `${formatDate(log.date)} · ${log.mode === 'home' ? '🏠 HOME' : '🏋️ GYM'}`),
      h('div', { class: 'gym-log__title' }, log.day),
      h(
        'div',
        { class: 'gym-log__exercises' },
        log.exercises.map((ex) => h('div', {}, h('strong', {}, ex.name), ex.step ? ` (step ${ex.step})` : '', ': ', ex.sets.map((s) => `${s.weight}kg×${s.reps}`).join(', '))),
      ),
    ),
  );
  const pbs = Object.entries(c.data.personalBests);
  return [
    h('h2', { class: 'gym-section' }, 'Workout history'),
    entries,
    pbs.length
      ? [
          sectionHeader('Personal bests'),
          pbs.map(([name, pb]) => h('div', { class: 'gym-pb' }, h('span', {}, name), h('strong', { class: 'gym-hl' }, `${pb.weight}kg × ${pb.reps}`))),
        ]
      : null,
  ];
}

// ============================================================
// FIGHTER: Season 1 of Tad's story (story/season1.js), a pixel-art scene per stage, in real weather
// ============================================================
let weatherCheck = null; // the town whose weather is being fetched, so a re-render does not fetch twice

function weatherLine(c, town, reading) {
  if (!town) {
    return h('p', { class: 'muted gym-small gym-weather', 'data-testid': 'gym-weather' }, '🌦 The story uses its own weather. ', h('a', { href: '#/settings' }, 'Set your town in Settings'), ' to bring yours in.');
  }
  const text = reading
    ? `🌦 Weather from ${town.name}: ${describe(reading.code)}${typeof reading.temp === 'number' ? `, ${Math.round(reading.temp)}°C` : ''}`
    : `🌦 Weather from ${town.name}: not loaded yet`;
  return h('p', { class: 'muted gym-small gym-weather', 'data-testid': 'gym-weather' }, text);
}

/** After drawing with the cached weather, fetch fresh weather once and redraw if it changed. */
function refreshWeather(c, town, reading) {
  if (!town || weatherCheck === `${town.lat},${town.lon}`) return;
  weatherCheck = `${town.lat},${town.lon}`;
  currentReading(town).then((fresh) => {
    weatherCheck = null;
    if (!fresh || (reading && fresh.code === reading.code && fresh.isDay === reading.isDay)) return;
    if (location.hash.startsWith('#/gym/fighter') && c.root.isConnected) c.rerender();
  });
}

function renderFighter(c) {
  const data = c.data;
  const total = data.workoutLogs.length;
  const streak = getStreak(data, new Date());
  const powered = streak >= 3;
  const stage = currentStage(total);
  const next = nextStage(total);
  const toNext = next ? next.sessions - total : 0;

  const newUnlock = stage.id > (data.lastSeenStage || 0);
  if (newUnlock && !c.readOnly) {
    // Remember that this stage has been shown (gainz: state.lastSeenStage).
    c.commit({ ...structuredClone(data), lastSeenStage: stage.id });
  }

  if (previewStageId === null || previewStageId < 0 || previewStageId >= STAGES.length) previewStageId = stage.id;
  const view = STAGES[previewStageId];
  const chapter = SEASON_1[previewStageId];
  const isCurrent = view.id === stage.id;
  const isUnlocked = total >= view.sessions;
  const canLeft = previewStageId > 0;
  const canRight = previewStageId < STAGES.length - 1;
  const go = (id) => {
    previewStageId = id;
    c.rerender();
  };

  const town = data.weatherTown || null;
  const reading = town ? cachedReading(town) : null;
  const env = sceneEnv(chapter.env, reading, new Date());

  let startX = 0;
  const picture = h(
    'div',
    {
      class: `gym-story-frame${newUnlock && isCurrent ? ' unlock-flash' : ''}${powered && isCurrent ? ' powered' : ''}`,
      'data-testid': 'gym-fighter-char',
      ontouchstart: (e) => {
        startX = e.touches[0].clientX;
      },
      ontouchend: (e) => {
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
          if (diff > 0 && canRight) go(previewStageId + 1);
          if (diff < 0 && canLeft) go(previewStageId - 1);
        }
      },
    },
    isUnlocked
      ? stageCanvas(view.id, env, { label: `${chapter.title}: a pixel-art scene from Tad's story` })
      : h('div', { class: 'gym-story-locked', 'data-testid': 'gym-story-locked' }, h('span', { class: 'gym-story-locked__icon' }, '🔒'), `Unlocks at ${view.sessions} sessions`),
  );

  const subtitle =
    isCurrent && total > 0
      ? 'SINCE ' + formatDate(data.workoutLogs[data.workoutLogs.length - 1].date).toUpperCase()
      : isUnlocked
        ? 'UNLOCKED AT ' + view.sessions + ' SESSIONS'
        : view.sessions + ' SESSIONS TO UNLOCK';

  const power = isCurrent
    ? h(
        'p',
        { class: `gym-power ${powered ? 'on' : 'off'}` },
        powered
          ? `⚡ POWER STATE ACTIVE — ${streak} week streak — Tad is charged`
          : streak > 0
            ? `🔥 ${streak} week streak — hit 3 weeks in a row to power Tad up`
            : '💤 No streak yet — complete 3 sessions this week to start',
      )
    : null;

  const nextInfo =
    isCurrent && next
      ? [
          h('div', { class: 'gym-between' }, h('span', { class: 'muted' }, 'Next: ', h('strong', {}, `Stage ${next.id + 1}`)), h('strong', { class: 'gym-hl' }, `${toNext} session${toNext === 1 ? '' : 's'} away`)),
          progressBar(Math.round(((total - stage.sessions) / (next.sessions - stage.sessions)) * 100)),
        ]
      : isCurrent
        ? h('p', { class: 'gym-hl' }, '🏆 SEASON 1 COMPLETE')
        : null;

  const track = STAGES.map((st) => {
    const unlocked = total >= st.sessions;
    const current = st.id === stage.id;
    const viewing = st.id === previewStageId;
    const cls = viewing ? 'current' : unlocked ? 'unlocked' : 'locked';
    const badgeCls = viewing ? 'badge-cur' : unlocked ? 'badge-done' : 'badge-lock';
    const badgeText = viewing ? 'VIEWING' : current ? 'CURRENT' : unlocked ? '✓' : `${st.sessions}`;
    return h(
      'button',
      { type: 'button', class: `gym-stage ${cls}`, onclick: () => go(st.id) },
      h('span', { class: 'gym-stage__icon' }, unlocked ? st.icon : '🔒'),
      h('span', { class: 'gym-stage__info' }, h('span', { class: 'gym-stage__name' }, unlocked ? st.name : '???'), h('span', { class: 'gym-stage__req' }, st.sessions === 0 ? 'Starting point' : `${st.sessions} sessions`)),
      h('span', { class: `gym-stage__badge ${badgeCls}` }, badgeText),
    );
  });

  refreshWeather(c, town, reading);

  return [
    h('p', { class: 'gym-center gym-kicker', 'data-testid': 'gym-stage-label' }, `SEASON 1 · STAGE ${view.id + 1} OF ${STAGES.length}`),
    !isCurrent ? h('p', { class: 'gym-center' }, h('span', { class: 'gym-preview' }, isUnlocked ? 'PREVIEWING PAST STAGE' : '🔒 LOCKED')) : null,
    h(
      'section',
      { class: 'gym-fighter' },
      picture,
      h(
        'div',
        { class: 'gym-fighter__row' },
        h('button', { type: 'button', class: 'gym-arrow', 'aria-label': 'Previous stage', disabled: !canLeft, onclick: () => go(previewStageId - 1) }, '‹'),
        h('div', { class: 'gym-fighter__names' }, h('div', { class: 'gym-fighter__title', 'data-testid': 'gym-stage-name' }, isUnlocked ? view.name : '???'), h('div', { class: 'gym-fighter__sub' }, subtitle)),
        h('button', { type: 'button', class: 'gym-arrow', 'aria-label': 'Next stage', disabled: !canRight, onclick: () => go(previewStageId + 1) }, '›'),
      ),
      !isCurrent ? h('button', { type: 'button', class: 'btn', onclick: () => go(stage.id) }, '↩ BACK TO CURRENT') : null,
    ),
    isUnlocked ? weatherLine(c, town, reading) : null,
    h(
      'section',
      { class: 'card gym-chapter', 'data-testid': 'gym-chapter' },
      isUnlocked ? [h('h2', {}, chapter.title), h('p', {}, chapter.story)] : [h('h2', {}, `Stage ${view.id + 1}`), h('p', { class: 'muted' }, 'Keep training to find out what happens next.')],
    ),
    power,
    nextInfo ? h('section', { class: 'card' }, nextInfo) : null,
    sectionHeader('Season 1'),
    h('div', { class: 'gym-stages' }, track),
    h('p', { class: 'muted gym-center gym-small' }, `TOTAL SESSIONS: ${total}  ·  STREAK: ${streak} WEEKS`),
  ];
}

// ============================================================
// PROTEIN (gainz "Nutrition")
// ============================================================
function renderProtein(c) {
  const now = new Date();
  const data = c.data;
  const target = proteinTarget(data);
  const log = todayProteinLog(data, now);
  const total = log.reduce((sum, i) => sum + i.grams, 0);
  const pct = Math.min(100, Math.round((total / target) * 100));
  const r = 56;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);

  const add = async (name, grams) => {
    if (await c.commit(addProtein(c.data, name, grams, new Date()))) {
      showToast(`+${grams}g PROTEIN ADDED`);
      c.rerender();
    }
  };

  const ring = h(
    'div',
    { class: 'gym-ring' },
    svg('svg', { width: 140, height: 140, viewBox: '0 0 140 140', 'aria-hidden': 'true' },
      svg('circle', { cx: 70, cy: 70, r, class: 'gym-ring__track', 'stroke-width': 10, fill: 'none' }),
      svg('circle', { cx: 70, cy: 70, r, class: 'gym-ring__fill', 'stroke-width': 10, fill: 'none', 'stroke-dasharray': `${dash} ${circ}`, 'stroke-linecap': 'round' })),
    h('div', { class: 'gym-ring__center' }, h('div', { class: 'gym-ring__num', 'data-testid': 'gym-protein-total' }, String(total)), h('div', { class: 'muted gym-small' }, 'grams')),
  );

  const nameIn = h('input', { type: 'text', placeholder: 'e.g. Protein bar, Steak 200g...', 'aria-label': 'Food name', 'data-testid': 'myfood-name' });
  const gramsIn = h('input', { type: 'number', inputmode: 'numeric', min: '0', placeholder: 'e.g. 20', 'aria-label': 'Protein grams', 'data-testid': 'myfood-g' });
  const addFoodForm = h(
    'div',
    { class: 'gym-form', hidden: true },
    h('label', { class: 'field' }, 'Food name', nameIn),
    h('label', { class: 'field' }, 'Protein (grams)', gramsIn),
    h(
      'div',
      { class: 'row' },
      h('button', { type: 'button', class: 'btn', onclick: () => (addFoodForm.hidden = true) }, 'Cancel'),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn--primary',
          'data-testid': 'myfood-save',
          onclick: async () => {
            const name = nameIn.value.trim();
            const protein = parseInt(gramsIn.value) || 0;
            if (!name) return showToast('ENTER A FOOD NAME');
            if (protein <= 0) return showToast('ENTER PROTEIN GRAMS');
            if (await c.commit(addMyFood(c.data, name, protein))) {
              showToast(`${name} SAVED ✓`);
              c.rerender();
            }
          },
        },
        'Save food',
      ),
    ),
  );

  const oneName = h('input', { type: 'text', placeholder: 'Food name...', 'aria-label': 'One-off food name', 'data-testid': 'custom-food-name' });
  const oneGrams = h('input', { type: 'number', inputmode: 'numeric', min: '0', placeholder: 'g', 'aria-label': 'One-off protein grams', 'data-testid': 'custom-food-g' });
  const bw = h('input', {
    type: 'number',
    inputmode: 'decimal',
    value: data.bodyweight,
    min: '40',
    max: '200',
    step: '0.5',
    'aria-label': 'Your weight (kg)',
    onchange: async (e) => {
      if (await c.commit(setBodyweight(c.data, e.target.value))) c.rerender();
    },
  });

  const foods = data.myFoods || [];
  return [
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Protein target'),
      h(
        'div',
        { class: 'gym-ring-wrap' },
        ring,
        h('p', { class: 'muted gym-small' }, 'Target: ', h('strong', {}, `${target}g`), ` (bodyweight ${data.bodyweight}kg × 1.8)`),
        h('p', { class: total >= target ? 'gym-good gym-small' : 'muted gym-small', 'data-testid': 'gym-protein-left' }, total >= target ? '✅ TARGET HIT' : `⚡ ${Math.max(0, target - total)}g remaining`),
      ),
      sectionHeader('Quick add — default'),
      h('div', { class: 'gym-chips' }, QUICK_FOODS.map((f) => h('button', { type: 'button', class: 'gym-chip', onclick: () => add(f.name, f.protein) }, `${f.name} `, h('strong', {}, `+${f.protein}g`)))),
      h('div', { class: 'gym-between' }, sectionHeader('My foods'), h('button', { type: 'button', class: 'btn', onclick: () => { addFoodForm.hidden = false; nameIn.focus(); } }, '+ Add food')),
      addFoodForm,
      h(
        'div',
        { class: 'gym-chips' },
        foods.length === 0
          ? h('p', { class: 'muted gym-small' }, 'No saved foods yet. Add your own!')
          : foods.map((f, i) =>
              h(
                'span',
                { class: 'gym-chip-pair' },
                h('button', { type: 'button', class: 'gym-chip', onclick: () => add(f.name, f.protein) }, `${f.name} `, h('strong', {}, `+${f.protein}g`)),
                h('button', { type: 'button', class: 'gym-chip gym-chip--x', 'aria-label': `Delete saved food ${f.name}`, onclick: async () => { if (await c.commit(deleteMyFood(c.data, i))) c.rerender(); } }, '×'),
              ),
            ),
      ),
      sectionHeader('Log one-off'),
      h('div', { class: 'gym-oneoff' }, oneName, oneGrams),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn--primary gym-wide',
          'data-testid': 'custom-food-add',
          onclick: () => {
            const name = oneName.value.trim() || 'Custom food';
            const g = parseInt(oneGrams.value) || 0;
            if (g <= 0) return showToast('ENTER PROTEIN GRAMS');
            add(name, g);
          },
        },
        '+ LOG IT',
      ),
    ),
    sectionHeader("Today's log"),
    h(
      'div',
      { class: 'gym-plist', 'data-testid': 'gym-protein-log' },
      log.length === 0
        ? h('p', { class: 'muted gym-center' }, 'Nothing logged yet today.')
        : log.map((item, i) =>
            h(
              'div',
              { class: 'gym-pitem' },
              h('span', {}, item.name),
              h('span', { class: 'gym-pitem__right' }, h('strong', { class: 'gym-hl' }, `${item.grams}g`), h('button', { type: 'button', class: 'gym-x', 'aria-label': `Remove ${item.name}`, onclick: async () => { if (await c.commit(removeProtein(c.data, i, new Date()))) c.rerender(); } }, '×')),
            ),
          ),
    ),
    sectionHeader('Why protein matters'),
    h(
      'section',
      { class: 'card muted gym-small' },
      h('p', {}, "💪 Muscle is built from protein. Without enough, your workouts don't produce results — your body can't repair and grow the muscle fibers you're breaking down."),
      h('p', {}, '🎯 ', h('strong', {}, `Your target: ${target}g/day`), ' — based on 1.8g per kg of bodyweight. This is the sweet spot for muscle gain.'),
      h('p', {}, '⏰ Try to spread it across 3–4 meals rather than one big dose. Your body can only use ~40g efficiently at once.'),
    ),
    sectionHeader('Settings'),
    h('section', { class: 'card' }, h('label', { class: 'gym-inline' }, h('span', {}, 'Your weight (kg)'), bw)),
  ];
}

// ============================================================
// CHECK-IN
// ============================================================
function renderCheckin(c) {
  const now = new Date();
  const data = c.data;
  const streak = getStreak(data, now);
  const stat = (value, label) => h('div', { class: 'gym-stat' }, h('div', { class: 'gym-stat__value' }, value), h('div', { class: 'gym-stat__label' }, label));

  const weight = h('input', { type: 'number', inputmode: 'decimal', placeholder: 'e.g. 75.5', step: '0.1', min: '30', max: '200', 'data-testid': 'ci-weight', 'aria-label': 'Body weight (kg)' });
  const cals = h('input', { type: 'number', inputmode: 'numeric', placeholder: 'e.g. 2900', step: '50', 'data-testid': 'ci-cals', 'aria-label': 'Average calories per day' });
  const notes = h('textarea', { placeholder: 'e.g. Felt strong this week, shoulder was a bit tight...', 'data-testid': 'ci-notes', 'aria-label': 'Notes' });

  const history = [...data.checkIns].reverse().slice(0, 10).map((ci, i) => {
    const prev = data.checkIns[data.checkIns.length - 2 - i];
    const diff = prev ? (ci.weight - prev.weight).toFixed(1) : null;
    return h(
      'section',
      { class: 'card gym-log', 'data-testid': 'gym-checkin-entry' },
      h('div', { class: 'gym-log__date' }, formatDate(ci.date)),
      h('div', { class: 'gym-between' }, h('strong', { class: 'gym-big' }, `${ci.weight}kg`), diff !== null ? h('span', { class: diff > 0 ? 'gym-good' : 'gym-hl' }, `${diff > 0 ? '+' : ''}${diff}kg`) : null),
      ci.cals ? h('p', { class: 'muted gym-small' }, `~${ci.cals} kcal/day`) : null,
      ci.notes ? h('p', { class: 'gym-quote' }, `"${ci.notes}"`) : null,
    );
  });

  return [
    h(
      'div',
      { class: 'gym-stats', 'data-testid': 'gym-stats' },
      stat(String(data.workoutLogs.length), 'Total sessions'),
      stat(`${streak}🔥`, 'Week streak'),
      stat(String(checkinThisWeek(data, now)), 'This week'),
      stat(String(activeProgram(data).days.length), 'Days/week'),
    ),
    sectionHeader('Weekly check-in'),
    h(
      'section',
      { class: 'card' },
      h('label', { class: 'gym-inline' }, h('span', {}, 'Body weight (kg)'), weight),
      h('label', { class: 'gym-inline' }, h('span', {}, 'Avg calories/day'), cals),
      h('label', { class: 'field' }, 'Notes / how you felt', notes),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn--primary gym-wide',
          'data-testid': 'ci-save',
          onclick: async () => {
            const w = parseFloat(weight.value);
            const kcal = parseInt(cals.value) || null;
            if (!w) return showToast('ENTER YOUR WEIGHT');
            if (await c.commit(addCheckIn(c.data, { weight: w, cals: kcal, notes: notes.value.trim() }, new Date()))) {
              showToast('CHECK-IN SAVED ✓');
              c.rerender();
            }
          },
        },
        'SAVE CHECK-IN',
      ),
    ),
    history.length ? [sectionHeader('History'), history] : null,
    sectionHeader('Backups'),
    h(
      'section',
      { class: 'card muted gym-small' },
      h('p', {}, 'Everything here is in TheHub’s verified backups (Settings → Backup), with the rest of the app. To bring your history over from gainz-tracker: Settings → Import from gainz-tracker.'),
      h('a', { class: 'btn', href: '#/settings' }, 'Open Settings'),
    ),
    sectionHeader('Coach notes'),
    h(
      'section',
      { class: 'card muted gym-small' },
      h('p', {}, '🎯 ', h('strong', {}, 'Progressive Overload'), ' — add reps first, then weight. One extra rep per session adds up fast.'),
      h('p', {}, '😴 ', h('strong', {}, 'Sleep'), ' — 7–9 hours. Most muscle growth happens during sleep, not in the gym.'),
      h('p', {}, '📈 ', h('strong', {}, 'Weight gain target'), ' — aim for 0.25–0.5kg/week on the scale. More than that = too much fat.'),
      h('p', {}, '💧 ', h('strong', {}, 'Hydration'), ' — 2.5–3L of water daily. Dehydration tanks performance more than you think.'),
      h('p', {}, '🍽️ ', h('strong', {}, 'Calorie target'), ' — aim for 2900–3100 kcal/day. Protein hits matter most.'),
    ),
  ];
}

export const routes = {
  '': screen(renderWorkout, ''),
  // The "Log workout" home-screen shortcut opens #/gym/log: the screen where a workout is logged.
  log: screen(renderWorkout, ''),
  history: screen(renderHistory, 'history'),
  fighter: screen(renderFighter, 'fighter'),
  protein: screen(renderProtein, 'protein'),
  checkin: screen(renderCheckin, 'checkin'),
};
