// The Gym program data, copied unchanged from gainz-tracker (app.js, "DATA" and "FIGHTER").
// Keep it identical to gainz-tracker: these are Martin's program rules (see the coaching guide in Notion).
// HOME_PROGRAM and HOME_PLAN, below, are TheHub's own: the home plan, chosen with the program switch.

export const PROGRAM = {
  phase1: {
    label: "Phase 1 — 3×/week",
    weeks: "Weeks 1–6",
    days: ["Upper A", "Lower A", "Upper B"]
  },
  phase2: {
    label: "Phase 2 — 4×/week",
    weeks: "Week 7+",
    days: ["Upper A", "Lower A", "Upper B", "Lower B"]
  }
};

export const WORKOUTS = {
  "Upper A": {
    focus: "Push + Pull",
    exercises: [
      { name: "Incline Chest Press", sets: 3, reps: "8–10", muscle: "Chest" },
      { name: "Lat Pulldown", sets: 3, reps: "8–10", muscle: "Back" },
      { name: "Overhead Press", sets: 3, reps: "8–10", muscle: "Shoulders" },
      { name: "Seated Row", sets: 3, reps: "10", muscle: "Back" },
      { name: "Lateral Raises", sets: 3, reps: "12–15", muscle: "Shoulders" },
      { name: "EZ Bar / DB Curl", sets: 3, reps: "10", muscle: "Biceps" },
      { name: "Triceps Rope Pushdown", sets: 3, reps: "12", muscle: "Triceps" }
    ]
  },
  "Lower A": {
    focus: "Quad + Hamstring",
    exercises: [
      { name: "Leg Press", sets: 4, reps: "8–10", muscle: "Quads" },
      { name: "Hamstring Curl", sets: 3, reps: "10–12", muscle: "Hamstrings" },
      { name: "Walking Lunges", sets: 2, reps: "24 steps", muscle: "Legs" },
      { name: "Calf Raises", sets: 3, reps: "20–25", muscle: "Calves" },
      { name: "Plank", sets: 3, reps: "50–60s", muscle: "Core" }
    ]
  },
  "Upper B": {
    focus: "Arms + Width",
    exercises: [
      { name: "Flat Chest Press", sets: 3, reps: "8–10", muscle: "Chest" },
      { name: "Lat Pulldown (Wide)", sets: 3, reps: "8–10", muscle: "Back" },
      { name: "Dumbbell Lateral Raises", sets: 3, reps: "12–15", muscle: "Shoulders" },
      { name: "Rear Delt Machine", sets: 3, reps: "15", muscle: "Shoulders" },
      { name: "Incline DB Curl", sets: 3, reps: "10–12", muscle: "Biceps" },
      { name: "Tricep Bar Pushdown", sets: 3, reps: "10–12", muscle: "Triceps" }
    ]
  },
  "Lower B": {
    focus: "Glute + Power",
    exercises: [
      { name: "Leg Press (Heavy)", sets: 4, reps: "6–8", muscle: "Quads" },
      { name: "Hamstring Curl", sets: 3, reps: "10–12", muscle: "Hamstrings" },
      { name: "Glute Kickback", sets: 3, reps: "12–15", muscle: "Glutes" },
      { name: "Calf Raise Machine", sets: 3, reps: "20–25", muscle: "Calves" },
      { name: "Torso Rotation", sets: 3, reps: "15/side", muscle: "Core" }
    ]
  }
};

export const HOME_WORKOUTS = {
  "Upper A": [
    { name: "Push-ups (incline)", sets: 4, reps: "10–15", muscle: "Chest" },
    { name: "Pike Push-ups", sets: 3, reps: "10–12", muscle: "Shoulders" },
    { name: "Doorframe Row / Towel Row", sets: 3, reps: "10–12", muscle: "Back" },
    { name: "Lateral Raises (bottles)", sets: 3, reps: "15", muscle: "Shoulders" },
    { name: "DB / Improvised Curl", sets: 3, reps: "10–12", muscle: "Biceps" },
    { name: "Diamond Push-ups", sets: 3, reps: "10–12", muscle: "Triceps" }
  ],
  "Lower A": [
    { name: "Goblet Squat / BW Squat", sets: 4, reps: "15", muscle: "Quads" },
    { name: "Romanian Deadlift (bottles)", sets: 3, reps: "12", muscle: "Hamstrings" },
    { name: "Walking Lunges", sets: 3, reps: "24 steps", muscle: "Legs" },
    { name: "Calf Raises (step)", sets: 3, reps: "25–30", muscle: "Calves" },
    { name: "Plank", sets: 3, reps: "60s", muscle: "Core" }
  ],
  "Upper B": [
    { name: "Wide Push-ups", sets: 4, reps: "12–15", muscle: "Chest" },
    { name: "Pull-ups / Negative Pull-ups", sets: 3, reps: "Max", muscle: "Back" },
    { name: "Arnold Press (bottles)", sets: 3, reps: "12", muscle: "Shoulders" },
    { name: "Face Pulls (band/towel)", sets: 3, reps: "15", muscle: "Rear Delt" },
    { name: "Hammer Curl (bottles)", sets: 3, reps: "12", muscle: "Biceps" },
    { name: "Tricep Dips (chair)", sets: 3, reps: "12–15", muscle: "Triceps" }
  ],
  "Lower B": [
    { name: "Jump Squats / Pistol Squats", sets: 4, reps: "10", muscle: "Quads" },
    { name: "Nordic Curls (if possible)", sets: 3, reps: "8", muscle: "Hamstrings" },
    { name: "Glute Bridges", sets: 3, reps: "15", muscle: "Glutes" },
    { name: "Single-leg Calf Raises", sets: 3, reps: "20", muscle: "Calves" },
    { name: "Russian Twists", sets: 3, reps: "15/side", muscle: "Core" }
  ]
};

// The home plan (2026-11-01, Martin has no gym now): full body 3×/week, bodyweight and dumbbells only,
// no jumping (quiet, for the neighbours). Agreed with Martin in a coaching session; the plan page is
// https://claude.ai/artifact/BLU6hUP38wvW7JVsByjYY3. `demo` names the figure in demos.js; `load` is
// the starting dumbbell load as plates per side (2 handles, 4 × 1.25 kg and 4 × 2.5 kg plates);
// `part` splits the main block from the arm + shoulder add-on. 2026-11-14: a calf raise every day, so the
// legs stay in proportion (Martin's goal: big arms, round shoulders, wide back, proportionate legs, tight stomach).
export const HOME_PROGRAM = {
  label: "Home plan — 3×/week",
  weeks: "Bodyweight + dumbbells",
  days: ["Day A", "Day B", "Day C"]
};

const main = (name, reps, muscle, demo, load) => ({ name, sets: 3, reps, muscle, demo, load, part: "main" });
const addOn = (name, reps, muscle, demo, load) => ({ name, sets: 3, reps, muscle, demo, load, part: "add" });

export const HOME_PLAN = {
  "Day A": {
    focus: "Push emphasis",
    exercises: [
      main("Push-up ladder", "5–8", "Chest", "pushup"),
      main("Bent-over dumbbell row", "10–15", "Back", "bentrow", "Both DBs · 2.5 each side"),
      main("Split squat", "8/leg", "Legs", "splitsquat"),
      main("Glute bridge", "10", "Glutes", "bridge"),
      main("Single-leg calf raise", "15–20/leg", "Calves", "calf"),
      main("Plank", "30–60s", "Core", "plank"),
      main("Reverse crunch", "10–15", "Lower abs", "revcrunch"),
      addOn("Dumbbell curl", "8–12", "Biceps", "curl", "Both DBs · 2.5 each side"),
      addOn("Overhead triceps extension", "10–15", "Triceps", "ohtri", "One DB · 2.5 + 1.25 each side"),
      addOn("Lateral raise", "12–20", "Shoulders", "lateral", "Both DBs · 1.25 each side")
    ]
  },
  "Day B": {
    focus: "Shoulders + width",
    exercises: [
      main("Pike push-up ladder", "5–8", "Shoulders", "pike"),
      main("Floor pullover", "10–15", "Lats", "pullover", "One DB · 2.5 + 1.25 each side"),
      main("Bulgarian split squat", "8/leg", "Legs", "bulgarian"),
      main("Single-leg Romanian deadlift", "10/leg", "Hamstrings", "slrdl", "Bodyweight first, then one DB · 2.5 + 1.25 each side"),
      main("Single-leg calf raise", "15–20/leg", "Calves", "calf"),
      main("Side plank", "30–45s/side", "Core", "sideplank"),
      main("Lying leg raise", "8–12", "Lower abs", "legraise"),
      addOn("Hammer curl", "8–12", "Biceps", "hammer", "Both DBs · 2.5 each side"),
      addOn("Triceps kickback", "12–15", "Triceps", "kickback", "Both DBs · 1.25 each side"),
      addOn("Rear delt fly", "15–20", "Rear delts", "reardelt", "Both DBs · 1.25 each side")
    ]
  },
  "Day C": {
    focus: "Dips + back",
    exercises: [
      main("Chair dip ladder", "8–12", "Triceps", "dip"),
      main("One-arm dumbbell row", "8–12/side", "Back", "dbrow", "One DB · 2.5 + 2.5 each side"),
      main("Slow squat", "12", "Legs", "squat"),
      main("Single-leg glute bridge", "10/leg", "Glutes", "slbridge"),
      main("Single-leg calf raise", "15–20/leg", "Calves", "calf"),
      main("Hollow hold", "20–30s", "Core", "hollow"),
      main("Dead bug", "8/side", "Lower abs", "deadbug"),
      addOn("Concentration curl", "8–12/arm", "Biceps", "conc", "One DB · 2.5 each side"),
      addOn("Floor skull crusher", "10–15", "Triceps", "skull", "Both DBs · 1.25 each side"),
      addOn("Lateral raise", "12–20", "Shoulders", "lateral", "Both DBs · 1.25 each side")
    ]
  }
};

export const QUICK_FOODS = [
  { name: "Chicken breast 200g", protein: 46 },
  { name: "4 eggs", protein: 24 },
  { name: "Whey shake", protein: 25 },
  { name: "Greek yogurt 150g", protein: 15 },
  { name: "Ground beef 200g", protein: 40 },
  { name: "Tuna can", protein: 30 },
  { name: "Cottage cheese 200g", protein: 24 },
  { name: "Milk 250ml", protein: 8 }
];

export const STAGES = [
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

// gainz-tracker's default "My Foods" for a fresh start (app.js, STATE).
export const DEFAULT_MY_FOODS = [
  { name: "Meal out - meat dish", protein: 20 },
  { name: "Meal out - light protein", protein: 12 },
  { name: "Snack - unknown", protein: 8 }
];
