// The people of the story (frogs) and the creatures they hunt (herons, newts, a snapping turtle).
// One frog drawer for everyone: skin, size (s), muscle (m), arm pose and gear are options. Coordinates
// are offsets from the point between the feet (x, y = the ground), as in the stage 1 sample.

export const OUTLINE = '#0c0e14';

export const SKINS = {
  tad: { base: '#5fae4a', shade: '#3b7631', hi: '#95d46c', belly: '#e8e0ae', bellyShade: '#c4b97f' },
  toad: { base: '#8a7a4a', shade: '#5e5232', hi: '#ab9a62', belly: '#d8c99a', bellyShade: '#b3a274' },
  grubb: { base: '#9a8a52', shade: '#6a5c36', hi: '#bcab70', belly: '#e2d6a6', bellyShade: '#bfae7a' },
  vira: { base: '#d0562e', shade: '#8f3420', hi: '#ef8a52', belly: '#f2d9a0', bellyShade: '#cfb276' },
  pip: { base: '#3c7fd6', shade: '#24529a', hi: '#6aa8ef', belly: '#2a2f45', bellyShade: '#1c2033' },
  brannoc: { base: '#3f5a36', shade: '#283b22', hi: '#5c7c4c', belly: '#c8c08a', bellyShade: '#a29a66' },
  smith: { base: '#6f8a4a', shade: '#4a5e30', hi: '#90ad64', belly: '#dcd3a0', bellyShade: '#b8ae7a' },
  folk1: { base: '#7aa25a', shade: '#52713b', hi: '#9cc479', belly: '#e6dfb2', bellyShade: '#c2b986' },
  folk2: { base: '#b59a3e', shade: '#7c6828', hi: '#d4b85a', belly: '#efe2b4', bellyShade: '#cbbb86' },
  folk3: { base: '#4f9a8a', shade: '#346a5f', hi: '#72bcab', belly: '#dfe6c0', bellyShade: '#b9c296' },
  bandit: { base: '#6b6f3a', shade: '#474a24', hi: '#8a8f50', belly: '#cfc79a', bellyShade: '#aaa274' },
};

const C = {
  white: '#f4f4ee', pupil: '#121212', mouth: '#22401e', teeth: '#f4f0dc', mouthIn: '#5a1f1f',
  wrap: '#dcd4c2', wrapShade: '#a39b8a', leather: '#8a5a32', leatherShade: '#5e3c20',
  iron: '#9aa3ad', ironShade: '#5d646d', ironHi: '#d6dde4', gold: '#e2b23c', goldShade: '#a87d1e', goldHi: '#fff0a8',
  belt: '#4a3020', buckle: '#e2b23c', pouch: '#6d4a2e', boot: '#4a3022', bootHi: '#6a4630',
  stitch: '#2f1f14', scar: '#c9e6b0', bruise: '#5a4a8a',
};

const ARMS = {
  // [elbow, fist] for the right arm (x mirrored for the left); y up is negative
  down: [[15, -23], [15, -13]],
  guard: [[15, -26], [7, -37]],
  punch: [[22, -33], [31, -34]],
  raise: [[16, -42], [15, -53]],
  carry: [[14, -27], [6, -26]],
  akimbo: [[20, -25], [12, -17]],
  spread: [[22, -38], [30, -46]],
  slam: [[18, -20], [22, -4]],
  hold: [[15, -24], [15, -17]],
  point: [[20, -34], [29, -38]],
};

function fistColors(gear) {
  if (gear === 'iron') return [C.iron, C.ironShade, C.ironHi];
  if (gear === 'gold') return [C.gold, C.goldShade, C.goldHi];
  if (gear === 'leather') return [C.leather, C.leatherShade, null];
  if (gear === 'cloth') return [C.wrap, C.wrapShade, null];
  return null;
}

/**
 * Draws a frog standing on (x, y). o: { skin, s (size, 1), m (muscle 0–4), arms ('down' or
 * [right, left] poses), fists ('cloth'|'leather'|'iron'|'gold'|null, or [right, left]), cloak {c, shade},
 * hood, belt, pouch, boots, eyes ('open'|'closed'|'angry'|'sad'|'wide'), mouth ('line'|'grin'|'frown'|'open'),
 * headband, scar, bruise, badge, mask, glasses, crown, apron, shawl, pads, sit, flip (look left) }
 */
export function frog(L, x, y, o = {}) {
  const k = SKINS[o.skin || 'tad'];
  const s = o.s || 1;
  const m = o.m || 0;
  const P = (dx, dy) => [x + dx * s, y + dy * s];
  const [armR, armL] = Array.isArray(o.arms) ? o.arms : [o.arms || 'down', o.arms || 'down'];
  const [fistR, fistL] = Array.isArray(o.fists) ? o.fists : [o.fists ?? null, o.fists ?? null];
  const shoulder = 10 + m * 0.7;
  const armR0 = (2.6 + m * 0.35) * s;
  const torsoRx = (11 + m * 0.6) * s;

  // cloak behind
  if (o.cloak) {
    const cl = o.cloak;
    L.poly([P(-13 - m * 0.5, -37), P(13 + m * 0.5, -37), P(19 + m * 0.5, -8), P(-19 - m * 0.5, -8)], cl.c);
    L.poly([P(4, -37), P(13 + m * 0.5, -37), P(19 + m * 0.5, -8), P(6, -8)], cl.shade);
    if (cl.patch) {
      L.rect(...P(-17, -21), ...P(-13, -17), cl.patch);
      L.set(...P(-17, -21), C.stitch).set(...P(-13, -17), C.stitch);
    }
    if (cl.trim) L.line(...P(-19 - m * 0.5, -8), ...P(19 + m * 0.5, -8), cl.trim);
  }
  if (o.hood) L.body(...P(0, -50), 17 * s, 10 * s, o.hood.c, o.hood.shade, null);

  // legs
  if (o.sit) {
    L.capsule(...P(-6, -12), ...P(-14, -4), 3 * s, k.base).capsule(...P(6, -12), ...P(14, -4), 3 * s, k.shade);
    L.body(...P(-17, -2), 4.5 * s, 2 * s, k.base, k.shade, null).body(...P(17, -2), 4.5 * s, 2 * s, k.shade, k.shade, null);
  } else {
    L.capsule(...P(-6, -15), ...P(-12, -7), 3 * s, k.base).capsule(...P(-12, -7), ...P(-8, -1), 2.4 * s, k.base);
    L.capsule(...P(6, -15), ...P(12, -7), 3 * s, k.shade).capsule(...P(12, -7), ...P(8, -1), 2.4 * s, k.shade);
    const foot = o.boots ? C.boot : k.base;
    L.body(...P(-10, 0), 4.5 * s, 1.6 * s, foot, o.boots ? C.boot : k.shade, o.boots ? C.bootHi : null);
    L.body(...P(10, 0), 4.5 * s, 1.6 * s, o.boots ? C.boot : k.shade, o.boots ? C.boot : k.shade, null);
    if (o.boots) L.rect(...P(-12, -4), ...P(-8, -2), C.boot).rect(...P(8, -4), ...P(12, -2), C.boot);
    else [-14, -10, -6, 6, 10, 14].forEach((dx) => L.set(...P(dx, 1), k.shade));
  }

  // body and belly
  const by = o.sit ? -20 : -24;
  L.body(...P(0, by), torsoRx, 12 * s, k.base, k.shade, k.hi);
  L.body(...P(0, by + 2), (7 + m * 0.3) * s, 9 * s, k.belly, k.bellyShade, null);
  if (m >= 2) {
    // chest and the line between the pecs
    L.line(...P(-5, by - 6), ...P(-1, by - 5), k.bellyShade).line(...P(1, by - 5), ...P(5, by - 6), k.bellyShade);
    if (m >= 3) for (let i = 0; i < 3; i++) L.line(...P(-2, by + 1 + i * 3), ...P(2, by + 1 + i * 3), k.bellyShade);
  }
  if (o.skin === 'pip') [[-4, -26], [3, -22], [-2, -18], [5, -28]].forEach(([dx, dy]) => L.disc(...P(dx, dy), 1.2 * s, '#151a2a'));
  if (o.skin === 'toad' || o.skin === 'grubb') [[-6, -28], [7, -30], [8, -20], [-8, -18]].forEach(([dx, dy]) => L.disc(...P(dx, dy), 1 * s, k.hi));
  if (o.apron) L.rect(...P(-7, by - 4), ...P(7, by + 10), o.apron).line(...P(-7, by - 4), ...P(7, by - 4), '#2a1c12');
  if (o.belt !== false && (o.belt || o.pouch)) {
    L.rect(...P(-10 - m * 0.4, -16), ...P(10 + m * 0.4, -15), C.belt).rect(...P(-1, -16), ...P(0, -15), C.buckle);
    if (o.pouch) L.rect(...P(4, -14), ...P(8, -10), C.pouch).rect(...P(4, -14), ...P(8, -13), '#5a3c24');
  }
  if (o.badge) L.disc(...P(-5, -31), 1.8 * s, o.badge).set(...P(-5.5, -31.5), '#ffffff');

  // shoulders: cloak band, shawl or pads
  if (o.cloak) {
    L.rect(...P(-12 - m * 0.5, -37), ...P(12 + m * 0.5, -35), o.cloak.c);
    L.rect(...P(-1, -36), ...P(0, -35), o.cloak.clasp || C.gold);
  }
  if (o.shawl) L.poly([P(-13, -37), P(13, -37), P(9, -27), P(-9, -27)], o.shawl);
  if (o.pads) {
    L.body(...P(-shoulder - 1, -35), 4.5 * s, 3 * s, C.iron, C.ironShade, C.ironHi);
    L.body(...P(shoulder + 1, -35), 4.5 * s, 3 * s, C.iron, C.ironShade, C.ironHi);
  }

  // arms
  const arm = (side, pose, gear) => {
    const [[ex, ey], [fx, fy]] = ARMS[pose] || ARMS.down;
    const sx = side * shoulder;
    const skin = side > 0 ? k.shade : k.base;
    const wrapped = fistColors(gear);
    L.capsule(...P(sx, -33), ...P(side * ex, ey), armR0, skin);
    L.capsule(...P(side * ex, ey), ...P(side * fx, fy + 3), armR0, wrapped && gear !== 'iron' && gear !== 'gold' ? wrapped[0] : skin);
    const fr = (3.2 + m * 0.25) * s;
    if (wrapped) {
      L.body(...P(side * fx, fy), fr, fr, wrapped[0], wrapped[1], wrapped[2]);
      if (gear === 'cloth' || gear === 'leather') {
        L.set(...P(side * fx - 1, fy - 1), wrapped[1]).set(...P(side * fx + 1, fy + 1), wrapped[1]);
      } else {
        for (let i = -1; i <= 1; i++) L.set(...P(side * fx + i * 1.4, fy - fr / s + 1), wrapped[2] || '#ffffff');
      }
    } else {
      L.body(...P(side * fx, fy), fr * 0.85, fr * 0.85, skin, k.shade, null);
    }
  };

  // head
  const hy = o.sit ? -39 : -43;
  L.body(...P(0, hy), 14 * s, 9.5 * s, k.base, k.shade, k.hi);
  L.body(...P(0, hy + 5), 9 * s, 3 * s, k.belly, k.bellyShade, null);
  L.set(...P(-2, hy - 2), C.mouth).set(...P(2, hy - 2), C.mouth);
  const mouthY = hy + 4;
  if (o.mouth === 'grin') {
    L.line(...P(-10, mouthY), ...P(10, mouthY), C.mouth).line(...P(-6, mouthY + 1), ...P(6, mouthY + 1), C.teeth);
    L.set(...P(-11, mouthY - 1), C.mouth).set(...P(11, mouthY - 1), C.mouth);
  } else if (o.mouth === 'frown') {
    L.line(...P(-9, mouthY), ...P(9, mouthY), C.mouth).set(...P(-10, mouthY + 1), C.mouth).set(...P(10, mouthY + 1), C.mouth);
  } else if (o.mouth === 'open') {
    L.body(...P(0, mouthY + 1), 5 * s, 2.2 * s, C.mouthIn, C.mouthIn, null);
    L.line(...P(-9, mouthY), ...P(9, mouthY), C.mouth);
  } else {
    L.line(...P(-10, mouthY), ...P(10, mouthY), C.mouth).set(...P(-11, mouthY - 1), C.mouth).set(...P(11, mouthY - 1), C.mouth);
  }
  if (o.scar) L.line(...P(7, hy - 4), ...P(11, hy + 1), C.scar);
  if (o.bruise) L.disc(...P(-8, hy + 1), 1.6 * s, C.bruise);

  // eyes on top
  [-9, 9].forEach((dx, i) => {
    const ex = dx;
    const ey = hy - 8;
    L.body(...P(ex, ey), 5.5 * s, 5 * s, i ? k.shade : k.base, k.shade, i ? null : k.hi);
    if (o.eyes === 'closed') {
      L.line(...P(ex - 3, ey), ...P(ex + 3, ey), C.mouth);
      return;
    }
    L.disc(...P(ex, ey - 0.5), 3.4 * s, C.white);
    const look = o.flip ? -1 : 0;
    if (o.eyes === 'wide') L.rect(...P(ex - 0.5 + look, ey - 1), ...P(ex + 0.5 + look, ey), C.pupil);
    else L.rect(...P(ex - 1 + look, ey - 1), ...P(ex + 1 + look, ey), C.pupil);
    L.set(...P(ex - 1 + look, ey - 1), C.white);
    if (o.eyes === 'angry') L.line(...P(ex - 4 * (i ? -1 : 1), ey - 5), ...P(ex + 3 * (i ? -1 : 1), ey - 3), C.mouth);
    if (o.eyes === 'sad') L.line(...P(ex - 4 * (i ? -1 : 1), ey - 3), ...P(ex + 3 * (i ? -1 : 1), ey - 5), C.mouth);
  });
  if (o.glasses) {
    [-9, 9].forEach((dx) => {
      for (let a = 0; a < 16; a++) L.set(...P(dx + Math.cos((a / 16) * Math.PI * 2) * 4.2, hy - 8.5 + Math.sin((a / 16) * Math.PI * 2) * 4.2), '#c9b26a');
    });
  }
  if (o.mask) L.rect(...P(-14, hy - 10), ...P(14, hy - 7), o.mask);
  if (o.headband) {
    L.rect(...P(-13, hy - 3), ...P(13, hy - 2), o.headband);
    L.line(...P(-13, hy - 2), ...P(-18, hy + 3), o.headband).line(...P(-14, hy - 2), ...P(-19, hy + 1), o.headband);
  }
  if (o.crown) L.rect(...P(-5, hy - 17), ...P(5, hy - 15), C.gold).set(...P(-5, hy - 18), C.gold).set(...P(0, hy - 19), C.gold).set(...P(5, hy - 18), C.gold);

  arm(-1, armL, fistL);
  arm(1, armR, fistR);
}

/** Tad as he is at a stage of Season 1: his gear and muscle grow with the story. */
export function tadLook(stage) {
  const cloak =
    stage >= 20 ? { c: '#2f5a8a', shade: '#1f3c5e', trim: '#e2b23c', clasp: '#e2b23c' }
      : stage >= 12 ? { c: '#566b4e', shade: '#394834', trim: '#c9ced6', clasp: '#c9ced6' }
        : { c: '#7a5236', shade: '#4f3422', patch: '#9c7149' };
  return {
    skin: 'tad',
    m: stage >= 18 ? 4 : stage >= 12 ? 3 : stage >= 7 ? 2 : stage >= 4 ? 1 : 0,
    fists: stage >= 18 ? ['gold', 'iron'] : stage >= 7 ? 'iron' : stage >= 4 ? 'leather' : 'cloth',
    cloak,
    belt: true,
    pouch: true,
    boots: stage >= 8,
    badge: stage >= 20 ? '#e2b23c' : stage >= 12 ? '#c9ced6' : null,
    headband: stage >= 14 ? '#a8322d' : null,
    scar: stage >= 10,
    pads: stage >= 18,
  };
}

/** A heron: the hunters' enemy. o: { s, armor, crown, spear, flip (face right), wings ('folded'|'open') } */
export function heron(L, x, y, o = {}) {
  const s = o.s || 1;
  const f = o.flip ? 1 : -1; // -1 looks left
  const Q = (dx, dy) => [x + dx * s * f, y + dy * s];
  const grey = '#9aa4b0';
  const greyShade = '#6a7480';
  const greyHi = '#c4ccd6';
  const dark = '#3a4250';
  // legs
  L.line(...Q(-3, -26), ...Q(-4, 0), '#c9a24a').line(...Q(3, -26), ...Q(5, 0), '#a8862e');
  L.line(...Q(-7, 0), ...Q(-1, 0), '#c9a24a').line(...Q(2, 0), ...Q(8, 0), '#a8862e');
  // body
  L.body(...Q(0, -34), 10 * s, 9 * s, grey, greyShade, greyHi);
  if (o.wings === 'open') {
    L.poly([Q(-4, -40), Q(-30, -56), Q(-24, -40), Q(-30, -34), Q(-6, -30)], greyShade);
    L.poly([Q(4, -40), Q(30, -56), Q(24, -40), Q(30, -34), Q(6, -30)], greyShade);
  } else {
    L.poly([Q(-2, -40), Q(10, -36), Q(8, -26), Q(-6, -28)], greyShade);
  }
  if (o.armor) L.body(...Q(0, -35), 8 * s, 6 * s, o.armor, '#4a3a2a', null);
  // neck (an S) and head
  L.capsule(...Q(4, -42), ...Q(8, -50), 2.2 * s, grey).capsule(...Q(8, -50), ...Q(5, -58), 2.2 * s, grey).capsule(...Q(5, -58), ...Q(9, -63), 2.4 * s, grey);
  L.body(...Q(9, -64), 4 * s, 3.4 * s, grey, greyShade, greyHi);
  L.line(...Q(12, -64), ...Q(24, -62), '#e0b23a').line(...Q(12, -63), ...Q(22, -62), '#c9962a');
  L.line(...Q(5, -66), ...Q(-4, -70), dark).line(...Q(5, -65), ...Q(-2, -67), dark);
  L.set(...Q(10, -65), '#d02a2a');
  if (o.crown) L.rect(...Q(6, -70), ...Q(12, -68), '#e2b23c').set(...Q(6, -71), '#e2b23c').set(...Q(9, -72), '#e2b23c').set(...Q(12, -71), '#e2b23c');
  if (o.spear) {
    L.line(...Q(16, -6), ...Q(16, -70), '#6e4b33');
    L.poly([Q(14, -70), Q(18, -70), Q(16, -77)], '#c9ced6');
    L.capsule(...Q(4, -36), ...Q(14, -40), 1.6 * s, greyShade);
  }
}

/** A newt: a small thief. */
export function newt(L, x, y, o = {}) {
  const f = o.flip ? -1 : 1;
  const Q = (dx, dy) => [x + dx * f, y + dy];
  L.capsule(...Q(-10, -3), ...Q(-18, -1), 1.4, '#c4542a');
  L.body(...Q(0, -5), 9, 4, '#e0763a', '#a4482a', '#f4a060');
  L.body(...Q(9, -7), 4, 3.2, '#e0763a', '#a4482a', '#f4a060');
  L.set(...Q(10, -8), '#121212').set(...Q(10, -9), '#ffffff');
  [-5, 4].forEach((dx) => L.line(...Q(dx, -2), ...Q(dx + 2, 0), '#a4482a'));
  if (o.sack) L.body(...Q(-4, -12), 5, 5, '#b89a62', '#8a7044', null).line(...Q(-4, -17), ...Q(-3, -19), '#6a5030');
}

/** The snapping turtle who takes tolls at the bridge. */
export function turtle(L, x, y, o = {}) {
  const s = o.s || 1;
  const Q = (dx, dy) => [x + dx * s, y + dy * s];
  L.body(...Q(0, -16), 22 * s, 16 * s, '#5a6a32', '#3a4620', '#7a8c44');
  for (const [dx, dy] of [[-10, -22], [0, -26], [10, -22], [-6, -12], [6, -12]]) L.body(...Q(dx, dy), 4.5 * s, 3.5 * s, '#6e7e3e', '#4a5626', null);
  L.rect(...Q(-22, -4), ...Q(22, -1), '#8a8a5a');
  L.body(...Q(-25, -14), 7 * s, 5.5 * s, '#7a7a4a', '#55552e', '#9a9a62');
  L.poly([Q(-31, -15), Q(-27, -10), Q(-33, -11)], '#d8d0b0');
  L.set(...Q(-27, -17), '#d02a2a').set(...Q(-26, -17), '#121212');
  [-14, 12].forEach((dx) => L.body(...Q(dx, -1), 5 * s, 3 * s, '#7a7a4a', '#55552e', null));
}
