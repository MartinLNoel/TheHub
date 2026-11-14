// The places of the story, drawn behind the characters. Outdoor places use sky(), which follows the
// scene's weather (story/weather.js: light, sky, precip, fog); indoor places show it through a window.
import { H, W, dither, mix, seeded } from './pixel.js';

const SKIES = {
  'night-clear': ['#141127', '#1f1838', '#33224a', '#4e2d52'],
  'night-cloudy': ['#15141f', '#201e2e', '#2e2a3c', '#3d3546'],
  'night-overcast': ['#121318', '#1a1b22', '#23242c', '#2d2e36'],
  'dusk-clear': ['#2b2350', '#5a3a6e', '#b0566a', '#f0a060'],
  'dusk-cloudy': ['#2e2a44', '#4e3f5c', '#86606a', '#c08070'],
  'dusk-overcast': ['#3a3644', '#4e4854', '#625a64', '#7a7070'],
  'day-clear': ['#4f8fd6', '#6aa6e0', '#8cc0ea', '#bfe0f2'],
  'day-cloudy': ['#5f86b8', '#7c9cc6', '#9cb6d4', '#c6d6e4'],
  'day-overcast': ['#6a737f', '#7a838e', '#8c949e', '#a2a9b2'],
};

export function skyColors(env) {
  return SKIES[`${env.light}-${env.sky}`] || SKIES['night-clear'];
}

/** The sky colour of a pixel (dithered bands down to the horizon). */
export function skyAt(env, x, y, horizon) {
  const cols = skyColors(env);
  const p = Math.min(Math.max(y, 0) / horizon, 0.999) * (cols.length - 1);
  const i = Math.floor(p);
  return dither(x, y) < p - i ? cols[i + 1] : cols[i];
}

/** Fills the sky down to the horizon, with stars and moon, sun or clouds as the weather allows. */
export function sky(L, env, horizon = 75, { x1 = 0, y1 = 0, x2 = W - 1, y2 = horizon } = {}) {
  for (let y = y1; y <= Math.min(y2, horizon); y++) for (let x = x1; x <= x2; x++) L.set(x, y, skyAt(env, x, y, horizon));
  const inside = (x, y) => x >= x1 && x <= x2 && y >= y1 && y <= Math.min(y2, horizon);
  const rnd = seeded(11);
  if (env.light === 'night' && env.sky !== 'overcast') {
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(rnd() * W);
      const y = Math.floor(rnd() * horizon * 0.55);
      if (inside(x, y)) L.set(x, y, i % 3 ? '#cfc8e8' : '#8a82a8');
    }
    if (inside(128, 18)) {
      L.disc(128, 18, 6, '#f2e8c9');
      for (let y = 9; y <= 25; y++) for (let x = 124; x <= 140; x++) if ((x - 131) ** 2 + (y - 15.5) ** 2 <= 30 && inside(x, y)) L.set(x, y, skyAt(env, x, y, horizon));
    }
  }
  if (env.light === 'day' && env.sky === 'clear' && inside(130, 20)) {
    L.disc(130, 20, 8, '#fff2b0').disc(130, 20, 6, '#fff8d8');
  }
  if (env.light === 'dusk' && env.sky !== 'overcast' && inside(30, horizon - 8)) {
    for (let y = horizon - 16; y <= horizon; y++) for (let x = 18; x <= 42; x++) if ((x - 30) ** 2 + (y - horizon + 4) ** 2 <= 110 && inside(x, y)) L.set(x, y, '#ffcf80');
  }
  if (env.sky !== 'clear') {
    const cloud = env.light === 'day' ? '#e6ecf2' : env.light === 'dusk' ? '#9a7a8a' : '#3a3648';
    const cloudShade = env.light === 'day' ? '#c2ccd6' : env.light === 'dusk' ? '#7a5e70' : '#2c2938';
    const n = env.sky === 'overcast' ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const cx = 10 + rnd() * 140;
      const cy = 6 + rnd() * horizon * 0.45;
      const w = 10 + rnd() * 16;
      for (let y = Math.floor(cy - 5); y <= cy + 4; y++) {
        for (let x = Math.floor(cx - w); x <= cx + w; x++) {
          const d = ((x - cx) / w) ** 2 + ((y - cy) / 5) ** 2;
          if (d <= 1 && inside(x, y) && (d < 0.7 || dither(x, y) < 0.5)) L.set(x, y, y > cy + 1 ? cloudShade : cloud);
        }
      }
    }
  }
}

/** Warm light around a lamp, dithered so it stays pixel art. Weaker by day. */
export function glow(L, gx, gy, r, env, color = '#ffb347', strength = 1) {
  const k = (env.light === 'day' ? 0.35 : env.light === 'dusk' ? 0.7 : 1) * strength;
  for (let y = Math.max(0, Math.floor(gy - r)); y < Math.min(H, gy + r); y++) {
    for (let x = Math.max(0, Math.floor(gx - r)); x < Math.min(W, gx + r); x++) {
      const d = Math.hypot(x - gx, (y - gy) * 1.15);
      if (d > r) continue;
      const t = Math.pow(1 - d / r, 1.6) * k;
      const c = L.get(x, y);
      if (!c) continue;
      L.set(x, y, mix(c, color, t > dither(x, y) * 0.9 ? Math.min(0.55, t * 0.9 + 0.08) : t * 0.35));
    }
  }
}

/** Darkens a whole layer for night, a little for dusk (so places drawn in daylight colours fit). */
export function shadeFor(L, env, x1 = 0, y1 = 0, x2 = W - 1, y2 = H - 1) {
  const to = env.light === 'night' ? '#141127' : env.light === 'dusk' ? '#3a2550' : null;
  if (!to) return;
  const t = env.light === 'night' ? 0.55 : 0.25;
  L.tint(x1, y1, x2, y2, (c) => mix(c, to, t));
}

// ---------- ground and water ----------

export function boardwalk(L, y0 = 96) {
  for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) L.set(x, y, '#5b3d2a');
  for (let row = 0; y0 + row * 6 < H; row++) {
    const y = y0 + row * 6;
    for (let x = 0; x < W; x++) {
      L.set(x, y, '#7a5438');
      L.set(x, y + 5, '#2b1d15');
    }
    for (let x = (row * 17) % 23; x < W; x += 23) {
      L.line(x, y + 1, x, y + 4, '#2b1d15');
      L.set(x + 2, y + 2, '#9a8b78').set(x - 3, y + 3, '#9a8b78');
    }
  }
}

export function water(L, y1, y2, { base = '#141a27', ripple = '#26314a' } = {}) {
  for (let y = y1; y <= y2; y++) for (let x = 0; x < W; x++) L.set(x, y, base);
  for (let y = y1 + 2; y <= y2; y += 3) for (let x = (y * 7) % 11; x < W; x += 13) L.line(x, y, x + 2, y, ripple);
}

export function mud(L, y0, { c = '#4a3a26', dark = '#33281a', hi = '#5e4a32' } = {}) {
  for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) L.set(x, y, dither(x, y) < 0.15 ? dark : dither(x + 2, y) > 0.92 ? hi : c);
  for (let x = 0; x < W; x++) L.set(x, y0, hi);
}

export function reeds(L, xs, top, bottom, { c = '#1f2b24', head = '#3b2a1f' } = {}) {
  xs.forEach((x, i) => {
    const t = top + ((i * 5) % 9);
    L.line(x, t, x, bottom, c);
    if (i % 2 === 0) L.rect(x, t - 4, x + 1, t, head);
    else L.line(x, t, x - 2, t - 5, c);
  });
}

function farShore(L, env, y = 70) {
  const far = env.light === 'day' ? '#4a5a5a' : env.light === 'dusk' ? '#2c2238' : '#1b1529';
  const win = env.light === 'day' ? '#6a7a7a' : '#f5c66b';
  L.rect(0, y, W - 1, y + 4, far);
  [[0, y - 6, 7], [26, y - 4, 6], [90, y - 7, 9], [104, y - 5, 7], [150, y - 8, 10]].forEach(([cx, cy, r]) => L.disc(cx, cy, r, far));
  const house = (x1, x2, top, roof) => {
    L.rect(x1, top, x2, y, far).poly([[x1 - 2, top], [(x1 + x2) / 2, top - roof], [x2 + 2, top]], far);
    for (let x = x1 + 2; x <= x2; x += 5) L.line(x, y, x, y + 6, far);
  };
  house(8, 24, y - 9, 6);
  house(116, 138, y - 13, 7);
  house(143, 159, y - 8, 5);
  [[12, y - 6], [19, y - 6], [121, y - 9], [131, y - 9], [148, y - 4]].forEach(([x, wy]) => L.rect(x, wy, x + 1, wy + 1, win));
}

function lantern(L, x, top, groundY) {
  L.rect(x, top, x + 1, groundY, '#3e2a1d').line(x, top, x + 8, top, '#3e2a1d').set(x + 8, top + 1, '#26232b');
  L.rect(x + 6, top + 2, x + 10, top + 10, '#26232b').rect(x + 7, top + 3, x + 9, top + 9, '#ffd36b').set(x + 8, top + 4, '#fff3c4');
  L.rect(x + 5, top + 11, x + 11, top + 11, '#26232b');
  return [x + 8, top + 6];
}

const POSTER = '#e6d3a3';
function poster(L, x, y, face, { w = 9, h = 12 } = {}) {
  L.rect(x, y, x + w, y + h, POSTER).line(x + w, y + 1, x + w, y + h, '#bfa774').line(x + 1, y + h, x + w, y + h, '#bfa774');
  L.rect(x + 1, y + 1, x + w - 1, y + 2, '#a8322d');
  if (face) face(x + Math.round(w / 2), y + Math.round(h / 2));
  L.line(x + 2, y + h - 2, x + w - 2, y + h - 2, '#8a7a5a').set(x + Math.round(w / 2), y, '#c9c9c9');
}
const INK = '#2b2320';
export const FACES = {
  lizard: (L) => (x, y) => L.rect(x - 2, y - 1, x + 2, y + 1, INK).set(x + 3, y, INK).set(x - 1, y - 1, '#a8322d'),
  heron: (L) => (x, y) => L.line(x, y - 2, x, y + 2, INK).line(x + 1, y - 2, x + 3, y - 1, INK),
  snake: (L) => (x, y) => L.line(x - 3, y + 1, x - 1, y - 1, INK).line(x - 1, y - 1, x + 1, y + 1, INK).line(x + 1, y + 1, x + 3, y - 1, INK),
  toad: (L) => (x, y) => L.disc(x, y, 2, INK),
  frog: (L) => (x, y) => L.disc(x, y, 2, '#3b7631').set(x - 1, y - 2, INK).set(x + 1, y - 2, INK),
  crown: (L) => (x, y) => L.rect(x - 2, y, x + 2, y + 1, '#e2b23c').set(x - 2, y - 1, '#e2b23c').set(x, y - 2, '#e2b23c').set(x + 2, y - 1, '#e2b23c'),
};

function guildBoard(L, x = 11, y = 43, { faces = ['lizard', 'heron', 'snake', 'toad', 'lizard'], gap = [36, 69] } = {}) {
  L.rect(x + 5, y + 3, x + 7, 96, '#3e2a1d').rect(x + 45, y + 3, x + 47, 96, '#3e2a1d');
  L.rect(x, y + 5, x + 52, y + 42, '#3e2a1d').rect(x + 1, y + 6, x + 51, y + 41, '#6e4b33');
  for (let yy = y + 9; yy < y + 41; yy += 5) for (let xx = x + 2; xx < x + 51; xx++) if (dither(xx, yy) < 0.5) L.set(xx, yy, '#5f4029');
  L.rect(x - 3, y, x + 55, y + 3, '#3e2a1d').rect(x - 2, y, x + 54, y, '#8a6040');
  L.rect(x + 15, y - 5, x + 37, y - 1, '#3e2a1d').rect(x + 16, y - 4, x + 36, y - 2, '#4c3423');
  for (let xx = x + 18; xx <= x + 34; xx += 3) L.rect(xx, y - 3, xx + 1, y - 3, '#e2b23c');
  const spots = [[x + 4, y + 8], [x + 18, y + 10], [x + 32, y + 7], [x + 6, y + 25], [x + 37, y + 24]];
  spots.forEach(([px, py], i) => faces[i] && poster(L, px, py, FACES[faces[i]](L)));
  if (gap) L.set(gap[0], gap[1], '#c9c9c9').set(gap[0] - 1, gap[1] + 1, POSTER).set(gap[0], gap[1] + 1, POSTER);
}

// ---------- places ----------
// Each returns { ground (the y characters stand on), lights: [[x, y, r]], window: [x1, y1, x2, y2] | null,
// outdoor, flies (fireflies) }.

/** Lilyhollow's boardwalk by the marsh, with the Guild board and a lantern. */
export function boardwalkTown(L, env, { board = true, faces = null, lanternX = 70, banners = false } = {}) {
  sky(L, env, 75);
  farShore(L, env);
  water(L, 75, 95);
  reeds(L, [3, 6, 11, 78, 82, 85, 140, 144, 147, 153, 157], 66, 95);
  boardwalk(L, 96);
  if (board) guildBoard(L, 11, 43, faces ? { faces, gap: null } : undefined);
  if (banners) {
    const cols = ['#a8322d', '#e2b23c', '#3c7fd6', '#5fae4a'];
    for (let x = 0; x < W; x += 4) L.set(x, 30 + Math.round(Math.sin(x / 9) * 3), '#3e2a1d');
    for (let x = 4, i = 0; x < W; x += 12, i++) L.poly([[x, 31 + Math.round(Math.sin(x / 9) * 3)], [x + 6, 31 + Math.round(Math.sin(x / 9) * 3)], [x + 3, 38]], cols[i % 4]);
  }
  const lights = [];
  if (lanternX !== null) lights.push([...lantern(L, lanternX, 33, 96), 34]);
  return { ground: 96, lights, window: null, outdoor: true, flies: env.light !== 'day' && env.precip === 'none' };
}

/** The Guild hall inside: plank walls, the great board, a lamp and a window. */
export function guildHall(L, env, { bigPoster = true } = {}) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) L.set(x, y, (x % 12 === 0) ? '#3a2618' : dither(x, y) < 0.2 ? '#54392a' : '#5e4130');
  for (let x = 0; x < W; x++) L.set(x, 14, '#3a2618').set(x, 15, '#7a5438');
  // window with the weather
  const win = [118, 26, 148, 58];
  sky(L, env, 58, { x1: win[0], y1: win[1], x2: win[2], y2: win[3] });
  L.rect(win[0] - 2, win[1] - 2, win[2] + 2, win[1] - 1, '#2b1d15').rect(win[0] - 2, win[3] + 1, win[2] + 2, win[3] + 3, '#2b1d15');
  L.rect(win[0] - 2, win[1], win[0] - 1, win[3], '#2b1d15').rect(win[2] + 1, win[1], win[2] + 2, win[3], '#2b1d15');
  L.line(133, win[1], 133, win[3], '#2b1d15').line(win[0], 42, win[2], 42, '#2b1d15');
  // the great board with the oldest poster
  L.rect(30, 20, 96, 74, '#3e2a1d').rect(31, 21, 95, 73, '#6e4b33');
  if (bigPoster) {
    L.rect(48, 25, 78, 66, POSTER).line(78, 26, 78, 66, '#bfa774').line(49, 66, 78, 66, '#bfa774');
    L.rect(49, 26, 77, 30, '#a8322d');
    for (let x = 51; x <= 75; x += 3) L.set(x, 28, '#e6d3a3');
    // the Heron Baron, drawn in ink
    L.line(63, 58, 63, 44, INK).line(66, 58, 66, 44, INK).body(64, 42, 6, 5, INK, INK, null);
    L.capsule(66, 38, 69, 34, 1, INK).line(69, 34, 75, 33, INK).set(68, 33, '#a8322d');
    L.rect(58, 60, 72, 61, '#8a7a5a').rect(56, 63, 74, 63, '#8a7a5a');
    // Tad's father's knuckle, pinned to it
    for (let a = 0; a < 12; a++) L.set(52 + Math.round(Math.cos((a / 12) * Math.PI * 2) * 3), 52 + Math.round(Math.sin((a / 12) * Math.PI * 2) * 3), '#9aa3ad');
    L.set(52, 48, '#c9c9c9');
  }
  [[35, 24], [82, 26], [36, 46], [83, 50]].forEach(([x, y], i) => poster(L, x, y, FACES[['lizard', 'snake', 'toad', 'heron'][i]](L)));
  // floor, desk, lamp
  for (let y = 96; y < H; y++) for (let x = 0; x < W; x++) L.set(x, y, (y - 96) % 6 === 0 ? '#7a5438' : '#5b3d2a');
  L.rect(0, 92, W - 1, 95, '#3a2618');
  L.rect(6, 78, 34, 82, '#4c3423').rect(8, 83, 10, 96, '#3a2618').rect(30, 83, 32, 96, '#3a2618');
  L.rect(12, 74, 22, 77, '#e6d3a3').rect(26, 72, 28, 77, '#2b2320');
  L.rect(104, 8, 105, 30, '#2b1d15').rect(100, 30, 109, 38, '#26232b').rect(101, 31, 108, 37, '#ffd36b');
  return { ground: 106, lights: [[104, 34, 40]], window: win, outdoor: false, flies: false };
}

/** The market street: stalls with striped awnings, crates and sacks. */
export function market(L, env) {
  sky(L, env, 60);
  const wall = ['#b89a72', '#9a7a58', '#c8ab82'];
  [[0, 34, 42], [44, 28, 86], [88, 36, 124], [126, 30, 159]].forEach(([x1, top, x2], i) => {
    L.rect(x1, top, x2, 80, wall[i % 3]).poly([[x1 - 2, top], [(x1 + x2) / 2, top - 10], [x2 + 2, top]], '#6e4b33');
    L.rect(x1 + 6, top + 10, x1 + 12, top + 18, env.light === 'day' ? '#4a5a6a' : '#f5c66b');
  });
  shadeFor(L, env, 0, 18, W - 1, 80);
  // awnings
  [[4, 52, '#a8322d'], [56, 50, '#3c7fd6'], [108, 52, '#5fae4a']].forEach(([x, y, c]) => {
    for (let i = 0; i < 40; i++) L.line(x + i, y, x + i + 4, y + 8, Math.floor(i / 5) % 2 ? c : '#efe2c4');
    L.rect(x, y + 8, x + 2, 86, '#3e2a1d').rect(x + 40, y + 8, x + 42, 86, '#3e2a1d');
    L.rect(x + 2, 74, x + 40, 80, '#6e4b33');
    for (let k = 0; k < 6; k++) L.disc(x + 7 + k * 6, 72, 2.5, ['#d0562e', '#e2b23c', '#95d46c'][k % 3]);
  });
  for (let y = 86; y < H; y++) for (let x = 0; x < W; x++) L.set(x, y, dither(x, y) < 0.5 ? '#7a6a58' : '#6a5a48');
  for (let x = 0; x < W; x += 9) L.line(x, 86, x - 6, H - 1, '#5a4a3a');
  L.rect(0, 86, W - 1, 86, '#8a7a68');
  shadeFor(L, env, 0, 81, W - 1, H - 1);
  return { ground: 108, lights: [], window: null, outdoor: true, flies: false };
}

/** Mossback's training yard: a fence, a beam with a hanging log, mud. */
export function yard(L, env) {
  sky(L, env, 70);
  const hill = env.light === 'day' ? '#4a6a3a' : '#2a3a2a';
  for (let x = 0; x < W; x++) L.line(x, 62 + Math.round(Math.sin(x / 17) * 4), x, 70, hill);
  mud(L, 70);
  for (let x = 2; x < W; x += 14) L.rect(x, 74, x + 2, 90, '#6e4b33');
  L.rect(0, 77, W - 1, 78, '#8a6040').rect(0, 84, W - 1, 85, '#8a6040');
  // the beam and the log bag
  L.rect(98, 26, 100, 104, '#4c3423').rect(98, 26, 150, 28, '#4c3423').rect(148, 26, 150, 104, '#4c3423');
  L.line(124, 29, 124, 46, '#c9b26a');
  L.body(124, 62, 9, 16, '#8a6040', '#5e4130', '#a87a52');
  L.rect(116, 54, 132, 55, '#3a2618').rect(116, 70, 132, 71, '#3a2618');
  shadeFor(L, env, 0, 62, W - 1, H - 1);
  return { ground: 108, lights: [], window: null, outdoor: true, flies: false };
}

/** The river bank by day: water, a few rocks, the Guild town far behind. */
export function riverbank(L, env) {
  sky(L, env, 66);
  farShore(L, env, 64);
  water(L, 69, 92, { base: env.light === 'day' ? '#3a6a8a' : '#141a27', ripple: env.light === 'day' ? '#6a9aba' : '#26314a' });
  mud(L, 92, { c: '#5a4a2e', dark: '#3e321e', hi: '#7a6440' });
  reeds(L, [5, 9, 140, 146, 152], 78, 93);
  [[30, 96], [118, 99]].forEach(([x, y]) => L.body(x, y, 7, 4, '#6a6a6a', '#4a4a4a', '#8a8a8a'));
  shadeFor(L, env, 0, 92, W - 1, H - 1);
  return { ground: 108, lights: [], window: null, outdoor: true, flies: env.light !== 'day' };
}

/** The reed maze: reeds taller than a frog on every side. */
export function reedMaze(L, env) {
  sky(L, env, 50);
  const rnd = seeded(5);
  const back = env.light === 'day' ? '#4a6a42' : '#1f2b24';
  const front = env.light === 'day' ? '#36502e' : '#16201a';
  const backDark = env.light === 'day' ? '#3e5a38' : '#18221c';
  for (let x = 0; x < W; x++) {
    const top = 30 + Math.floor(Math.abs(Math.sin(x * 1.7) * 7) + Math.abs(Math.sin(x * 0.37) * 7));
    L.line(x, top, x, 100, x % 3 === 0 ? backDark : back);
    if (x % 6 === 0) L.rect(x, top - 4, x + 1, top, '#5a4428');
  }
  mud(L, 100, { c: '#3a3a26', dark: '#26261a', hi: '#4a4a32' });
  for (let x = 1; x < W; x += 5) {
    if (x > 60 && x < 100) continue;
    const t = 20 + Math.floor(rnd() * 20);
    L.line(x, t, x, H - 1, front).rect(x, t - 6, x + 1, t, '#4a3420');
  }
  return { ground: 110, lights: [], window: null, outdoor: true, flies: false };
}

/** The smithy: a forge fire, an anvil, tools on the wall, a window. */
export function forge(L, env) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) L.set(x, y, dither(x, y) < 0.3 ? '#2e2420' : '#3a2e28');
  for (let y = 10; y < 90; y += 7) for (let x = (y % 14 ? 0 : 7); x < W; x += 14) L.rect(x, y, x + 12, y + 5, '#443630');
  const win = [10, 22, 34, 46];
  sky(L, env, 46, { x1: win[0], y1: win[1], x2: win[2], y2: win[3] });
  L.rect(win[0] - 2, win[1] - 2, win[2] + 2, win[1] - 1, '#1e1814').rect(win[0] - 2, win[3] + 1, win[2] + 2, win[3] + 2, '#1e1814').line(22, win[1], 22, win[3], '#1e1814');
  // forge and fire
  L.rect(112, 52, 154, 92, '#5a4a40').rect(116, 56, 150, 70, '#1a1210');
  L.poly([[118, 70], [124, 58], [130, 66], [136, 56], [142, 66], [148, 70]], '#ff8a2a');
  L.poly([[124, 70], [130, 62], [136, 70]], '#ffe07a');
  L.rect(120, 10, 146, 52, '#4a3a32');
  // anvil
  L.rect(62, 88, 90, 92, '#3a3f46').rect(68, 93, 84, 100, '#2a2e34').rect(64, 101, 88, 104, '#2a2e34').rect(90, 89, 96, 90, '#3a3f46');
  // tools
  [[46, 30], [56, 28], [66, 31]].forEach(([x, y]) => L.line(x, y, x, y + 16, '#6e4b33').rect(x - 2, y, x + 2, y + 3, '#7a8088'));
  for (let y = 104; y < H; y++) for (let x = 0; x < W; x++) L.set(x, y, dither(x, y) < 0.5 ? '#2a221e' : '#322824');
  return { ground: 112, lights: [[132, 62, 52]], window: win, outdoor: false, flies: false, fireLight: true };
}

/** A wooden bridge over the river. */
export function bridge(L, env) {
  sky(L, env, 60);
  const hill = env.light === 'day' ? '#4a6a3a' : '#22301f';
  for (let x = 0; x < W; x++) L.line(x, 52 + Math.round(Math.sin(x / 13) * 5), x, 62, hill);
  water(L, 62, H - 1, { base: env.light === 'day' ? '#3a6a8a' : '#141a27', ripple: env.light === 'day' ? '#6a9aba' : '#26314a' });
  // deck and rails
  L.rect(0, 92, W - 1, 98, '#6e4b33').rect(0, 92, W - 1, 92, '#8a6040').rect(0, 98, W - 1, 99, '#3e2a1d');
  for (let x = 0; x < W; x += 6) L.line(x, 93, x, 97, '#4c3423');
  L.rect(0, 74, W - 1, 75, '#6e4b33');
  for (let x = 4; x < W; x += 20) L.rect(x, 74, x + 2, 92, '#4c3423');
  for (let x = 20; x < W; x += 40) L.rect(x, 100, x + 4, H - 1, '#3e2a1d');
  shadeFor(L, env, 0, 52, W - 1, H - 1);
  return { ground: 95, lights: [], window: null, outdoor: true, flies: false };
}

/** A muddy path through dark trees, the healer's hut lit far away. */
export function stormPath(L, env) {
  sky(L, env, 92);
  const rnd = seeded(3);
  const tree = env.light === 'day' ? '#2e4a2a' : '#121a14';
  const treeHi = env.light === 'day' ? '#3e5e36' : '#1a2620';
  for (let i = 0; i < 8; i++) {
    const x = 6 + i * 20 + Math.floor(rnd() * 8);
    const top = 26 + Math.floor(rnd() * 14);
    L.rect(x, top, x + 2, 92, tree);
    for (let k = 0; k < 5; k++) L.disc(x + 1 + (rnd() - 0.5) * 16, top + (rnd() - 0.5) * 10, 6 + rnd() * 4, k % 2 ? tree : treeHi);
  }
  L.rect(122, 70, 140, 84, '#2a2018').poly([[118, 70], [131, 60], [144, 70]], '#1e1610').rect(128, 74, 132, 78, '#ffd36b');
  mud(L, 92, { c: '#3a2e20', dark: '#261e14', hi: '#4e3e2a' });
  for (let x = 0; x < W; x += 1) if (dither(x, 100) < 0.3) L.set(x, 100 + ((x * 7) % 9), '#5a6a8a');
  shadeFor(L, env, 0, 30, W - 1, H - 1);
  return { ground: 110, lights: [[130, 76, 22]], window: null, outdoor: true, flies: false };
}

/** Lilyhollow burning: the far houses on fire, smoke over the water. */
export function burning(L, env) {
  boardwalkTown(L, env, { board: false, lanternX: null });
  const rnd = seeded(9);
  for (const [x1, x2, top] of [[8, 24, 61], [116, 138, 57], [143, 159, 62]]) {
    for (let i = 0; i < 18; i++) {
      const x = x1 + Math.floor(rnd() * (x2 - x1));
      const h = 4 + Math.floor(rnd() * 12);
      L.line(x, top - h, x, top + 4, rnd() < 0.5 ? '#ff8a2a' : '#ffd36b');
    }
  }
  for (let y = 10; y < 50; y++) for (let x = 0; x < W; x++) if (dither(x, y) < 0.18 && (x > 100 || x < 40)) L.set(x, y, '#4a3a3a');
  return { ground: 96, lights: [[18, 58, 30], [128, 54, 34]], window: null, outdoor: true, flies: false, fireLight: true };
}

/** A camp in the open: a fire, logs, the night or the evening around it. */
export function camp(L, env) {
  sky(L, env, 78);
  const hill = env.light === 'day' ? '#4a6a3a' : '#1a2418';
  for (let x = 0; x < W; x++) L.line(x, 66 + Math.round(Math.sin(x / 11) * 4 + Math.sin(x / 5) * 1.5), x, 80, hill);
  mud(L, 80, { c: '#3a3424', dark: '#28241a', hi: '#4a4430' });
  shadeFor(L, env, 0, 66, W - 1, H - 1);
  L.rect(66, 100, 94, 103, '#5e4130').line(70, 104, 90, 98, '#4c3423');
  L.poly([[70, 100], [75, 88], [80, 96], [85, 86], [90, 100]], '#ff8a2a').poly([[75, 100], [80, 91], [85, 100]], '#ffe07a');
  return { ground: 108, lights: [[80, 94, 46]], window: null, outdoor: true, flies: env.light !== 'day' && env.precip === 'none', fireLight: true };
}

/** The mountain pass to the highlands: rocks, a narrow path, cliffs behind. */
export function mountains(L, env) {
  sky(L, env, 70);
  const far = env.light === 'day' ? '#7a8a9a' : '#2a2a3a';
  const near = env.light === 'day' ? '#5a6a6a' : '#1e2028';
  L.poly([[0, 70], [30, 22], [56, 52], [84, 14], [120, 50], [140, 30], [159, 46], [159, 70]], far);
  [[30, 22], [84, 14], [140, 30]].forEach(([x, y]) => L.poly([[x - 6, y + 8], [x, y], [x + 6, y + 8]], '#e6ecf2'));
  L.poly([[0, 90], [24, 58], [50, 80], [80, 62], [110, 84], [140, 60], [159, 76], [159, 90]], near);
  for (let y = 90; y < H; y++) for (let x = 0; x < W; x++) L.set(x, y, dither(x, y) < 0.4 ? '#5a5248' : '#6a6258');
  L.rect(0, 90, W - 1, 90, '#7a7268');
  shadeFor(L, env, 0, 14, W - 1, H - 1);
  return { ground: 106, lights: [], window: null, outdoor: true, flies: false };
}

/** The salt marsh: flat, pale pools, white crust. */
export function saltMarsh(L, env) {
  sky(L, env, 72);
  for (let y = 72; y < H; y++) for (let x = 0; x < W; x++) L.set(x, y, dither(x, y) < 0.3 ? '#a8a28a' : '#bcb69c');
  const rnd = seeded(13);
  for (let i = 0; i < 7; i++) {
    const cx = rnd() * W;
    const cy = 78 + rnd() * 34;
    L.body(cx, cy, 10 + rnd() * 10, 2 + rnd() * 2, env.light === 'day' ? '#7aa0b0' : '#2a3a4a', env.light === 'day' ? '#6a8a9a' : '#22303e', null);
  }
  reeds(L, [8, 14, 150, 155], 74, 90, { c: '#6a6a4a', head: '#8a7a5a' });
  shadeFor(L, env, 0, 72, W - 1, H - 1);
  return { ground: 108, lights: [], window: null, outdoor: true, flies: false };
}

/** The ferry landing: a dock over dark water, the ferry tied up, a lantern. */
export function ferry(L, env) {
  sky(L, env, 70);
  water(L, 70, H - 1);
  L.poly([[96, 82], [156, 82], [150, 94], [102, 94]], '#4c3423').rect(102, 78, 150, 82, '#6e4b33');
  L.line(126, 40, 126, 78, '#3e2a1d').poly([[127, 42], [146, 70], [127, 70]], '#c9bfa6');
  L.rect(0, 98, 92, 104, '#6e4b33').rect(0, 98, 92, 98, '#8a6040');
  for (let x = 6; x < 92; x += 18) L.rect(x, 104, x + 3, H - 1, '#3e2a1d');
  const light = lantern(L, 82, 62, 98);
  return { ground: 101, lights: [[...light, 30]], window: null, outdoor: true, flies: false };
}

/** Inside the herons' cage: thick wooden bars, straw, a slit of sky. */
export function cage(L, env) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) L.set(x, y, dither(x, y) < 0.4 ? '#1a1512' : '#221c18');
  const win = [64, 10, 96, 24];
  sky(L, env, 24, { x1: win[0], y1: win[1], x2: win[2], y2: win[3] });
  for (let y = 104; y < H; y++) for (let x = 0; x < W; x++) L.set(x, y, dither(x, y) < 0.5 ? '#8a7a42' : '#6a5e32');
  for (let i = 0; i < 40; i++) L.line((i * 37) % W, 104, (i * 37) % W + 3, 101, '#a89a52');
  return { ground: 108, lights: [[80, 18, 30]], window: win, outdoor: false, flies: false, bars: true };
}

/** The Roost: a huge dead tree full of nests, high over the marsh. */
export function roost(L, env, { top = false } = {}) {
  sky(L, env, 100);
  const wood = env.light === 'day' ? '#5a4a3a' : '#2a221c';
  const woodHi = env.light === 'day' ? '#7a6650' : '#3a3028';
  if (top) {
    L.poly([[0, 96], [50, 88], [110, 90], [159, 84], [159, H - 1], [0, H - 1]], wood);
    for (let x = 0; x < W; x += 3) L.set(x, 89 + Math.round(Math.sin(x / 7) * 2), woodHi);
    for (let i = 0; i < 30; i++) L.line(10 + i * 5, 92, 14 + i * 5, 86, '#6a5a3a');
    return { ground: 100, lights: [], window: null, outdoor: true, flies: false };
  }
  L.rect(60, 0, 100, H - 1, wood).rect(60, 0, 66, H - 1, woodHi);
  [[60, 30, 20, 20], [100, 50, 140, 36], [60, 70, 16, 62], [100, 90, 150, 80]].forEach(([x1, y1, x2, y2]) => L.capsule(x1, y1, x2, y2, 3, wood));
  [[22, 18], [138, 34], [20, 60], [146, 78]].forEach(([x, y]) => L.body(x, y, 9, 4, '#6a5a3a', '#4a3e28', '#8a7a52'));
  for (let y = 100; y < H; y++) for (let x = 0; x < W; x++) if (x < 60 || x > 100) L.set(x, y, y === 100 ? '#26314a' : '#141a27');
  return { ground: 108, lights: [], window: null, outdoor: true, flies: false };
}
