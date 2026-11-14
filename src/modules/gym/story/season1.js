// SPOILERS. The Fighter, Season 1: "The Heron's Bounty". Martin's brief (2026-11-14): a fantasy world of
// frog bounty hunters, where bounties are how a frog earns a living and hunters belong to classes with their
// own gear and abilities; the hero, Tad, is a beginner Bogbrawler (fists). Stage 1 introduces him, stage 2
// gives him his quest, the rest is the adventure; the order should surprise Martin, so the app shows a stage
// only once it is unlocked. Upgrades are gear as well as muscle (characters.js, tadLook).
import { boardwalkTown, bridge, burning, camp, cage, ferry, forge, guildHall, market, mountains, reedMaze, riverbank, roost, saltMarsh, stormPath, yard } from './places.js';
import { frog, heron, newt, tadLook, turtle } from './characters.js';

const NIGHT_RAIN = { light: 'night', sky: 'cloudy', precip: 'rain', fog: false, thunder: false };
const NIGHT_CLEAR = { light: 'night', sky: 'clear', precip: 'none', fog: false, thunder: false };
const NIGHT_STORM = { light: 'night', sky: 'overcast', precip: 'rain', fog: false, thunder: true };
const DUSK_CLEAR = { light: 'dusk', sky: 'clear', precip: 'none', fog: false, thunder: false };
const DAY_CLEAR = { light: 'day', sky: 'clear', precip: 'none', fog: false, thunder: false };
const DAY_CLOUDY = { light: 'day', sky: 'cloudy', precip: 'none', fog: false, thunder: false };

const VIRA = { skin: 'vira', s: 0.95, hood: { c: '#6a2a24', shade: '#4a1c18' }, cloak: { c: '#7a3028', shade: '#55201a' }, belt: true };
const PIP = { skin: 'pip', s: 0.62, belt: true, pouch: true };
const BRANNOC = { skin: 'brannoc', s: 1.22, m: 3, belt: true, pads: true, eyes: 'angry' };
const GRUBB = { skin: 'grubb', s: 1.15, glasses: true, apron: '#4a3a6a', badge: '#e2b23c' };
const MOSSBACK = { skin: 'toad', s: 1.12, shawl: '#5a4a6a', mouth: 'frown' };
const BANDIT = { skin: 'bandit', s: 0.9, mask: '#22201e', belt: true };
const FOLK = (n) => ({ skin: `folk${n}`, s: 0.78, mouth: 'grin', arms: 'raise' });

const tad = (stage, extra = {}) => ({ ...tadLook(stage), ...extra });

// small props drawn with the characters
const posterRoll = (L, x, y) => L.rect(x + 12, y - 22, x + 17, y - 7, '#e6d3a3').line(x + 17, y - 22, x + 17, y - 7, '#bfa774').rect(x + 12, y - 19, x + 17, y - 18, '#a8322d');
const tongue = (L, x1, y1, x2, y2) => {
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    L.disc(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t - Math.sin(t * Math.PI) * 8, 1, '#e86a8a');
  }
};
const shield = (L, x, y, r) => {
  L.body(x, y, r, r, '#6a7a3a', '#46522a', '#8a9a52');
  for (const [dx, dy] of [[0, 0], [-r / 2, -r / 2], [r / 2, -r / 2], [-r / 2, r / 2], [r / 2, r / 2]]) L.body(x + dx, y + dy, r / 3.2, r / 3.6, '#7a8a46', '#55602e', null);
  L.disc(x, y, 1.5, '#e2b23c');
};
const staff = (L, x, y) => L.line(x, y - 60, x, y, '#6e4b33').disc(x, y - 61, 2, '#95d46c');
const blowpipe = (L, x, y) => L.line(x - 4, y, x - 22, y - 1, '#b89a62').set(x - 22, y - 1, '#121212');
const coins = (L, pts) => pts.forEach(([x, y]) => L.disc(x, y, 1.3, '#e2b23c').set(x - 0.5, y - 0.5, '#fff0a8'));
const limpPip = (L, x, y) => {
  L.body(x, y, 9, 4, '#3c7fd6', '#24529a', '#6aa8ef').body(x + 11, y - 2, 5, 4, '#3c7fd6', '#24529a', null);
  L.line(x + 9, y - 4, x + 13, y - 4, '#22401e').disc(x - 2, y, 1, '#151a2a').disc(x + 4, y - 1, 1, '#151a2a');
};
const impact = (L, x, y) => {
  for (let a = 0; a < 20; a++) {
    const t = (a / 20) * Math.PI;
    L.set(x + Math.cos(t) * 16, y - Math.sin(t) * 5, '#fff6d6').set(x + Math.cos(t) * 22, y - Math.sin(t) * 8, '#e2d6b0');
  }
};
const bars = (L, xs, top, bottom) => xs.forEach((x) => L.rect(x, top, x + 2, bottom, '#5e4130').line(x, top, x, bottom, '#7a5438'));
const bentBar = (L, x, dir, top, bottom, fy) => {
  for (let y = top; y <= bottom; y++) {
    const bend = Math.max(0, 1 - Math.abs(y - fy) / 30) * 10 * dir;
    L.rect(x + bend, y, x + bend + 2, y, '#5e4130').set(x + bend, y, '#7a5438');
  }
};

/**
 * The 20 stages. sessions: total sessions to unlock; env: the weather the story chose (real weather
 * replaces it when Martin has set a town); place(L, env) draws the background; cast(L, env, { blink }) the
 * characters (outlined together).
 */
export const SEASON_1 = [
  {
    sessions: 0, icon: '🐸', name: 'FRESH SPAWN', title: 'Chapter 1 — Fresh Spawn', desc: 'Every legend starts on the boardwalk.',
    story: 'In Lilyhollow, a frog earns their flies one way: bounties. Tad signed the Guild book tonight. Of all the hunter classes, Lashers with whip-tongues, Dartcallers with poison blowpipes, Shellwardens behind cart-sized shields, he picked the one the others laugh at: the Bogbrawler, who fights with nothing but his fists. His first poster pays three flies.',
    env: NIGHT_RAIN,
    place: (L, env) => boardwalkTown(L, env),
    cast: (L, env, { blink }) => {
      posterRoll(L, 106, 95);
      frog(L, 106, 95, tad(1, { arms: ['hold', 'down'], eyes: blink ? 'closed' : 'open' }));
    },
  },
  {
    sessions: 3, icon: '📜', name: 'THE OLDEST POSTER', title: 'Chapter 2 — The Oldest Poster', desc: 'Some bounties wait for the right frog.',
    story: 'Guildmaster Grubb points past the easy jobs to a poster gone yellow with age: OLD GULLET, the Heron Baron, who rules the Roost upriver and takes a toll in frogs. Twenty years unclaimed. Pinned to its corner hangs an iron knuckle, the last Bogbrawler who tried. Tad knows that knuckle. It was his father’s. That is the bounty he will bring home.',
    env: DUSK_CLEAR,
    place: (L, env) => guildHall(L, env),
    cast: (L, env, { blink }) => {
      frog(L, 22, 106, { ...GRUBB, arms: ['point', 'down'] });
      frog(L, 128, 106, tad(2, { eyes: blink ? 'closed' : 'wide', mouth: 'frown', flip: true }));
    },
  },
  {
    sessions: 6, icon: '🪙', name: 'THREE FLIES', title: 'Chapter 3 — Three Flies', desc: 'A first bounty, a first catch.',
    story: 'The poster was for a newt who had been lifting purses in the market for a month. Tad chased him through three stalls and over a fish cart, and caught him with one honest punch to the sack. The newt cried, the market cheered, and the Guild paid exactly three flies. Tad has never been richer.',
    env: DAY_CLOUDY,
    place: (L, env) => market(L, env),
    cast: (L, env, { blink }) => {
      newt(L, 112, 108, { sack: true });
      coins(L, [[96, 86], [100, 80], [104, 88], [92, 92]]);
      frog(L, 62, 108, tad(3, { arms: ['punch', 'guard'], eyes: blink ? 'closed' : 'angry', mouth: 'grin' }));
    },
  },
  {
    sessions: 10, icon: '🪵', name: "MOSSBACK'S YARD", title: "Chapter 4 — Mossback's Yard", desc: 'Strength is built before dawn.',
    story: 'Three flies will not catch a Heron Baron. Old Mossback, a retired Bogbrawler with one good eye and no patience, agrees to train him for free, on one condition: Tad is in the yard before sunrise, every day he says he will be. The log bag does not care how tired you are. Tad trades his cloth wraps for leather.',
    env: DUSK_CLEAR,
    place: (L, env) => yard(L, env),
    cast: (L, env, { blink }) => {
      staff(L, 54, 108);
      frog(L, 36, 108, { ...MOSSBACK, arms: ['hold', 'akimbo'], eyes: 'angry' });
      frog(L, 92, 108, tad(4, { arms: ['punch', 'guard'], eyes: blink ? 'closed' : 'angry' }));
    },
  },
  {
    sessions: 14, icon: '👅', name: 'THE LASHER', title: 'Chapter 5 — The Lasher', desc: 'Someone is always faster.',
    story: 'Tad tracks a river smuggler for two days. Just as he closes in, a tongue as long as a rope snaps past his ear and drags the smuggler off the bank. Vira, a Lasher in a red hood, collects the bounty with a smile. "Fists are slow, little brawler." Tad decides he hates her. He also decides to get faster.',
    env: DAY_CLEAR,
    place: (L, env) => riverbank(L, env),
    cast: (L, env, { blink }) => {
      newt(L, 146, 104, { flip: true });
      tongue(L, 116, 72, 140, 98);
      frog(L, 108, 108, { ...VIRA, arms: ['akimbo', 'down'], mouth: 'grin', eyes: blink ? 'closed' : 'open' });
      frog(L, 40, 108, tad(5, { arms: 'akimbo', eyes: 'angry', mouth: 'frown' }));
    },
  },
  {
    sessions: 18, icon: '🌾', name: 'THE REED MAZE', title: 'Chapter 6 — The Reed Maze', desc: 'The dart that missed.',
    story: 'In the reed maze a dart misses Tad by a whisker. The shooter is Pip, a Dartcaller no bigger than a fist, who mistook him for the bandit they were both hunting. Pip talks faster than he shoots and he shoots very fast. By sunset they have caught the bandit together, and split the bounty. Tad has a friend.',
    env: { light: 'day', sky: 'overcast', precip: 'none', fog: true, thunder: false },
    place: (L, env) => reedMaze(L, env),
    cast: (L, env, { blink }) => {
      blowpipe(L, 120, 89);
      frog(L, 124, 110, { ...PIP, arms: ['carry', 'carry'], eyes: 'angry' });
      L.line(86, 70, 92, 70, '#b89a62').set(86, 70, '#3c7fd6');
      frog(L, 62, 110, tad(6, { arms: 'guard', eyes: blink ? 'closed' : 'wide' }));
    },
  },
  {
    sessions: 23, icon: '🔨', name: 'IRON KNUCKLES', title: 'Chapter 7 — Iron Knuckles', desc: 'New fists, same frog.',
    story: 'With every fly he has saved, Tad goes to the smith. She melts down scrap from the Guild yard and hammers him a pair of iron knuckles, heavy, ugly and perfect. Mossback says nothing, which from Mossback is praise. The log bag splits on the third day.',
    env: NIGHT_CLEAR,
    place: (L, env) => forge(L, env),
    cast: (L, env, { blink }) => {
      L.line(64, 76, 74, 66, '#6e4b33').rect(72, 62, 78, 66, '#7a8088');
      frog(L, 50, 112, { skin: 'smith', s: 1.08, apron: '#5e3c20', arms: ['raise', 'down'], m: 2, eyes: 'open' });
      frog(L, 112, 112, tad(7, { arms: ['raise', 'guard'], eyes: blink ? 'closed' : 'open', mouth: 'grin' }));
      [[100, 52], [118, 48], [126, 58], [96, 44]].forEach(([x, y]) => L.set(x, y, '#ffd36b'));
    },
  },
  {
    sessions: 28, icon: '🐢', name: 'THE SNAPPING TOLL', title: 'Chapter 8 — The Snapping Toll', desc: 'Some doors you knock down.',
    story: 'The only bridge upriver belongs to a snapping turtle who charges a toll in fingers. The Guild has a poster on him too. Pip shoots, the darts bounce off. Tad walks up and hits him square on the beak, twice, and the turtle decides to retire. The bounty buys Tad his first pair of boots.',
    env: DAY_CLEAR,
    place: (L, env) => bridge(L, env),
    cast: (L, env, { blink }) => {
      turtle(L, 126, 95, { s: 1.15 });
      frog(L, 20, 95, { ...PIP, arms: ['raise', 'down'], mouth: 'grin' });
      frog(L, 62, 95, tad(8, { arms: ['punch', 'guard'], eyes: blink ? 'closed' : 'angry' }));
    },
  },
  {
    sessions: 34, icon: '⛈️', name: 'FEVER NIGHT', title: 'Chapter 9 — Fever Night', desc: 'Strong enough to carry someone.',
    story: 'A heron scout’s poisoned spear grazes Pip. By nightfall he is burning with fever, and the only healer is half a night’s walk away, through the storm. Tad carries him the whole way without putting him down once. The healer says another hour would have been too late.',
    env: NIGHT_STORM,
    place: (L, env) => stormPath(L, env),
    cast: (L, env, { blink }) => {
      frog(L, 70, 110, tad(9, { arms: 'carry', eyes: blink ? 'closed' : 'angry', mouth: 'frown' }));
      limpPip(L, 72, 82);
    },
  },
  {
    sessions: 40, icon: '🔥', name: "THE HERON'S SHADOW", title: "Chapter 10 — The Heron's Shadow", desc: 'The first real defeat.',
    story: 'Old Gullet’s herons come to Lilyhollow at night and set the far shore burning. Tad charges the first one he sees and is thrown into the water like a pebble. He would have drowned if a tongue had not wrapped round his leg and pulled him out. Vira. "You still punch like a tadpole," she says. Then she stays to help.',
    env: NIGHT_CLEAR,
    place: (L, env) => burning(L, env),
    cast: (L, env, { blink }) => {
      heron(L, 126, 96, { spear: true, armor: '#5a4632' });
      tongue(L, 92, 60, 120, 52);
      frog(L, 86, 96, { ...VIRA, arms: 'guard', eyes: 'angry' });
      frog(L, 40, 96, tad(10, { sit: true, arms: 'down', eyes: blink ? 'closed' : 'sad', bruise: true, mouth: 'frown' }));
    },
  },
  {
    sessions: 47, icon: '🛡️', name: 'THE SHELLWARDEN', title: 'Chapter 11 — The Shellwarden', desc: 'A wall that walks.',
    story: 'To reach the Roost they need someone who can stand in front of a heron’s spear. Brannoc the Shellwarden has refused every hunter for ten years. He listens to Tad’s story by the fire, says nothing for a very long time, then picks up his shield. The Roost took his brother. The four of them are a crew now.',
    env: DUSK_CLEAR,
    place: (L, env) => camp(L, env),
    cast: (L, env, { blink }) => {
      frog(L, 104, 108, { ...VIRA, s: 0.86, sit: true, arms: 'down' });
      frog(L, 140, 108, { ...BRANNOC, arms: ['hold', 'down'] });
      shield(L, 157, 84, 13);
      frog(L, 48, 108, { ...PIP, sit: true, mouth: 'grin' });
      frog(L, 26, 108, tad(11, { s: 0.95, arms: 'down', eyes: blink ? 'closed' : 'open', sit: true }));
    },
  },
  {
    sessions: 54, icon: '🥈', name: 'THE SILVER BADGE', title: 'Chapter 12 — The Silver Badge', desc: 'The Guild takes notice.',
    story: 'The Guild trial: three bounties in three days, no help allowed. Tad brings in all three before the second sunset. Grubb pins the silver badge on him himself, in front of the whole hall, and gives him a hunter’s cloak. The frogs who laughed at the Bogbrawler are clapping now. Grubb’s smile is a little too wide.',
    env: DAY_CLOUDY,
    place: (L, env) => guildHall(L, env),
    cast: (L, env, { blink }) => {
      frog(L, 12, 112, FOLK(1));
      frog(L, 150, 112, FOLK(2));
      frog(L, 46, 106, { ...GRUBB, arms: ['point', 'down'], mouth: 'grin' });
      frog(L, 104, 106, tad(12, { arms: ['raise', 'down'], eyes: blink ? 'closed' : 'open', mouth: 'grin' }));
    },
  },
  {
    sessions: 62, icon: '⛰️', name: 'MUDSLIDE PASS', title: 'Chapter 13 — Mudslide Pass', desc: 'The long road up.',
    story: 'The Roost lies past the highlands, and the only way through is Mudslide Pass. Four days of climbing. Pip complains about every step, Vira about Pip, Brannoc about nothing at all. Halfway up the mountain lets go of a slope and Tad holds a falling boulder long enough for the others to run.',
    env: { light: 'day', sky: 'cloudy', precip: 'none', fog: true, thunder: false },
    place: (L, env) => mountains(L, env),
    cast: (L, env, { blink }) => {
      frog(L, 22, 106, { ...PIP, arms: 'down' });
      frog(L, 48, 106, { ...VIRA, s: 0.86, arms: 'down', eyes: 'wide' });
      frog(L, 142, 106, { ...BRANNOC, s: 1.1, arms: 'down' });
      shield(L, 158, 84, 12);
      L.body(92, 38, 13, 10, '#6a6258', '#4a443c', '#8a8278');
      frog(L, 92, 106, tad(13, { arms: 'spread', eyes: blink ? 'closed' : 'angry', mouth: 'frown' }));
    },
  },
  {
    sessions: 71, icon: '💥', name: 'BOG SLAM', title: 'Chapter 14 — Bog Slam', desc: 'A Bogbrawler’s first real ability.',
    story: 'Salt-marsh bandits, a dozen of them, between the crew and the Roost. Tad jumps and drives both fists into the ground, and the marsh itself throws them off their feet. Mossback once told him about the Bog Slam. Tad never believed it was real. He ties on a red headband to remember the day.',
    env: DAY_CLEAR,
    place: (L, env) => saltMarsh(L, env),
    cast: (L, env, { blink }) => {
      frog(L, 28, 92, { ...BANDIT, arms: 'spread', eyes: 'wide', mouth: 'open' });
      frog(L, 134, 90, { ...BANDIT, arms: 'spread', eyes: 'wide', mouth: 'open' });
      impact(L, 80, 108);
      frog(L, 80, 108, tad(14, { arms: 'slam', eyes: blink ? 'closed' : 'angry', mouth: 'open' }));
    },
  },
  {
    sessions: 80, icon: '⛴️', name: 'BETRAYAL AT THE FERRY', title: 'Chapter 15 — Betrayal at the Ferry', desc: 'Not every enemy has feathers.',
    story: 'At the last ferry before the Roost, the herons are already waiting. Someone told them. Then Tad sees who stands on the ferry with a sack of gold: Grubb. The Guildmaster has been selling hunters to Old Gullet for twenty years. Tad’s father too. They are surrounded before Tad can reach him.',
    env: { light: 'night', sky: 'cloudy', precip: 'none', fog: true, thunder: false },
    place: (L, env) => ferry(L, env),
    cast: (L, env, { blink }) => {
      frog(L, 130, 82, { ...GRUBB, s: 1, arms: 'carry', mouth: 'grin' });
      L.body(130, 56, 6, 5, '#b89a62', '#8a7044', null);
      heron(L, 18, 101, { spear: true, armor: '#5a4632', flip: true });
      frog(L, 62, 101, tad(15, { arms: 'guard', eyes: blink ? 'closed' : 'angry', mouth: 'frown' }));
    },
  },
  {
    sessions: 90, icon: '⛓️', name: 'THE CAGE', title: 'Chapter 16 — The Cage', desc: 'Bars are only wood.',
    story: 'They wake in a cage of heron-wood bars inside the Roost. Brannoc tries his shoulder against the door and fails. Tad wraps his hands around two bars and pulls. It takes all night. At dawn the bars give, and the crew walks out into the Roost, which is not expecting them.',
    env: NIGHT_CLEAR,
    place: (L, env) => cage(L, env),
    cast: (L, env, { blink }) => {
      frog(L, 26, 108, { ...BRANNOC, s: 1.05, arms: 'down', eyes: 'wide' });
      frog(L, 136, 108, { ...PIP, arms: 'raise', mouth: 'grin' });
      frog(L, 80, 108, tad(16, { arms: 'spread', eyes: blink ? 'closed' : 'angry', mouth: 'open' }));
      bars(L, [4, 20, 140, 154], 0, 108);
      bentBar(L, 50, -1, 0, 108, 62);
      bentBar(L, 108, 1, 0, 108, 62);
    },
  },
  {
    sessions: 101, icon: '🕯️', name: "VIRA'S SECRET", title: "Chapter 17 — Vira's Secret", desc: 'Everyone hunts something.',
    story: 'Hiding in the Roost’s roots, Vira finally shows Tad the locket she never takes off. Her little sister, taken by the herons three summers ago. She did not join the crew for flies. "I would have told you sooner," she says, "but you punch like a tadpole." He has not punched like a tadpole for a long time, and they both know it.',
    env: NIGHT_CLEAR,
    place: (L, env) => camp(L, env),
    cast: (L, env, { blink }) => {
      frog(L, 112, 108, { ...VIRA, sit: true, arms: 'carry', eyes: 'sad' });
      L.disc(112, 82, 2, '#e2b23c');
      frog(L, 44, 108, tad(17, { sit: true, arms: 'down', eyes: blink ? 'closed' : 'open' }));
    },
  },
  {
    sessions: 113, icon: '🌳', name: 'THE ROOST', title: 'Chapter 18 — The Roost', desc: 'The climb to the top.',
    story: 'The Roost is a dead tree as tall as a mountain, every branch a nest. Brannoc holds the roots, Vira swings from branch to branch, Pip covers the climb, and Tad goes straight up the trunk with his father’s knuckle, recovered from Grubb’s sack, on his right fist. Gold, the herons’ own metal, polished for the occasion.',
    env: NIGHT_STORM,
    place: (L, env) => roost(L, env),
    cast: (L, env, { blink }) => {
      heron(L, 22, 14, { s: 0.55 });
      heron(L, 140, 30, { s: 0.55, flip: true });
      frog(L, 128, 108, { ...BRANNOC, s: 1, arms: 'hold' });
      shield(L, 116, 90, 10);
      tongue(L, 40, 80, 24, 56);
      frog(L, 40, 108, { ...VIRA, s: 0.8, arms: 'raise' });
      frog(L, 80, 78, tad(18, { s: 0.85, arms: 'raise', eyes: blink ? 'closed' : 'angry' }));
    },
  },
  {
    sessions: 126, icon: '👑', name: 'OLD GULLET', title: 'Chapter 19 — Old Gullet', desc: 'Twenty years unclaimed.',
    story: 'At the top of the Roost, in the lightning, the Heron Baron is waiting. He is three times Tad’s height and has eaten better hunters for breakfast. He laughs at the little brawler right up to the moment the gold knuckle meets his beak. Then the Roost is very quiet, and somewhere below, Vira finds her sister.',
    env: NIGHT_STORM,
    place: (L, env) => roost(L, env, { top: true }),
    cast: (L, env, { blink }) => {
      heron(L, 124, 100, { s: 1.45, crown: true, armor: '#6a5030' });
      frog(L, 52, 100, tad(19, { arms: ['punch', 'guard'], eyes: blink ? 'closed' : 'angry', mouth: 'open' }));
      [[86, 64], [88, 70], [90, 60]].forEach(([x, y]) => L.set(x, y, '#fff0a8'));
    },
  },
  {
    sessions: 140, icon: '🏆', name: 'GOLD HUNTER', title: 'Chapter 20 — Gold Hunter', desc: 'The poster nobody laughs at.',
    story: 'Lilyhollow hangs out every flag it owns. Tad gets a gold badge, a blue cloak and a new poster on the Guild board: his own face, under the word HERO. Grubb’s poster hangs next to it. But that night a stranger pins up one more poster, wet with seawater, showing a crown under the waves. Season 2 starts here.',
    env: DAY_CLEAR,
    place: (L, env) => boardwalkTown(L, env, { banners: true, faces: ['frog', 'crown', 'toad', 'snake', 'lizard'] }),
    cast: (L, env, { blink }) => {
      frog(L, 76, 96, FOLK(3));
      frog(L, 150, 96, FOLK(1));
      frog(L, 94, 96, { ...PIP, arms: 'raise', mouth: 'grin' });
      frog(L, 122, 96, tad(20, { arms: ['raise', 'down'], eyes: blink ? 'closed' : 'open', mouth: 'grin' }));
    },
  },
];
