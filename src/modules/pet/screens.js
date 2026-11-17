// The pet on the home screen (homeWidget) and on its own page (#/pet, opened from the widget's name).
// Tapping it makes it hop and say something; new activities in the other apps are eaten, one by one, when the
// home screen opens. Logic: data.js; drawing: art.js.
import { h, mount } from '../../core/dom.js';
import { NO_HUB } from '../../core/hub.js';
import { GH, GW, draw } from './art.js';
import { KINDS, KIND_LABEL, STAGES, eat, moodFor, newMeals, nextStage, rename, stageFor, tapped } from './data.js';

export const SOURCES = ['gym', 'istqb', 'bulgarian', 'fridge'];
const FPS = 8;

const SAY = {
  waiting: ['…', '*wobble*', '(something moves inside)'],
  happy: ['Hi!', 'Best day!', '*happy wiggle*', 'You did great today!', 'Again! Again!'],
  content: ['Hello!', '*blink*', 'Nice to see you.', 'What are we doing today?'],
  bored: ['*yawn*', 'Oh, you’re back!', 'I missed you.', 'Let’s do something?'],
  sleeping: ['Zzz…', '*snore*', '…five more minutes…'],
};

/** Every app's recent activities, through the hub (each answers 'activities'). */
export function collectActivities(hub, sources = SOURCES) {
  return sources.flatMap((id) => {
    const list = hub.ask(id, 'activities');
    return Array.isArray(list) ? list : [];
  });
}

/** A canvas that animates the pet while it is on screen. Returns { el, act(kind), set(view) }. */
function stageCanvas(view, scale) {
  const canvas = h('canvas', { width: GW, height: GH, class: 'pet-canvas', style: `width:${GW * scale}px;height:${GH * scale}px`, 'data-testid': 'pet-canvas', 'data-stage': view.stage, 'data-mood': view.mood });
  const g = canvas.getContext?.('2d');
  let t = 0;
  let action = null;
  const frame = () => {
    if (g) draw(g, { ...view, t, action });
    t += 1;
    if (action && t - action.t0 > 16) action = null;
  };
  frame();
  const timer = setInterval(() => {
    if (!canvas.isConnected && t > 2) clearInterval(timer);
    else frame();
  }, 1000 / FPS);
  return {
    el: canvas,
    act: (kind) => (action = { kind, t0: t }),
    set: (next) => {
      Object.assign(view, next);
      canvas.dataset.stage = view.stage;
      canvas.dataset.mood = view.mood;
    },
  };
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * The home screen widget. ctx: { data, readOnly, hub, save } (the core's homeWidget context). Eats new meals
 * (saving first, then showing it), and reacts to taps.
 */
export function homeWidget(ctx, { now = () => new Date(), random = Math.random } = {}) {
  let data = ctx.data;
  if (!data) return null;
  const hub = ctx.hub || NO_HUB;
  const view = { stage: stageFor(data.meals).id, mood: moodFor(data, now()) };
  const pet = stageCanvas(view, 3);
  const say = h('p', { class: 'pet__say', role: 'status', 'aria-live': 'polite', 'data-testid': 'pet-say' }, data.meals ? pick(SAY[view.mood]) : 'Something is in this egg. Train, study or log food to hatch it.');
  const name = h('a', { class: 'pet__name', href: '#/pet', 'data-testid': 'pet-name' }, data.name);
  const status = h('p', { class: 'pet__status muted', 'data-testid': 'pet-status' }, statusText(data, view.mood));

  const save = async (next) => {
    if (ctx.readOnly) return false;
    try {
      await ctx.save(next);
      data = next;
      return true;
    } catch {
      return false;
    }
  };

  pet.el.addEventListener('click', async () => {
    pet.act(random() < 0.1 ? 'spin' : 'hop');
    say.textContent = pick(SAY[view.mood]);
    await save(tapped(data));
  });
  pet.el.setAttribute('role', 'button');
  pet.el.setAttribute('aria-label', `Tap ${data.name}`);
  pet.el.tabIndex = 0;

  // Meals: save first, then show them one by one.
  const meals = ctx.readOnly ? [] : newMeals(data, collectActivities(hub), now());
  const ready = (async () => {
    if (!meals.length) return;
    const wasEgg = data.meals === 0;
    if (!(await save(eat(data, meals, now())))) return;
    view.stage = stageFor(data.meals).id;
    view.mood = moodFor(data, now());
    pet.set(view);
    status.textContent = statusText(data, view.mood);
    meals.forEach((m, i) =>
      setTimeout(() => {
        if (!say.isConnected) return;
        pet.act('eat');
        say.textContent = wasEgg && i === 0 ? `It hatched! Yum: ${KIND_LABEL[m.kind]}.` : `Yum: ${KIND_LABEL[m.kind]}!`;
      }, i * 1600),
    );
  })();

  const node = h(
    'section',
    { class: 'card pet', 'data-module': 'pet', 'data-testid': 'pet-widget' },
    pet.el,
    h('div', { class: 'pet__side' }, name, say, status),
  );
  node.ready = ready; // tests wait for the meals
  return node;
}

function statusText(data, mood) {
  const stage = stageFor(data.meals);
  const mood2 = { waiting: 'waiting to hatch', happy: 'happy', content: 'content', bored: 'a bit bored', sleeping: 'asleep' }[mood];
  return `${stage.name} · ${mood2} · ${data.meals} meal${data.meals === 1 ? '' : 's'}`;
}

/** The pet's page: a big view, its name, what it has eaten, and how it grows. */
export function renderPet(ctx) {
  const { root, readOnly } = ctx;
  let data = ctx.data;
  const now = new Date();
  const view = { stage: stageFor(data.meals).id, mood: moodFor(data, now) };
  const pet = stageCanvas(view, 7);
  pet.el.addEventListener('click', () => pet.act(Math.random() < 0.15 ? 'spin' : 'hop'));
  const next = nextStage(data.meals);
  const nameIn = h('input', { type: 'text', maxlength: '24', value: data.name, 'aria-label': 'Name', 'data-testid': 'pet-rename' });
  const msg = h('p', { class: 'status', role: 'status' });
  mount(
    root,
    h(
      'div',
      { class: 'stack pet-page', 'data-testid': 'pet-page' },
      h('section', { class: 'card study-hero pet-hero' }, pet.el, h('h2', { 'data-testid': 'pet-title' }, data.name), h('p', { class: 'muted' }, statusText(data, view.mood))),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, 'Meals'),
        h('ul', { class: 'pet-meals' }, KINDS.map((k) => h('li', {}, h('span', {}, KIND_LABEL[k][0].toUpperCase() + KIND_LABEL[k].slice(1)), h('strong', {}, String(data.byKind[k]))))),
        h('p', { class: 'muted' }, next ? `Grows into "${next.name}" at ${next.from} meals (${next.from - data.meals} to go).` : 'Fully grown, and in bloom.'),
        h('p', { class: 'muted' }, `With you since ${data.born}. Tapped ${data.taps} time${data.taps === 1 ? '' : 's'}.`),
      ),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, 'How it eats'),
        h('p', {}, 'Every workout, study session, day of Bulgarian practice and day you log food is one meal. It eats them when you open the home screen.'),
        h('p', { class: 'muted' }, 'It never gets sick or sad. If you are away, it naps or gets a little bored, and the next meal makes it happy again.'),
        h('p', { class: 'muted' }, `Stages: ${STAGES.map((s) => `${s.name} (${s.from})`).join(' → ')}.`),
      ),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, 'Rename'),
        h('div', { class: 'row pet-rename' }, h('label', { class: 'field' }, 'Name', nameIn), h('button', {
          type: 'button',
          class: 'btn btn--primary',
          disabled: readOnly,
          'data-testid': 'pet-rename-save',
          onclick: async () => {
            const nextData = rename(data, nameIn.value);
            try {
              await ctx.save(nextData);
            } catch (err) {
              msg.textContent = `Not saved: ${err.message}`;
              return;
            }
            data = nextData;
            renderPet({ ...ctx, data });
          },
        }, 'Save')),
        msg,
      ),
    ),
  );
}

