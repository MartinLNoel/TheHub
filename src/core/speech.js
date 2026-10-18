// Text to speech through the browser's own speechSynthesis (no service, no network of ours).
//
// A voice for a language is used ONLY when the phone really has one: findVoice() looks for a voice whose
// `lang` is that language (e.g. "bg-BG", "bg_BG" or "bg"); speakButton() stays hidden until such a voice
// shows up. Without one, nothing is offered: a 🔊 that reads Bulgarian with an English voice would teach
// the wrong sounds. Chrome loads its voice list late, so the list is read again on "voiceschanged".
// PLACEHOLDER(Q-22): whether Martin's phone has a bg-BG voice is unknown (Settings → Diagnostics shows it).
import { h } from './dom.js';

/** The language part of a code, lower case: "bg-BG" → "bg". */
const base = (lang) => String(lang || '').toLowerCase().split(/[-_]/)[0];

/** The best voice for `lang` ("bg-BG"): an exact match first, then any voice of that language; else null. */
export function findVoice(lang, synth = globalThis.speechSynthesis) {
  if (!synth || typeof synth.getVoices !== 'function') return null;
  let voices;
  try {
    voices = synth.getVoices() || [];
  } catch {
    return null;
  }
  const want = String(lang).toLowerCase().replace('_', '-');
  const norm = (v) => String(v.lang || '').toLowerCase().replace('_', '-');
  return voices.find((v) => norm(v) === want) || voices.find((v) => base(v.lang) === base(lang)) || null;
}

/**
 * Resolves to the voice for `lang` once the browser has listed its voices, or null after `waitMs`
 * (or at once when there is no speechSynthesis). Never rejects.
 */
export function whenVoice(lang, synth = globalThis.speechSynthesis, waitMs = 2000) {
  const now = findVoice(lang, synth);
  if (now || !synth || typeof synth.addEventListener !== 'function') return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      synth.removeEventListener('voiceschanged', check);
      resolve(findVoice(lang, synth));
    };
    const check = () => {
      if (findVoice(lang, synth)) done();
    };
    const timer = setTimeout(done, waitMs);
    synth.addEventListener('voiceschanged', check);
  });
}

/** Says `text` with `voice`. Returns false when it could not start. */
export function speak(text, voice, synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance) {
  if (!synth || !voice || typeof Utterance !== 'function') return false;
  try {
    synth.cancel();
    const u = new Utterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.85; // a little slower than normal, for a learner
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

/**
 * A 🔊 button that says `text` in `lang`. It is in the DOM from the start but hidden, and shown only when
 * a voice for `lang` exists (checked now and again when the voice list arrives).
 * options: { synth, Utterance, label, waitMs }
 */
export function speakButton(text, lang, { synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, label, waitMs } = {}) {
  let voice = null;
  const btn = h(
    'button',
    {
      type: 'button',
      class: 'btn speak',
      hidden: true,
      'data-testid': 'speak',
      'aria-label': label || `Listen: ${text}`,
      onclick: () => speak(text, voice, synth, Utterance),
    },
    '🔊',
  );
  whenVoice(lang, synth, waitMs).then((v) => {
    voice = v;
    btn.hidden = !v;
  });
  return btn;
}

/** Settings → Diagnostics: whether a voice for `lang` exists, after the voice list has loaded. */
export async function voiceLine(lang, synth = globalThis.speechSynthesis, waitMs) {
  if (!synth || typeof synth.getVoices !== 'function') return `Speech voice ${lang}: speech is not available in this browser (no 🔊 buttons).`;
  const v = await whenVoice(lang, synth, waitMs);
  return v
    ? `Speech voice ${lang}: available (${v.name || 'unnamed'}, ${v.lang}${v.localService === false ? ', online' : ''}).`
    : `Speech voice ${lang}: not available (the 🔊 buttons stay hidden).`;
}
