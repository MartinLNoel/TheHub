// TESTS ONLY. gainz-tracker's original functions, copied unchanged from its app.js, so the tests can
// check that the Gym port gives the same answers for the same input (tests/unit/gym-parity.test.js).
// They read a global-style `state` and the real clock, exactly as in gainz-tracker; the tests fix the
// clock with vi.setSystemTime.
import { PROGRAM } from '../../src/modules/gym/program.js';

/** Returns gainz-tracker's functions bound to the given state. */
export function gainzOriginal(state) {
  const STAGES = [
    { id: 0, sessions: 0,  name: "THE BEGINNER",    icon: "🧍", title: "Day One",        desc: "Every legend starts here." },
    { id: 1, sessions: 5,  name: "THE RECRUIT",     icon: "💪", title: "5 Sessions",     desc: "You showed up. Keep going." },
    { id: 2, sessions: 10, name: "THE GRINDER",     icon: "🔩", title: "10 Sessions",    desc: "Discipline over motivation." },
    { id: 3, sessions: 18, name: "THE CONTENDER",   icon: "🥊", title: "18 Sessions",    desc: "Phase 1 complete. You earned this." },
    { id: 4, sessions: 25, name: "THE IRON",        icon: "⚙️", title: "25 Sessions",    desc: "The bar knows your name now." },
    { id: 5, sessions: 35, name: "THE MACHINE",     icon: "🤖", title: "35 Sessions",    desc: "Routine is your superpower." },
    { id: 6, sessions: 50, name: "THE VETERAN",     icon: "🏆", title: "50 Sessions",    desc: "Half a century. Respect." },
    { id: 7, sessions: 70, name: "THE WARRIOR",     icon: "⚔️", title: "70 Sessions",    desc: "Built in the dark, seen in the light." },
    { id: 8, sessions: 90, name: "THE TITAN",       icon: "🌋", title: "90 Sessions",    desc: "Three months of relentless work." },
    { id: 9, sessions: 120,"name": "THE LEGEND",    icon: "👑", title: "120 Sessions",   desc: "You are the person you set out to become." },
  ];

  function today() { return new Date().toISOString().split('T')[0]; }
  function formatDate(d) {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
  }
  function getWeekKey(date) {
    // Returns "YYYY-Www" string for the Monday-Sunday week containing date
    const d = new Date(date + 'T12:00:00');
    const day = d.getDay(); // 0=Sun,1=Mon,...
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const year = monday.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const weekNum = Math.ceil(((monday - startOfYear) / 86400000 + 1) / 7);
    return year + '-W' + String(weekNum).padStart(2, '0');
  }
  function getSessionsThisWeek() {
    const thisWeek = getWeekKey(today());
    return state.workoutLogs.filter(l => getWeekKey(l.date) === thisWeek).length;
  }
  function getTargetSessions() {
    return state.phase === 'phase2' ? 4 : 3;
  }
  function getStreak() {
    if (!state.workoutLogs.length) return 0;
    // Build a map of weekKey -> session count
    const weekMap = {};
    state.workoutLogs.forEach(l => {
      const wk = getWeekKey(l.date);
      weekMap[wk] = (weekMap[wk] || 0) + 1;
    });
    const target = getTargetSessions();
    const thisWeek = getWeekKey(today());
    // Get sorted unique week keys descending
    const allWeeks = Object.keys(weekMap).sort().reverse();
    let streak = 0;
    // Walk back from current week
    // Generate expected consecutive weeks going back
    const todayDate = new Date();
    const todayDay = todayDate.getDay();
    const currentMonday = new Date(todayDate);
    currentMonday.setDate(todayDate.getDate() - (todayDay === 0 ? 6 : todayDay - 1));
    currentMonday.setHours(0,0,0,0);
    let checkMonday = new Date(currentMonday);
    // If current week already has enough sessions, count it
    // Otherwise start checking from last week
    const thisWeekCount = weekMap[thisWeek] || 0;
    if (thisWeekCount < target) {
      // current week not done yet — start from last week
      checkMonday.setDate(checkMonday.getDate() - 7);
    }
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
  function getCurrentDayName() {
    const days = PROGRAM[state.phase].days;
    // Rule: count how many sessions done THIS calendar week (Mon-Sun)
    // The next workout is simply the next one in sequence after what's been done this week
    const thisWeek = getWeekKey(today());
    const thisWeekLogs = state.workoutLogs
      .filter(l => getWeekKey(l.date) === thisWeek)
      .sort((a, b) => a.date.localeCompare(b.date)); // oldest first

    // Find the last day done this week and return the next in cycle
    if (thisWeekLogs.length === 0) {
      // Nothing done this week — always start from Upper A
      return days[0];
    }

    // Continue from where we left off this week
    const lastDayThisWeek = thisWeekLogs[thisWeekLogs.length - 1].day;
    const lastIdx = days.indexOf(lastDayThisWeek);
    if (lastIdx === -1) return days[0];
    return days[(lastIdx + 1) % days.length];
  }
  function getCurrentStage(totalSessions) {
    let current = STAGES[0];
    for (const st of STAGES) {
      if (totalSessions >= st.sessions) current = st;
    }
    return current;
  }
  function getNextStage(totalSessions) {
    return STAGES.find(st => st.sessions > totalSessions) || null;
  }
  function getTodayProtein() {
    const log = state.proteinLogs[today()] || [];
    return log.reduce((sum, item) => sum + (item.grams || 0), 0);
  }
  function initExInputs(ex, dayName) {
    const lastLog = getLastLogForDay(dayName);
    if (lastLog) {
      const lastEx = lastLog.exercises.find(e => e.name === ex.name);
      if (lastEx && lastEx.sets.length > 0) {
        // Fill all sets — repeat last set if fewer were logged than needed
        return Array.from({length: ex.sets}, (_, i) => {
          const s = lastEx.sets[i] || lastEx.sets[lastEx.sets.length - 1];
          return { weight: s.weight || '', reps: s.reps || '' };
        });
      }
    }
    return Array.from({length: ex.sets}, () => ({ weight: '', reps: '' }));
  }
  function getLastLogForDay(dayName) {
    return state.workoutLogs.find(l => l.day === dayName) || null;
  }
  return { today, getWeekKey, getSessionsThisWeek, getTargetSessions, getStreak, getCurrentDayName, getCurrentStage, getNextStage, getTodayProtein, initExInputs, getLastLogForDay };
}
