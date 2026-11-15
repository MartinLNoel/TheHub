// Gym rules, ported from gainz-tracker's app.js as pure functions (data in, result out; "now" is a
// parameter so tests can fix the clock). The behaviour must stay the same as gainz-tracker's:
// tests/unit/gym-parity.test.js runs the original functions side by side with these.
//
// Kept on purpose, to behave exactly like gainz-tracker during the side-by-side week
// (PLACEHOLDER(Q-11)): "today" is the UTC date (toISOString), as in gainz-tracker, so between
// midnight and 01:00/02:00 Dutch time a session is dated the day before; and the Check-in screen's
// "This Week" counts from Sunday, while everything else uses Monday-to-Sunday weeks.
import { HOME_PLAN, HOME_PROGRAM, HOME_WORKOUTS, LADDERS, PROGRAM, STAGES, WORKOUTS } from './program.js';

/** True when the home plan is the chosen program (data.program, schema 2). */
export function isHomePlan(data) {
  return data.program === 'home';
}

/** The chosen program's label, weeks and days: the home plan, or the gym program's phase. */
export function activeProgram(data) {
  return isHomePlan(data) ? HOME_PROGRAM : PROGRAM[data.phase];
}

/** Switches between the gym program and the home plan; the phase and history stay as they are. */
export function setProgram(data, program) {
  return { ...structuredClone(data), program: program === 'home' ? 'home' : 'gym' };
}

/** gainz today(): the UTC calendar date, "YYYY-MM-DD". */
export function todayISO(now = new Date()) {
  return now.toISOString().split('T')[0];
}

/** gainz getWeekKey(): "YYYY-Www" for the Monday-to-Sunday week containing date. */
export function getWeekKey(date) {
  const d = new Date(date + 'T12:00:00');
  const day = d.getDay(); // 0=Sun,1=Mon,...
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const year = monday.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const weekNum = Math.ceil(((monday - startOfYear) / 86400000 + 1) / 7);
  return year + '-W' + String(weekNum).padStart(2, '0');
}

export function targetSessions(data) {
  if (isHomePlan(data)) return HOME_PROGRAM.days.length;
  return data.phase === 'phase2' ? 4 : 3;
}

export function sessionsThisWeek(data, now = new Date()) {
  const thisWeek = getWeekKey(todayISO(now));
  return data.workoutLogs.filter((l) => getWeekKey(l.date) === thisWeek).length;
}

/** gainz getStreak(): consecutive calendar weeks (Mon-Sun) that met the session target. */
export function getStreak(data, now = new Date()) {
  if (!data.workoutLogs.length) return 0;
  const weekMap = {};
  data.workoutLogs.forEach((l) => {
    const wk = getWeekKey(l.date);
    weekMap[wk] = (weekMap[wk] || 0) + 1;
  });
  const target = targetSessions(data);
  const thisWeek = getWeekKey(todayISO(now));
  let streak = 0;
  const todayDate = new Date(now.getTime());
  const todayDay = todayDate.getDay();
  const currentMonday = new Date(todayDate);
  currentMonday.setDate(todayDate.getDate() - (todayDay === 0 ? 6 : todayDay - 1));
  currentMonday.setHours(0, 0, 0, 0);
  const checkMonday = new Date(currentMonday);
  // The current week counts once it has enough sessions; otherwise start from last week.
  const thisWeekCount = weekMap[thisWeek] || 0;
  if (thisWeekCount < target) checkMonday.setDate(checkMonday.getDate() - 7);
  for (let i = 0; i < 52; i++) {
    const y = checkMonday.getFullYear();
    const soy = new Date(y, 0, 1);
    const wn = Math.ceil(((checkMonday - soy) / 86400000 + 1) / 7);
    const wk = y + '-W' + String(wn).padStart(2, '0');
    if ((weekMap[wk] || 0) >= target) {
      streak++;
      checkMonday.setDate(checkMonday.getDate() - 7);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * gainz getCurrentDayName(): every Monday the cycle resets to the first day (Upper A, or Day A on the
 * home plan); within the week it continues after the last day logged this week. A day from the other
 * program (after a switch mid-week) restarts the cycle.
 */
export function currentDayName(data, now = new Date()) {
  const days = activeProgram(data).days;
  const thisWeek = getWeekKey(todayISO(now));
  const thisWeekLogs = data.workoutLogs
    .filter((l) => getWeekKey(l.date) === thisWeek)
    .sort((a, b) => a.date.localeCompare(b.date)); // oldest first
  if (thisWeekLogs.length === 0) return days[0];
  const lastDayThisWeek = thisWeekLogs[thisWeekLogs.length - 1].day;
  const lastIdx = days.indexOf(lastDayThisWeek);
  if (lastIdx === -1) return days[0];
  return days[(lastIdx + 1) % days.length];
}

/** gainz getCurrentStage(): stages are earned by total sessions and never lost. */
export function currentStage(totalSessions) {
  let current = STAGES[0];
  for (const st of STAGES) {
    if (totalSessions >= st.sessions) current = st;
  }
  return current;
}

export function nextStage(totalSessions) {
  return STAGES.find((st) => st.sessions > totalSessions) || null;
}

/** Grams of protein a day (bodyweight × 1.8), or null while no weight is entered. */
export function proteinTarget(data) {
  return data.bodyweight > 0 ? Math.round(data.bodyweight * 1.8) : null;
}

export function todayProteinLog(data, now = new Date()) {
  return data.proteinLogs[todayISO(now)] || [];
}

export function todayProtein(data, now = new Date()) {
  return todayProteinLog(data, now).reduce((sum, item) => sum + (item.grams || 0), 0);
}

/**
 * The exercises for a day in a mode ('gym' or 'home'), as on gainz's Today screen. A home-plan day
 * (Day A, B, C) has one version.
 */
export function workoutFor(dayName, mode) {
  if (HOME_PLAN[dayName]) return HOME_PLAN[dayName];
  if (mode === 'gym') return WORKOUTS[dayName];
  return {
    focus: HOME_WORKOUTS[dayName] ? 'Home Version' : WORKOUTS[dayName].focus,
    exercises: HOME_WORKOUTS[dayName] || WORKOUTS[dayName].exercises,
  };
}

/** The most recent log of that day (logs are kept newest first). */
export function lastLogForDay(data, dayName) {
  return data.workoutLogs.find((l) => l.day === dayName) || null;
}

/** gainz initExInputs(): pre-fill each set from the last time this day was logged. */
export function initExInputs(data, ex, dayName) {
  const lastLog = lastLogForDay(data, dayName);
  if (lastLog) {
    const lastEx = lastLog.exercises.find((e) => e.name === ex.name);
    if (lastEx && lastEx.sets.length > 0) {
      return Array.from({ length: ex.sets }, (_, i) => {
        const s = lastEx.sets[i] || lastEx.sets[lastEx.sets.length - 1];
        return { weight: s.weight || '', reps: s.reps || '' };
      });
    }
  }
  return Array.from({ length: ex.sets }, () => ({ weight: '', reps: '' }));
}

/** gainz's personal-best rule: heavier, or the same weight for more reps. */
export function beatsPB(set, pb) {
  return !pb || set.weight > pb.weight || (set.weight === pb.weight && set.reps > pb.reps);
}

// ============================================================
// LADDERS: a ladder exercise records its step with each session (exercises[].step, 1-based)
// ============================================================

/** The ladder of an exercise (program.js, LADDERS), or null. */
export function ladderOf(ex) {
  return (ex && LADDERS[ex.ladder]) || null;
}

/** The step's name, e.g. "Deficit push-up (hands on the dumbbells)". */
export function stepName(ex, step) {
  return ladderOf(ex)?.steps[step - 1] ?? '';
}

/** The step to use now: the step of the last session with this exercise, or 1 (the bottom). */
export function currentStep(data, ex) {
  const ladder = ladderOf(ex);
  if (!ladder) return null;
  for (const log of data.workoutLogs) {
    const done = log.exercises.find((e) => e.name === ex.name && Number.isInteger(e.step));
    if (done) return Math.min(Math.max(done.step, 1), ladder.steps.length);
  }
  return 1;
}

/** The top of a rep range: "5–8" → 8, "12" → 12, "8–12/side" → 12. */
export function topOfRange(reps) {
  const nums = String(reps).match(/\d+/g);
  return nums ? Math.max(...nums.map(Number)) : 0;
}

/** True when the last session at this step reached the top of the range on every set: time to move up. */
export function readyToMoveUp(data, ex, step) {
  const ladder = ladderOf(ex);
  if (!ladder || step >= ladder.steps.length) return false;
  for (const log of data.workoutLogs) {
    const done = log.exercises.find((e) => e.name === ex.name);
    if (!done) continue;
    if (done.step !== step) return false;
    const top = topOfRange(ex.reps);
    return done.sets.length >= ex.sets && done.sets.every((s) => s.reps >= top);
  }
  return false;
}

/** Personal bests of a ladder are kept per step: "Push-up ladder · step 3". */
export function pbKey(name, step) {
  return Number.isInteger(step) ? `${name} · step ${step}` : name;
}

/**
 * gainz saveWorkout(), without the side effects. inputs: { [exerciseName]: [{ weight, reps }] }
 * (strings or numbers, as typed); steps: { [exerciseName]: step } for ladder exercises (default: the
 * current step). Returns { error } when nothing was entered, otherwise
 * { data (a new object), log, oldStage, newStage }.
 */
export function logWorkout(data, { dayName, mode, inputs, steps = {}, now = new Date(), id = now.getTime() }) {
  const next = structuredClone(data);
  const workout = workoutFor(dayName, mode);
  const loggedExercises = [];
  workout.exercises.forEach((ex) => {
    const sets = (inputs[ex.name] || [])
      .filter((s) => s && (s.weight || s.reps))
      .map((s) => ({ weight: parseFloat(s.weight) || 0, reps: parseInt(s.reps) || 0 }));
    if (sets.length > 0) {
      const step = ladderOf(ex) ? (steps[ex.name] ?? currentStep(data, ex)) : null;
      loggedExercises.push(step ? { name: ex.name, step, sets } : { name: ex.name, sets });
      const key = pbKey(ex.name, step);
      sets.forEach((s) => {
        if (beatsPB(s, next.personalBests[key])) next.personalBests[key] = { weight: s.weight, reps: s.reps };
      });
    }
  });
  if (loggedExercises.length === 0) return { error: 'LOG SOME WEIGHTS FIRST' };

  const log = { id, date: todayISO(now), day: dayName, mode, exercises: loggedExercises };
  next.workoutLogs.unshift(log);
  next.dayIndex = (Number.isFinite(next.dayIndex) ? next.dayIndex : 0) + 1;
  return {
    data: next,
    log,
    oldStage: currentStage(next.workoutLogs.length - 1),
    newStage: currentStage(next.workoutLogs.length),
  };
}

/** Sessions left before the Phase 2 prompt (gainz: 18 sessions in Phase 1). */
export function sessionsUntilPhase2(data) {
  return Math.max(0, 18 - data.workoutLogs.length);
}

export function upgradePhase(data) {
  return { ...structuredClone(data), phase: 'phase2', dayIndex: 0 };
}

export function addProtein(data, name, grams, now = new Date()) {
  const next = structuredClone(data);
  const day = todayISO(now);
  if (!next.proteinLogs[day]) next.proteinLogs[day] = [];
  next.proteinLogs[day].push({ name, grams });
  return next;
}

export function removeProtein(data, index, now = new Date()) {
  const next = structuredClone(data);
  next.proteinLogs[todayISO(now)]?.splice(index, 1);
  return next;
}

export function addMyFood(data, name, protein) {
  const next = structuredClone(data);
  if (!next.myFoods) next.myFoods = [];
  next.myFoods.push({ name, protein });
  return next;
}

export function deleteMyFood(data, index) {
  const next = structuredClone(data);
  next.myFoods.splice(index, 1);
  return next;
}

export function setBodyweight(data, value) {
  const kg = parseFloat(value);
  return kg > 0 ? { ...structuredClone(data), bodyweight: kg } : structuredClone(data); // empty or nonsense: keep it
}

/** gainz saveCheckin(): the check-in's weight also becomes the bodyweight (protein target). */
export function addCheckIn(data, { weight, cals, notes }, now = new Date()) {
  const next = structuredClone(data);
  next.checkIns.push({ date: todayISO(now), weight, cals, notes });
  next.bodyweight = weight;
  return next;
}

/**
 * Check-in "This week": the sessions of this Monday-to-Sunday week, like the header. (gainz-tracker counted from
 * Sunday and compared a UTC date with the local time, so a session logged on a Sunday showed as 0; that rule was
 * kept for the side-by-side week with gainz-tracker, which Martin's fresh start made moot. Fixed 2026-11-15.)
 */
export function checkinThisWeek(data, now = new Date()) {
  return sessionsThisWeek(data, now);
}

/** gainz formatDate(): "Mon 4 May". */
export function formatDate(d) {
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtTime(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ============================================================
// OFFICE DAYS (schema 3): rest days the week plan works around. They never block a session: any day
// can be trained, and 3 sessions in the Monday-to-Sunday week is all that counts.
// ============================================================
export const WEEKDAY_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** 1 (Monday) to 7 (Sunday) for a "YYYY-MM-DD" date. */
export function weekdayOf(date) {
  const d = new Date(date + 'T12:00:00Z').getUTCDay();
  return d === 0 ? 7 : d;
}

function addDays(date, n) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The office days of a week ("YYYY-Www"): that week's own list, or the usual days. */
export function officeDaysFor(data, weekKey) {
  return data.officeWeeks?.[weekKey] ?? data.officeDays ?? [];
}

/** Marks or unmarks one weekday as an office day for that week only; the usual days stay. */
export function toggleOfficeDay(data, weekKey, weekday) {
  const next = structuredClone(data);
  const days = new Set(officeDaysFor(data, weekKey));
  if (days.has(weekday)) days.delete(weekday);
  else days.add(weekday);
  next.officeWeeks = { ...(next.officeWeeks || {}), [weekKey]: [...days].sort((a, b) => a - b) };
  return next;
}

/**
 * This week at a glance: each day (date, weekday, office, trained, today, past), the sessions left,
 * the free days left (from today, not office days, not today once trained) and a warning when the
 * free days left are no more than the sessions left.
 */
export function weekStatus(data, now = new Date()) {
  const today = todayISO(now);
  const todayWd = weekdayOf(today);
  const weekKey = getWeekKey(today);
  const office = officeDaysFor(data, weekKey);
  const trainedOn = (date) => data.workoutLogs.filter((l) => l.date === date).length;
  const days = WEEKDAY_SHORT.map((label, i) => {
    const date = addDays(today, i + 1 - todayWd);
    return { label, date, weekday: i + 1, office: office.includes(i + 1), trained: trainedOn(date), today: i + 1 === todayWd, past: i + 1 < todayWd };
  });
  const trainedToday = days[todayWd - 1].trained > 0;
  const left = Math.max(0, targetSessions(data) - sessionsThisWeek(data, now));
  const freeLeft = days.filter((d) => !d.past && !d.office && !(d.today && trainedToday)).length;
  let warning = null;
  if (left > 0 && freeLeft < left) {
    warning = `⚠ ${left} session${left === 1 ? '' : 's'} left, ${freeLeft} free day${freeLeft === 1 ? '' : 's'}: an office day will have to count.`;
  } else if (left > 0 && freeLeft === left) {
    warning = `⚠ ${left} session${left === 1 ? '' : 's'} left, ${freeLeft} free day${freeLeft === 1 ? '' : 's'}: no room to skip.`;
  }
  const officeToday = days[todayWd - 1].office;
  return { weekKey, days, left, freeLeft, trainedToday, officeToday, warning };
}
