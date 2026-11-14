// Real-life weather in the Fighter's story (Martin, 2026-11-14): the outdoor scenes follow the weather in
// the town he sets in Settings. Open-Meteo (open-meteo.com) is free and needs no account or key; only the
// town's coordinates are sent, never a GPS position. The last reading is kept on the phone (localStorage)
// for offline use; with no town, each scene keeps the weather its story chose.
//
// A scene's weather ("env"): { light: 'day'|'dusk'|'night', sky: 'clear'|'cloudy'|'overcast',
//   precip: 'none'|'drizzle'|'rain'|'snow', fog: boolean, thunder: boolean }

export const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const CACHE_KEY = 'thehub.gym.weather';
export const MAX_AGE_MS = 30 * 60 * 1000; // fetch again after 30 minutes

/** What a WMO weather code (Open-Meteo's weather_code) looks like in a scene. */
export function conditionsFor(code) {
  const c = Number(code);
  const base = { sky: 'clear', precip: 'none', fog: false, thunder: false };
  if (c === 0) return base;
  if (c === 1 || c === 2) return { ...base, sky: 'cloudy' };
  if (c === 3) return { ...base, sky: 'overcast' };
  if (c === 45 || c === 48) return { ...base, sky: 'overcast', fog: true };
  if (c >= 51 && c <= 57) return { ...base, sky: 'overcast', precip: 'drizzle' };
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return { ...base, sky: 'overcast', precip: 'rain' };
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { ...base, sky: 'overcast', precip: 'snow' };
  if (c >= 95 && c <= 99) return { ...base, sky: 'overcast', precip: 'rain', thunder: true };
  return { ...base, sky: 'cloudy' };
}

/** A short description for the Fighter screen, e.g. "light rain". */
export function describe(code) {
  const c = Number(code);
  if (c === 0) return 'clear sky';
  if (c === 1 || c === 2) return 'partly cloudy';
  if (c === 3) return 'overcast';
  if (c === 45 || c === 48) return 'fog';
  if (c >= 51 && c <= 57) return 'drizzle';
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
  if (c >= 95 && c <= 99) return 'thunderstorm';
  return 'mixed weather';
}

/** Day, dusk or night from the local hour (dusk: 6–7 h and 17–20 h). */
export function lightAt(date = new Date()) {
  const h = date.getHours();
  if (h >= 8 && h < 17) return 'day';
  if ((h >= 6 && h < 8) || (h >= 17 && h < 20)) return 'dusk';
  return 'night';
}

/**
 * The weather a scene shows: the real reading when there is one (with day/night from the reading and
 * dusk from the local hour), otherwise the scene's own.
 */
export function sceneEnv(sceneDefault, reading, now = new Date()) {
  if (!reading || reading.code === undefined || reading.code === null) return { ...sceneDefault };
  const byHour = lightAt(now);
  const light = reading.isDay === 0 ? (byHour === 'dusk' ? 'dusk' : 'night') : byHour === 'night' ? 'dusk' : byHour;
  return { light, ...conditionsFor(reading.code) };
}

function readCache() {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(value) {
  try {
    globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // private mode or full storage: the scene falls back to its own weather
  }
}

/** The cached reading for this town, or null. */
export function cachedReading(town) {
  const c = readCache();
  return c && town && c.lat === town.lat && c.lon === town.lon ? c : null;
}

/**
 * The current reading for a town: the cache when it is fresh, otherwise Open-Meteo, otherwise the stale
 * cache. Never throws; returns null when there is nothing at all. { code, isDay, temp, at, lat, lon }
 */
export async function currentReading(town, { fetchFn = globalThis.fetch, now = Date.now() } = {}) {
  if (!town) return null;
  const cached = cachedReading(town);
  if (cached && now - cached.at < MAX_AGE_MS) return cached;
  try {
    const url = `${FORECAST_URL}?latitude=${town.lat}&longitude=${town.lon}&current=weather_code,is_day,temperature_2m&timezone=auto`;
    const res = await fetchFn(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const cur = json.current;
    if (!cur || typeof cur.weather_code !== 'number') throw new Error('no current weather');
    const reading = { code: cur.weather_code, isDay: cur.is_day, temp: cur.temperature_2m, at: now, lat: town.lat, lon: town.lon };
    writeCache(reading);
    return reading;
  } catch {
    return cached;
  }
}

/** Towns matching a name, for the Settings card: [{ name, country, admin, lat, lon }]. Throws on failure. */
export async function findTowns(name, { fetchFn = globalThis.fetch } = {}) {
  const q = String(name || '').trim();
  if (q.length < 2) return [];
  const res = await fetchFn(`${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=5&language=en&format=json`);
  if (!res.ok) throw new Error(`the town search failed (HTTP ${res.status})`);
  const json = await res.json();
  return (json.results || []).map((r) => ({
    name: String(r.name),
    country: String(r.country || r.country_code || ''),
    admin: String(r.admin1 || ''),
    lat: Math.round(r.latitude * 100) / 100, // about 1 km: enough for the weather, no more precise than needed
    lon: Math.round(r.longitude * 100) / 100,
  }));
}
