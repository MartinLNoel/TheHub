// A tiny pixel-art engine for the Fighter's story scenes: a 160 × 120 grid of colours ("layers"),
// drawn with shapes, lit from the upper left, dithered with a 4 × 4 Bayer matrix and outlined, then
// copied to a canvas and scaled up without smoothing. Ported from the stage 1 sample Martin approved
// (docs/fighter/stage-1-sample.html).

export const W = 160;
export const H = 120;

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
/** The ordered-dither threshold of a pixel, between 0 and 1. */
export const dither = (x, y) => (BAYER[y & 3][x & 3] + 0.5) / 16;

export const hexRGB = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** Mixes two "#rrggbb" colours: t = 0 gives a, 1 gives b. */
export const mix = (a, b, t) => {
  const A = hexRGB(a);
  const B = hexRGB(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
};

export class Layer {
  constructor() {
    this.px = new Array(W * H).fill(null);
  }

  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (c && x >= 0 && y >= 0 && x < W && y < H) this.px[y * W + x] = c;
    return this;
  }

  get(x, y) {
    return x >= 0 && y >= 0 && x < W && y < H ? this.px[y * W + x] : null;
  }

  rect(x1, y1, x2, y2, c) {
    for (let y = Math.round(y1); y <= Math.round(y2); y++) for (let x = Math.round(x1); x <= Math.round(x2); x++) this.set(x, y, c);
    return this;
  }

  disc(cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, c);
    }
    return this;
  }

  /** A thick line: discs of radius r along it. */
  capsule(x1, y1, x2, y2, r, c) {
    const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2) + 1;
    for (let i = 0; i <= n; i++) this.disc(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n, r, c);
    return this;
  }

  line(x1, y1, x2, y2, c) {
    const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
    for (let i = 0; i <= n; i++) this.set(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n, c);
    return this;
  }

  /** An ellipse lit from the upper left: highlight there, shade on the right and bottom (dithered). */
  body(cx, cy, rx, ry, base, shade, hi) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        const light = -nx * 0.7 - ny * 0.5;
        let c = base;
        if (light < -0.35 || (light < -0.15 && dither(x, y) < 0.5)) c = shade;
        else if (hi && light > 0.45 && d < 0.75) c = hi;
        this.set(x, y, c);
      }
    }
    return this;
  }

  /** A filled polygon ([[x, y], …]). */
  poly(pts, c) {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.round(Math.min(...ys)); y <= Math.round(Math.max(...ys)); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % pts.length];
        if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i + 1]); x++) this.set(x, y, c);
    }
    return this;
  }

  /** Recolours the pixels already drawn in a rectangle, by fn(colour, x, y). */
  tint(x1, y1, x2, y2, fn) {
    for (let y = Math.max(0, y1); y <= Math.min(H - 1, y2); y++) {
      for (let x = Math.max(0, x1); x <= Math.min(W - 1, x2); x++) {
        const c = this.get(x, y);
        if (c) this.px[y * W + x] = fn(c, x, y);
      }
    }
    return this;
  }

  /** A 1-pixel outline around everything drawn so far. */
  outline(c) {
    const add = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
      }
    }
    add.forEach(([x, y]) => this.set(x, y, c));
    return this;
  }

  /** Draws another layer on top of this one. */
  over(other) {
    other.px.forEach((c, i) => {
      if (c) this.px[i] = c;
    });
    return this;
  }

  /** The number of pixels drawn (tests). */
  count() {
    return this.px.filter(Boolean).length;
  }

  /** A canvas with this layer, or null where there is no canvas (tests). */
  canvas() {
    if (typeof document === 'undefined') return null;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    let ctx = null;
    try {
      ctx = cv.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return null;
    const img = ctx.createImageData(W, H);
    this.px.forEach((c, i) => {
      if (!c) return;
      const [r, g, b] = hexRGB(c);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    });
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

/** A seeded random number generator, so a scene draws the same every time. */
export function seeded(seed = 7) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
