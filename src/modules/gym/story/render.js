// Draws a story stage on a canvas and animates its weather: rain, drizzle, snow, fog, lightning,
// fireflies, flickering lamps and Tad's blink. Outdoors the weather covers the scene; indoors only the
// window. One animation loop for whatever is on screen; still with reduced motion.
import { H, Layer, W, dither, seeded } from './pixel.js';
import { glow } from './places.js';
import { OUTLINE } from './characters.js';
import { SEASON_1 } from './season1.js';

/** The background (place and lamp light) and the cast (outlined) of a stage, as layers. */
export function stageLayers(index, env, { blink = false, flicker = 1 } = {}) {
  const stage = SEASON_1[index];
  const bg = new Layer();
  const info = stage.place(bg, env);
  // no gaps: a pixel a place left empty takes the colour above it
  for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) if (!bg.get(x, y) && bg.get(x, y - 1)) bg.set(x, y, bg.get(x, y - 1));
  for (let x = 0; x < W; x++) if (!bg.get(x, 0)) bg.set(x, 0, '#141127');
  for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) if (!bg.get(x, y)) bg.set(x, y, bg.get(x, y - 1));
  for (const [x, y, r] of info.lights) glow(bg, x, y, r, env, info.fireLight ? '#ff9a3a' : '#ffb347', flicker);
  const fg = new Layer();
  stage.cast(fg, env, { blink });
  fg.outline(OUTLINE);
  return { bg, fg, info };
}

/** Pixel fog: soft dithered bands across the lower half, one canvas wide, tiled as it drifts. */
function fogCanvas(env) {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = env.light === 'day' ? 'rgba(232,238,244,0.55)' : 'rgba(160,160,190,0.4)';
  for (let y = 30; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const band = 0.5 + 0.5 * Math.sin(y / 9 + Math.sin(x / 23) * 1.5);
      const density = band * 0.38 * Math.min(1, (y - 30) / 40);
      if (dither(x, y) < density) ctx.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}

const live = new Map(); // canvas → frame(t)
let rafId = null;

function loop(t) {
  for (const [cv, frame] of live) {
    if (cv.isConnected) frame(t);
    else live.delete(cv);
  }
  rafId = live.size ? requestAnimationFrame(loop) : null;
}

function prefersStill() {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function canDraw() {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return false;
  return !/jsdom/i.test(navigator.userAgent || ''); // jsdom has no canvas drawing (tests)
}

/**
 * A <canvas> showing stage `index` in the weather `env`, animated while it is on screen. The picture is
 * 160 × 120 pixels; CSS scales it up without smoothing.
 */
export function stageCanvas(index, env, { label = '' } = {}) {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  cv.className = 'gym-story';
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', label);
  cv.dataset.stage = String(index + 1);
  cv.dataset.weather = `${env.light} ${env.sky} ${env.precip}${env.fog ? ' fog' : ''}${env.thunder ? ' thunder' : ''}`;
  if (!canDraw()) return cv;
  const ctx = cv.getContext('2d');
  if (!ctx) return cv;
  ctx.imageSmoothingEnabled = false;

  const a = stageLayers(index, env, { flicker: 0.85 });
  const b = stageLayers(index, env, { flicker: 1, blink: true });
  const bgs = [a.bg.canvas(), b.bg.canvas()];
  const fgs = [a.fg.canvas(), b.fg.canvas()];
  const info = a.info;
  const clip = info.outdoor ? [0, 0, W, H] : info.window ? [info.window[0], info.window[1], info.window[2] - info.window[0] + 1, info.window[3] - info.window[1] + 1] : null;

  const rnd = seeded(index + 3);
  const count = env.precip === 'rain' ? 70 : env.precip === 'drizzle' ? 28 : env.precip === 'snow' ? 50 : 0;
  const drops = Array.from({ length: count }, () => ({ x: rnd() * (W + 40), y: rnd() * H, v: env.precip === 'snow' ? 0.35 + rnd() * 0.3 : env.precip === 'drizzle' ? 1 + rnd() * 0.6 : 1.6 + rnd() * 1.2, p: rnd() * 6 }));
  const flies = info.flies ? Array.from({ length: 7 }, (_, i) => ({ x: 10 + rnd() * 140, y: 58 + ((i * 7) % 26), p: rnd() * 6 })) : [];
  let last = 0;
  const fog = env.fog ? fogCanvas(env) : null;

  const frame = (t) => {
    const dt = Math.min(3, last ? (t - last) / 16.7 : 1);
    last = t;
    const flick = info.lights.length && Math.sin(t / 130) + Math.sin(t / 370) > 0.6 ? 1 : 0;
    ctx.drawImage(bgs[flick], 0, 0);
    flies.forEach((f, i) => {
      const x = Math.round(f.x + Math.sin(t / 900 + f.p) * 5);
      const y = Math.round(f.y + Math.cos(t / 700 + f.p * 2) * 3);
      if (Math.sin(t / 400 + i * 2) > -0.2) {
        ctx.fillStyle = '#d8ff6a';
        ctx.fillRect(x, y, 1, 1);
        ctx.fillStyle = 'rgba(216,255,106,0.25)';
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillRect(x, y - 1, 1, 3);
      }
    });
    const blink = t % 4200 < 140;
    ctx.drawImage(fgs[blink ? 1 : 0], 0, 0);
    if (!clip) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(...clip);
    ctx.clip();
    if (fog) {
      const dx = Math.round((t / 120) % W);
      ctx.drawImage(fog, dx - W, 0);
      ctx.drawImage(fog, dx, 0);
    }
    for (const d of drops) {
      d.y += d.v * dt;
      d.x -= (env.precip === 'snow' ? Math.sin(t / 900 + d.p) * 0.3 : d.v / 3) * dt;
      if (d.y > H) {
        d.y = -4;
        d.x = rnd() * (W + 40);
      }
      const x = Math.round(d.x);
      const y = Math.round(d.y);
      if (env.precip === 'snow') {
        ctx.fillStyle = 'rgba(244,246,250,0.9)';
        ctx.fillRect(x, y, 1, 1);
      } else {
        ctx.fillStyle = env.precip === 'drizzle' ? 'rgba(170,195,230,0.35)' : 'rgba(160,190,230,0.45)';
        ctx.fillRect(x, y, 1, 1);
        ctx.fillRect(x - 1, y + 2, 1, 1);
        if (env.precip === 'rain') ctx.fillRect(x - 1, y + 3, 1, 1);
      }
    }
    if (env.thunder && t % 7000 < 120) {
      ctx.fillStyle = 'rgba(240,244,255,0.55)';
      ctx.fillRect(...clip);
    }
    ctx.restore();
  };

  frame(0);
  if (!prefersStill() && typeof requestAnimationFrame === 'function') {
    live.set(cv, frame);
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }
  return cv;
}
