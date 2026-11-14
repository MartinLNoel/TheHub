// Moving demonstrations for the home plan (program.js, HOME_PLAN): a stick figure that moves between
// the start (A) and the end (B) of each exercise, over a faint outline of the end position. Holds have
// one pose and a HOLD label. Ported from the plan page Martin liked (its link is in program.js).
//
// Poses are points in a 200 × 142 box (viewBox "0 -12 200 142", the floor at y 125):
//   h head · n neck/shoulder · hp hip · e/w elbow/wrist · k/f knee/foot (ankle) · t toe · e2 w2 k2 f2 the other limb
//   front views: sl sr shoulders · el wl er wr arms · hl hr hips · kl fl kr fr legs
// Colours come from the theme through CSS classes (style.css, "gym-demo").

const SVG_NS = 'http://www.w3.org/2000/svg';
const GROUND = 125;
const PERIOD_MS = 3200;

/** The bones drawn between pose points, when both points exist. */
export const PAIRS = [
  ['n', 'hp'], ['n', 'e'], ['e', 'w'], ['n', 'e2'], ['e2', 'w2'],
  ['hp', 'k'], ['k', 'f'], ['f', 't'], ['hp', 'k2'], ['k2', 'f2'],
  ['n', 'sl'], ['n', 'sr'], ['sl', 'el'], ['el', 'wl'], ['sr', 'er'], ['er', 'wr'],
  ['hp', 'hl'], ['hp', 'hr'], ['hl', 'kl'], ['kl', 'fl'], ['hr', 'kr'], ['kr', 'fr'],
];

const M = (base, extra) => ({ ...base, ...extra });
const STAND = { h: [100, 29], n: [100, 40], hp: [100, 80], k: [100, 102], f: [100, 123] };
const FRONT = { h: [100, 27], n: [100, 38], sl: [89, 41], sr: [111, 41], hp: [100, 80], hl: [94, 81], hr: [106, 81], kl: [92, 102], fl: [91, 123], kr: [108, 102], fr: [109, 123] };
const BENT = { h: [100, 52], n: [100, 60], sl: [87, 62], sr: [113, 62], hp: [100, 72], hl: [94, 76], hr: [106, 76], kl: [90, 99], fl: [92, 123], kr: [110, 99], fr: [108, 123] };
const HINGE = { f: [100, 123], k: [104, 102], hp: [92, 80], n: [128, 63], h: [139, 58] };
const LIE = { h: [143, 114], n: [130, 118], hp: [86, 118], k: [62, 96], f: [46, 123] };
const ARMS_DOWN = { e: [108, 121], w: [90, 122] };
const BRIDGE_DOWN = { h: [150, 114], n: [138, 118], hp: [95, 118], k: [70, 95], f: [55, 123], e: [120, 121], w: [102, 122] };
const BRIDGE_UP = { h: [149, 113], n: [136, 116], hp: [95, 96], k: [70, 90], f: [55, 123], e: [120, 121], w: [102, 122] };
const CURL_A = M(STAND, { e: [100, 60], w: [101, 80] });
const CURL_B = M(STAND, { e: [100, 60], w: [114, 46] });

/**
 * Every demo: cue (how to do it), query (a YouTube search for real form videos), A and optional B
 * poses, db (pose points holding a dumbbell), chair ([x1, x2, seat y, backrest side]), block (the yoga
 * block: [x, y, width, height]), wall (a wall's x, to hold for balance).
 */
export const DEMOS = {
  pushup: {
    cue: 'Body in one straight line, chest to a fist above the floor. Too hard? Start with your hands on a table.',
    query: 'push up proper form beginner',
    A: { f: [40, 123], k: [67, 112], hp: [95, 102], n: [148, 84], h: [160, 79], e: [149, 104], w: [150, 123] },
    B: { f: [40, 123], k: [67, 120], hp: [95, 116], n: [148, 110], h: [161, 107], e: [132, 106], w: [150, 123] },
  },
  bentrow: {
    cue: 'Soft knees, hinge until your chest faces the floor at about 45°, back flat. Pull both dumbbells to your hips and squeeze your shoulder blades.',
    query: 'bent over two arm dumbbell row form',
    db: ['w'],
    A: M(HINGE, { e: [128, 83], w: [128, 103] }),
    B: M(HINGE, { e: [108, 60], w: [112, 80] }),
  },
  splitsquat: {
    cue: 'Back knee drops straight down towards the floor. Front shin stays close to vertical.',
    query: 'split squat form',
    A: { f: [135, 123], k: [124, 101], hp: [100, 80], k2: [80, 103], f2: [58, 123], n: [100, 40], h: [100, 29], e: [101, 60], w: [102, 79] },
    B: { f: [135, 123], k: [133, 97], hp: [100, 96], k2: [82, 120], f2: [58, 123], n: [100, 56], h: [100, 45], e: [101, 76], w: [102, 95] },
  },
  bridge: {
    cue: 'Drive through your heels, squeeze your glutes for 1 second at the top. Don’t arch your lower back.',
    query: 'glute bridge form',
    A: BRIDGE_DOWN,
    B: BRIDGE_UP,
  },
  plank: {
    cue: 'Forearms down, squeeze glutes and abs, ribs down, one straight line. Log the seconds as reps.',
    query: 'forearm plank form',
    A: { f: [40, 123], k: [66, 117], hp: [92, 111], n: [142, 101], h: [154, 98], e: [142, 123], w: [166, 123] },
  },
  revcrunch: {
    cue: 'Knees bent, arms flat on the floor. Curl your hips up towards your chest with your lower abs, not momentum. 2 seconds down.',
    query: 'reverse crunch proper form',
    A: M(LIE, { k: [86, 94], f: [62, 96], ...ARMS_DOWN }),
    B: M(LIE, { hp: [92, 110], k: [106, 88], f: [84, 80], ...ARMS_DOWN }),
  },
  curl: {
    cue: 'Elbows pinned to your sides. 2 seconds on the way down, no swinging.',
    query: 'dumbbell bicep curl form',
    db: ['w'],
    A: CURL_A,
    B: CURL_B,
  },
  ohtri: {
    cue: 'Both hands on one dumbbell. Elbows point at the ceiling and stay still; only the forearms move.',
    query: 'overhead dumbbell tricep extension form',
    db: ['w'],
    A: M(STAND, { e: [105, 16], w: [90, 30] }),
    B: M(STAND, { e: [105, 16], w: [107, -4] }),
  },
  lateral: {
    cue: 'Slight bend in the elbows, lead with the elbows, stop at shoulder height. Light weight, slow.',
    query: 'dumbbell lateral raise form',
    db: ['wl', 'wr'],
    A: M(FRONT, { el: [87, 61], wl: [86, 80], er: [113, 61], wr: [114, 80] }),
    B: M(FRONT, { el: [70, 40], wl: [51, 41], er: [130, 40], wr: [149, 41] }),
  },
  pike: {
    cue: 'Hips high, body an upside-down V. Lower your head to a spot just in front of your hands.',
    query: 'pike push up form beginner',
    A: { f: [52, 123], k: [72, 94], hp: [92, 66], n: [128, 98], h: [139, 104], e: [136, 111], w: [142, 123] },
    B: { f: [52, 123], k: [73, 95], hp: [96, 70], n: [132, 106], h: [146, 114], e: [121, 113], w: [142, 123] },
  },
  pullover: {
    cue: 'Lie on the floor, both hands on one dumbbell. Lower it behind your head with soft elbows, pull it back over your chest. Feel it in your lats.',
    query: 'dumbbell pullover on floor',
    db: ['w'],
    A: M(LIE, { e: [130, 99], w: [131, 79] }),
    B: M(LIE, { e: [150, 108], w: [170, 112] }),
  },
  bulgarian: {
    cue: 'Back foot laces-down on a chair. Most of your weight stays on the front leg. Go slow.',
    query: 'bulgarian split squat form',
    chair: [26, 58, 98, 'left'],
    A: { f: [128, 123], k: [120, 101], hp: [100, 80], k2: [76, 100], f2: [50, 96], n: [102, 40], h: [103, 29], e: [103, 60], w: [104, 79] },
    B: { f: [128, 123], k: [130, 97], hp: [98, 98], k2: [72, 117], f2: [50, 96], n: [100, 58], h: [101, 47], e: [101, 78], w: [102, 97] },
  },
  slrdl: {
    cue: 'Hips back, back flat. The free leg rises as your chest lowers. Hold a chair for balance at first.',
    query: 'single leg romanian deadlift form',
    db: ['w'],
    A: { f: [100, 123], k: [100, 102], hp: [100, 80], k2: [97, 102], f2: [93, 121], n: [100, 40], h: [100, 29], e: [100, 60], w: [100, 79] },
    B: { f: [100, 123], k: [103, 102], hp: [98, 80], k2: [73, 79], f2: [48, 78], n: [137, 74], h: [149, 71], e: [137, 94], w: [137, 113] },
  },
  sideplank: {
    cue: 'Elbow under the shoulder, hips high, body in one line from head to feet. Log the seconds as reps.',
    query: 'side plank form',
    A: { f: [40, 123], k: [65, 115], hp: [90, 107], n: [134, 92], h: [145, 85], e: [134, 123], w: [156, 123], e2: [136, 72], w2: [138, 51] },
  },
  legraise: {
    cue: 'Legs straight, hands flat beside you. Lower your legs slowly and stop just before your lower back lifts off the floor.',
    query: 'lying leg raise lower abs form',
    A: M(LIE, { k: [84, 94], f: [82, 70], ...ARMS_DOWN }),
    B: M(LIE, { k: [62, 113], f: [38, 108], ...ARMS_DOWN }),
  },
  hammer: {
    cue: 'Palms face each other the whole rep. Elbows pinned to your sides.',
    query: 'dumbbell hammer curl form',
    db: ['w'],
    A: CURL_A,
    B: CURL_B,
  },
  kickback: {
    cue: 'Hinge forward, upper arms tight along your sides and still. Straighten your arms back until they lock, squeeze for 1 second.',
    query: 'dumbbell tricep kickback form',
    db: ['w'],
    A: M(HINGE, { e: [106, 67], w: [110, 87] }),
    B: M(HINGE, { e: [106, 67], w: [86, 69] }),
  },
  reardelt: {
    cue: 'Hinge forward with a flat back. Raise your arms out wide and squeeze between your shoulder blades. Light weight.',
    query: 'bent over dumbbell rear delt fly form',
    db: ['wl', 'wr'],
    A: M(BENT, { el: [86, 80], wl: [86, 98], er: [114, 80], wr: [114, 98] }),
    B: M(BENT, { el: [68, 62], wl: [49, 63], er: [132, 62], wr: [151, 63] }),
  },
  dip: {
    cue: 'Chair against a wall so it can’t slide. Lower until your upper arms are level with the floor. Straighter legs = harder.',
    query: 'chair dip proper form',
    chair: [34, 70, 90, 'left'],
    A: { w: [68, 88], e: [69, 69], n: [70, 50], h: [74, 39], hp: [78, 90], k: [108, 90], f: [114, 123] },
    B: { w: [68, 88], e: [52, 76], n: [74, 72], h: [78, 61], hp: [80, 110], k: [108, 96], f: [114, 123] },
  },
  dbrow: {
    cue: 'One hand on a chair, back flat. Pull the dumbbell to your hip, not your chest. Your heaviest lift of the week.',
    query: 'one arm dumbbell row with chair',
    db: ['w'],
    chair: [140, 170, 88, 'right'],
    A: { f: [92, 123], k: [90, 101], f2: [64, 123], k2: [74, 100], hp: [85, 78], n: [128, 72], h: [140, 70], e2: [138, 80], w2: [148, 88], e: [128, 92], w: [128, 112] },
    B: { f: [92, 123], k: [90, 101], f2: [64, 123], k2: [74, 100], hp: [85, 78], n: [128, 72], h: [140, 70], e2: [138, 80], w2: [148, 88], e: [110, 62], w: [115, 82] },
  },
  squat: {
    cue: '3 seconds down, 1 second up. Arms forward for balance, heels stay on the floor.',
    query: 'bodyweight squat form',
    A: { f: [106, 123], k: [105, 102], hp: [103, 80], n: [102, 40], h: [102, 29], e: [103, 60], w: [104, 79] },
    B: { f: [106, 123], k: [124, 100], hp: [90, 98], n: [108, 62], h: [114, 52], e: [126, 66], w: [146, 64] },
  },
  slbridge: {
    cue: 'One foot planted, the other leg straight. Hips stay level at the top.',
    query: 'single leg glute bridge form',
    A: M(BRIDGE_DOWN, { k2: [72, 110], f2: [49, 102] }),
    B: M(BRIDGE_UP, { k2: [72, 85], f2: [48, 73] }),
  },
  hollow: {
    cue: 'Lower back pressed into the floor. Arms and legs as low as you can keep them without your back lifting. Bend the knees to make it easier. Log the seconds as reps.',
    query: 'hollow body hold beginner',
    A: { hp: [100, 119], n: [130, 111], h: [141, 106], e: [148, 101], w: [166, 95], k: [76, 112], f: [52, 105] },
  },
  deadbug: {
    cue: 'Arms up, knees over your hips. Slowly lower the opposite arm and leg while your lower back stays pressed into the floor. Alternate sides.',
    query: 'dead bug exercise form',
    A: M(LIE, { e: [130, 100], w: [130, 82], e2: [130, 100], w2: [130, 82], k: [86, 96], f: [64, 96], k2: [86, 96], f2: [64, 96] }),
    B: M(LIE, { e: [130, 100], w: [130, 82], e2: [148, 112], w2: [166, 115], k: [86, 96], f: [64, 96], k2: [63, 114], f2: [40, 118] }),
  },
  conc: {
    cue: 'Sit on the chair, elbow braced against your inner thigh. Curl up slowly, squeeze at the top, 3 seconds down.',
    query: 'seated concentration curl form',
    db: ['w'],
    chair: [64, 98, 95, 'left'],
    A: { f: [122, 123], k: [118, 94], hp: [90, 92], n: [104, 56], h: [110, 46], e: [112, 88], w: [113, 108] },
    B: { f: [122, 123], k: [118, 94], hp: [90, 92], n: [104, 56], h: [110, 46], e: [112, 88], w: [106, 69] },
  },
  calf: {
    cue: 'Stand on one foot on the yoga block, heel hanging off the edge, one hand on a wall. Lower the heel all the way, rise as high as you can, pause 1 second at the top.',
    query: 'single leg calf raise on step form',
    block: [96, 113, 38, 12],
    wall: 152,
    A: { t: [112, 113], f: [100, 117], k: [100, 96], hp: [100, 74], n: [99, 34], h: [99, 23], e: [114, 50], w: [150, 54], k2: [96, 96], f2: [86, 104] },
    B: { t: [112, 113], f: [106, 104], k: [102, 83], hp: [101, 61], n: [100, 21], h: [100, 10], e: [115, 37], w: [150, 41], k2: [97, 83], f2: [87, 91] },
  },
  skull: {
    cue: 'Lie on the floor, upper arms straight up and still. Lower the dumbbells to beside your head, then press up.',
    query: 'floor skull crusher dumbbell',
    db: ['w'],
    A: M(LIE, { e: [130, 97], w: [130, 77] }),
    B: M(LIE, { e: [130, 97], w: [146, 104] }),
  },
};

/** A YouTube search for real form videos of this demo. */
export function demoVideoUrl(key) {
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(DEMOS[key].query);
}

/** The pose at t (0 = A, 1 = B); a hold (no B) stays at A. */
export function poseAt(demo, t) {
  if (!demo.B) return demo.A;
  const out = {};
  for (const [k, p] of Object.entries(demo.A)) {
    const q = demo.B[k] || p;
    out[k] = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  }
  return out;
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  children.forEach((c) => node.append(c));
  return node;
}

const r1 = (n) => Math.round(n * 10) / 10;

function chairShapes([x1, x2, y, back]) {
  const parts = [
    el('line', { x1, y1: y, x2, y2: y, class: 'gym-demo__seat' }),
    el('line', { x1: x1 + 3, y1: y, x2: x1 + 3, y2: GROUND, class: 'gym-demo__prop' }),
    el('line', { x1: x2 - 3, y1: y, x2: x2 - 3, y2: GROUND, class: 'gym-demo__prop' }),
  ];
  const bx = back === 'left' ? x1 : x2;
  parts.push(el('line', { x1: bx, y1: y, x2: bx, y2: y - 30, class: 'gym-demo__prop' }));
  return parts;
}

/** Bones and head for a pose; returns the group and a function that moves it to another pose. */
function skeleton(pose, className) {
  const bones = PAIRS.filter(([a, b]) => pose[a] && pose[b]).map(([a, b]) => ({ a, b, node: el('line', {}) }));
  const head = pose.h ? el('circle', { r: 7 }) : null;
  const group = el('g', { class: className }, ...bones.map((x) => x.node), ...(head ? [head] : []));
  const place = (p) => {
    for (const { a, b, node } of bones) {
      node.setAttribute('x1', r1(p[a][0]));
      node.setAttribute('y1', r1(p[a][1]));
      node.setAttribute('x2', r1(p[b][0]));
      node.setAttribute('y2', r1(p[b][1]));
    }
    if (head) {
      head.setAttribute('cx', r1(p.h[0]));
      head.setAttribute('cy', r1(p.h[1]));
    }
  };
  place(pose);
  return { group, place };
}

function dumbbell() {
  return el(
    'g',
    { class: 'gym-demo__db' },
    el('rect', { x: -7, y: -1.5, width: 14, height: 3, rx: 1 }),
    el('rect', { x: -9, y: -5, width: 4, height: 10, rx: 1 }),
    el('rect', { x: 5, y: -5, width: 4, height: 10, rx: 1 }),
  );
}

// --- one animation loop for every figure on screen ---
const live = new Map(); // svg → draw(t)
let frame = null;

function prefersStill() {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function tick(now) {
  const t = (1 - Math.cos(((now % PERIOD_MS) / PERIOD_MS) * Math.PI * 2)) / 2;
  for (const [svgEl, draw] of live) {
    if (svgEl.isConnected) draw(t);
    else live.delete(svgEl); // the screen was re-rendered or left
  }
  frame = live.size ? requestAnimationFrame(tick) : null;
}

function animate(svgEl, draw) {
  if (prefersStill() || typeof requestAnimationFrame !== 'function') return;
  live.set(svgEl, draw);
  if (frame === null) frame = requestAnimationFrame(tick);
}

/**
 * The figure for a demo as an <svg> element (null for an unknown key). Moving demos animate while they
 * are on screen; with reduced motion they show the start, over the outline of the end.
 */
export function demoFigure(key, label = key) {
  const demo = DEMOS[key];
  if (!demo) return null;
  const root = el('svg', { viewBox: '0 -12 200 142', class: 'gym-demo', role: 'img', 'aria-label': `${label}: how to do it`, 'data-demo': key });
  root.append(el('line', { x1: 10, y1: GROUND + 1.5, x2: 190, y2: GROUND + 1.5, class: 'gym-demo__floor' }));
  if (demo.chair) root.append(...chairShapes(demo.chair));
  if (demo.wall) root.append(el('line', { x1: demo.wall, y1: -12, x2: demo.wall, y2: GROUND, class: 'gym-demo__wall' }));
  if (demo.block) {
    const [x, y, width, height] = demo.block;
    root.append(el('rect', { x, y, width, height, rx: 1.5, class: 'gym-demo__block' }));
  }
  if (demo.B) root.append(skeleton(demo.B, 'gym-demo__ghost').group);

  const body = skeleton(demo.A, 'gym-demo__body');
  root.append(body.group);
  const weights = (demo.db || []).map((k) => ({ k, node: dumbbell() }));
  weights.forEach(({ node }) => root.append(node));
  const draw = (t) => {
    const pose = poseAt(demo, t);
    body.place(pose);
    for (const { k, node } of weights) node.setAttribute('transform', `translate(${r1(pose[k][0])} ${r1(pose[k][1])})`);
  };
  draw(0);

  if (demo.B) animate(root, draw);
  else {
    const hold = el('text', { x: 186, y: 4, 'text-anchor': 'end', class: 'gym-demo__hold' });
    hold.textContent = 'HOLD';
    root.append(hold);
  }
  return root;
}

/** Figures currently animating (tests). */
export function liveFigureCount() {
  return live.size;
}
