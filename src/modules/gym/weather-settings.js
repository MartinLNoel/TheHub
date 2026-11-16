// Settings → "Weather": the town whose real weather shows on the home screen and in the Fighter's story (Gym schema 4,
// weatherTown). Found by name with Open-Meteo's free town search; only the chosen town is stored.
import { h, mount } from '../../core/dom.js';
import { findTowns } from './story/weather.js';

const label = (t) => [t.name, t.admin && t.admin !== t.name ? t.admin : null, t.country].filter(Boolean).join(', ');

/** The Settings card. api: { data, readOnly, save(next) } from the core (src/core/settings.js). */
export function weatherSettingsCard(api, { fetchFn } = {}) {
  let data = api.data;
  const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite', 'data-testid': 'weather-status' });
  const results = h('div', { class: 'stack', 'data-testid': 'weather-results' });
  const current = h('p', { 'data-testid': 'weather-town' });
  const input = h('input', { type: 'text', id: 'weather-town-input', placeholder: 'Town name', autocomplete: 'off', 'aria-label': 'Town', 'data-testid': 'weather-town-input' });

  const showCurrent = () => {
    mount(current, data.weatherTown ? ['Town: ', h('strong', {}, label(data.weatherTown))] : 'No town set: no weather on the home screen, and the story uses its own.');
    removeBtn.hidden = !data.weatherTown;
  };

  const choose = async (town) => {
    const next = { ...structuredClone(data), weatherTown: { name: town.name, country: town.country, admin: town.admin, lat: town.lat, lon: town.lon } };
    try {
      await api.save(next);
    } catch (err) {
      status.className = 'status status--bad';
      status.textContent = `Not saved: ${err.message}`;
      return;
    }
    data = next;
    mount(results);
    input.value = '';
    status.className = 'status status--good';
    status.textContent = `Saved. The home screen and the story now follow the weather in ${town.name}.`;
    showCurrent();
  };

  const search = async () => {
    status.className = 'status';
    status.textContent = 'Searching…';
    mount(results);
    let towns;
    try {
      towns = await findTowns(input.value, fetchFn ? { fetchFn } : undefined);
    } catch (err) {
      status.className = 'status status--bad';
      status.textContent = `The search did not work (${err.message}). Are you online?`;
      return;
    }
    if (!towns.length) {
      status.textContent = 'No town found with that name.';
      return;
    }
    status.textContent = 'Pick your town:';
    mount(results, towns.map((t) => h('button', { type: 'button', class: 'btn', disabled: api.readOnly, onclick: () => choose(t) }, label(t))));
  };

  const removeBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn',
      'data-testid': 'weather-remove',
      disabled: api.readOnly,
      onclick: async () => {
        const next = { ...structuredClone(data), weatherTown: null };
        try {
          await api.save(next);
        } catch (err) {
          status.className = 'status status--bad';
          status.textContent = `Not saved: ${err.message}`;
          return;
        }
        data = next;
        status.className = 'status';
        status.textContent = 'Town removed.';
        showCurrent();
      },
    },
    'Remove town',
  );
  showCurrent();

  return h(
    'section',
    { class: 'card', 'data-testid': 'weather-card' },
    h('h2', {}, '🌤️ Weather'),
    h('p', { class: 'muted' }, 'Your town’s weather shows on the home screen, and the outdoor scenes of the Fighter’s story follow it. Only the town’s position is sent to Open-Meteo, a free weather service, never your GPS.'),
    current,
    h(
      'form',
      {
        class: 'row',
        onsubmit: (e) => {
          e.preventDefault();
          search();
        },
      },
      input,
      h('button', { type: 'submit', class: 'btn btn--primary', disabled: api.readOnly, 'data-testid': 'weather-search' }, 'Search'),
    ),
    status,
    results,
    removeBtn,
  );
}
