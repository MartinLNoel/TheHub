// The pet's pixel art, drawn frame by frame on a 40 × 32 grid and scaled up without smoothing (like the Fighter).
// A small round marsh creature from the Fighter's world: a mossling, with frilly gills and a sprout that grows
// with its stage. Every pose is drawn from code, so there are no image files.
//
// draw(g, { stage, mood, t, action }) — g: a 2D context of a GW × GH canvas; t: the frame number (8 a second);
// action: null | { kind: 'hop' | 'eat' | 'spin', t0 } (an animation that started at frame t0).

export const GW = 40;
export const GH = 32;

const C = {
  outline: '#1d3b2c',
  body: '#7fd6a4',
  shade: '#5bb585',
  belly: '#d8f5e2',
  gill: '#ff9fb8',
  gillDark: '#e0708f',
  eye: '#13221a',
  shine: '#ffffff',
  blush: '#ffb3c6',
  leaf: '#4caf50',
  leafDark: '#2e7d32',
  flower: '#ffd54f',
  egg: '#f3ead2',
  eggShade: '#d9cba4',
  eggSpot: '#8fcf9f',
  heart: '#ff5c7a',
  berry: '#b04a8f',
  zzz: '#cfd8ff',
  sparkle: '#fff59d',
  ground: 'rgba(0,0,0,0.18)',
};

function px(g, x, y, color) {
  if (x < 0 || y < 0 || x >= GW || y >= GH) return;
  g.fillStyle = color;
  g.fillRect(x, y, 1, 1);
}

function disc(g, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) px(g, x, y, color);
    }
  }
}

const SIZE = { baby: 6, young: 7.5, grown: 9, elder: 9 };

function shadow(g, cx, w) {
  for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) px(g, x, 29, C.ground);
}

function drawEgg(g, t, mood) {
  const wobble = mood === 'sleeping' ? 0 : Math.round(Math.sin(t / 3) * (t % 40 < 10 ? 1 : 0));
  const cx = 20 + wobble;
  shadow(g, 20, 6);
  disc(g, cx, 20, 7.5, 9.5, C.outline);
  disc(g, cx, 20, 6.5, 8.5, C.egg);
  disc(g, cx + 2, 22, 4, 6, C.eggShade);
  disc(g, cx - 1, 19, 4.5, 6.5, C.egg);
  for (const [x, y] of [[-3, 15], [2, 17], [-2, 23], [3, 25], [0, 20]]) px(g, cx + x, y, C.eggSpot), px(g, cx + x + 1, y, C.eggSpot);
}

function drawCreature(g, { stage, mood, t, action }) {
  const r = SIZE[stage] || 7;
  const at = action ? t - action.t0 : -1;
  let lift = 0;
  if (mood === 'happy' && t % 24 < 6) lift = [0, 1, 2, 2, 1, 0][t % 24];
  if (mood === 'content' || mood === 'bored') lift = 0;
  if (action?.kind === 'hop' && at >= 0 && at < 8) lift = [1, 3, 5, 6, 5, 3, 1, 0][at];
  const bob = mood === 'sleeping' ? Math.round(Math.sin(t / 6)) * 0 : Math.round(Math.sin(t / 4) * 0.6);
  const squash = mood === 'bored' ? 1 : 0;
  const cx = 20;
  const cy = 29 - r - lift + bob + squash;
  const flip = action?.kind === 'spin' && at >= 0 && at < 8 && at % 4 >= 2;

  shadow(g, cx, r - 1 - Math.min(lift, 3));
  // gills: three frills each side
  const gillLen = Math.max(2, Math.round(r / 3));
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const gy = cy - r / 2 + i * 2 - 1;
      const sway = mood === 'sleeping' ? 0 : Math.round(Math.sin(t / 3 + i) * 0.6);
      for (let k = 0; k <= gillLen; k++) px(g, Math.round(cx + side * (r - 1 + k)), Math.round(gy - k * 0.5 + sway), k === gillLen ? C.gillDark : C.gill);
    }
  }
  // body
  disc(g, cx, cy, r + 1, r * 0.9 + 1, C.outline);
  disc(g, cx, cy, r, r * 0.9, C.body);
  disc(g, cx + r * 0.35, cy + r * 0.3, r * 0.6, r * 0.5, C.shade);
  disc(g, cx, cy + r * 0.35, r * 0.6, r * 0.45, C.belly);
  // feet
  for (const fx of [-r / 2, r / 2]) px(g, Math.round(cx + fx), Math.round(cy + r * 0.9), C.outline), px(g, Math.round(cx + fx) + 1, Math.round(cy + r * 0.9), C.outline);

  // face
  const ex = Math.max(2, Math.round(r * 0.45));
  const ey = Math.round(cy - r * 0.15);
  const blink = t % 46 === 0 || t % 46 === 1;
  for (const side of flip ? [1] : [-1, 1]) {
    const x = cx + side * ex - (side < 0 ? 1 : 0);
    if (mood === 'sleeping' || blink) {
      px(g, x - 1, ey + 1, C.eye), px(g, x, ey + 1, C.eye), px(g, x + 1, ey + 1, C.eye);
    } else if (mood === 'bored') {
      px(g, x, ey, C.eye), px(g, x + 1, ey, C.eye), px(g, x, ey + 1, C.eye), px(g, x + 1, ey + 1, C.eye);
      px(g, x - 1, ey - 1, C.outline), px(g, x, ey - 1, C.outline), px(g, x + 1, ey - 1, C.outline), px(g, x + 2, ey - 1, C.outline);
    } else {
      px(g, x, ey - 1, C.eye), px(g, x + 1, ey - 1, C.eye), px(g, x, ey, C.eye), px(g, x + 1, ey, C.eye), px(g, x, ey + 1, C.eye), px(g, x + 1, ey + 1, C.eye);
      px(g, x, ey - 1, C.shine);
    }
    if (mood === 'happy' || mood === 'content') px(g, x + side * 2, ey + 2, C.blush), px(g, x + side * 2 + 1, ey + 2, C.blush);
  }
  // mouth
  const my = ey + 3;
  const eating = action?.kind === 'eat' && at >= 0 && at < 12;
  if (eating && at % 4 < 2) {
    px(g, cx - 1, my, C.outline), px(g, cx, my, C.outline), px(g, cx - 1, my + 1, C.gillDark), px(g, cx, my + 1, C.gillDark);
  } else if (mood === 'bored' && t % 60 < 8) {
    px(g, cx - 1, my, C.outline), px(g, cx, my, C.outline), px(g, cx - 1, my + 1, C.outline), px(g, cx, my + 1, C.outline);
  } else if (mood === 'sleeping') {
    px(g, cx, my, C.outline);
  } else {
    px(g, cx - 2, my, C.outline), px(g, cx - 1, my + 1, C.outline), px(g, cx, my + 1, C.outline), px(g, cx + 1, my, C.outline);
  }

  // sprout, by stage
  const top = Math.round(cy - r * 0.9 - 1);
  if (stage !== 'baby') {
    px(g, cx, top - 1, C.leafDark), px(g, cx, top - 2, C.leafDark);
    const leaf = stage === 'young' ? 2 : 3;
    for (let i = 1; i <= leaf; i++) px(g, cx + i, top - 2 - Math.floor(i / 2), C.leaf), px(g, cx - i, top - 2 - Math.floor(i / 2), C.leaf);
    if (stage === 'elder') px(g, cx, top - 3, C.flower), px(g, cx + 1, top - 4, C.flower), px(g, cx - 1, top - 4, C.flower), px(g, cx, top - 5, C.flower);
  }

  // extras: food going in, hearts, sleep, sparkles
  if (eating) {
    const fy = Math.min(my, 6 + at * 2);
    if (at < 6) px(g, cx, fy, C.berry), px(g, cx + 1, fy, C.berry), px(g, cx, fy + 1, C.berry), px(g, cx + 1, fy + 1, C.berry);
  }
  if (action?.kind === 'hop' && at >= 0 && at < 16) heart(g, cx + r + 2, cy - r - Math.floor(at / 3));
  if (mood === 'sleeping') {
    const z = t % 24;
    zed(g, cx + r + 1 + Math.floor(z / 8), cy - r - Math.floor(z / 4));
  }
  if (mood === 'happy' && t % 32 < 4) px(g, cx - r - 2, cy - r, C.sparkle), px(g, cx + r + 3, cy - r + 3, C.sparkle);
}

function heart(g, x, y) {
  for (const [dx, dy] of [[0, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [1, 3]]) px(g, x + dx - 1, y + dy, C.heart);
}

function zed(g, x, y) {
  for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]]) px(g, x + dx, y + dy, C.zzz);
}

export function draw(g, { stage = 'baby', mood = 'content', t = 0, action = null } = {}) {
  g.clearRect(0, 0, GW, GH);
  if (stage === 'egg') drawEgg(g, t, mood);
  else drawCreature(g, { stage, mood, t, action });
}
