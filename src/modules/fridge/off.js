// Open Food Facts lookups (https://world.openfoodfacts.org, data under the ODbL; the app shows the attribution).
//
// Read-only, no key, one product per request: GET /api/v2/product/<code>?fields=...
// OFF asks every app to identify itself. A browser cannot set the User-Agent header, so the app name and
// version go in the query (app_name, app_version), and no personal data is ever sent.
// PLACEHOLDER(Q-20): confirm OFF accepts this from a web app (and its rate limits) once the phone has tried it.
//
// lookupProduct never throws. It resolves to one of:
//   { status: 'found', product: { name, brand, nameEn, nameBg } }
//   { status: 'not-found' }
//   { status: 'error', message }        (offline, timeout, rate limit, server trouble: try again later)

export const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product/';
export const OFF_FIELDS = ['code', 'product_name', 'product_name_en', 'product_name_nl', 'product_name_bg', 'generic_name', 'brands', 'nutriments'];
export const APP_NAME = 'TheHub';
export const LOOKUP_TIMEOUT_MS = 8000;

/** The request URL for one barcode. */
export function productUrl(code, appVersion = '0') {
  const params = new URLSearchParams({ fields: OFF_FIELDS.join(','), app_name: APP_NAME, app_version: appVersion });
  return `${OFF_PRODUCT_URL}${encodeURIComponent(code)}?${params}`;
}

const text = (v) => (typeof v === 'string' ? v.trim() : '');

const per100g = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
};

/**
 * Nutrition per 100 g from OFF's `nutriments` (0.9.8, for the food log), or null when it has neither kcal nor
 * protein. kcal falls back to kJ / 4.184.
 */
export function mapNutrition(nutriments) {
  const n = nutriments && typeof nutriments === 'object' ? nutriments : {};
  let kcal = per100g(n['energy-kcal_100g']);
  if (kcal === null && per100g(n.energy_100g) !== null && (n.energy_unit === undefined || n.energy_unit === 'kJ')) kcal = Math.round(per100g(n.energy_100g) / 4.184);
  const out = { protein: per100g(n.proteins_100g), kcal, carbs: per100g(n.carbohydrates_100g), fat: per100g(n.fat_100g) };
  return out.kcal === null && out.protein === null ? null : out;
}

/** Maps an OFF product object to the Fridge's product (text, and nutrition per 100 g when known; no images). */
export function mapProduct(product) {
  const p = product && typeof product === 'object' ? product : {};
  const name = text(p.product_name) || text(p.product_name_en) || text(p.product_name_nl) || text(p.generic_name);
  const brand = text(p.brands).split(',')[0].trim();
  const per100 = mapNutrition(p.nutriments);
  return { name, brand, nameEn: text(p.product_name_en), nameBg: text(p.product_name_bg), ...(per100 ? { per100 } : {}) };
}

/** Maps an HTTP status and parsed JSON body to a lookup result (exported for tests). */
export function mapResponse(httpStatus, body) {
  if (httpStatus === 404) return { status: 'not-found' };
  if (httpStatus < 200 || httpStatus >= 300) return { status: 'error', message: `Open Food Facts answered ${httpStatus}` };
  if (!body || typeof body !== 'object') return { status: 'error', message: 'Open Food Facts sent an unreadable answer' };
  if (body.status === 1 && body.product && typeof body.product === 'object') {
    const product = mapProduct(body.product);
    return product.name || product.brand ? { status: 'found', product } : { status: 'not-found' };
  }
  if (body.status === 0) return { status: 'not-found' };
  return { status: 'error', message: 'Open Food Facts sent an unexpected answer' };
}

/**
 * Looks one barcode up. Options: fetch (injectable for tests), appVersion, timeoutMs, online (false skips
 * the request: an offline phone answers 'error' at once).
 */
export async function lookupProduct(code, { fetch: fetchFn = globalThis.fetch, appVersion, timeoutMs = LOOKUP_TIMEOUT_MS, online } = {}) {
  const isOnline = online ?? globalThis.navigator?.onLine ?? true;
  if (!isOnline) return { status: 'error', message: 'offline' };
  if (typeof fetchFn !== 'function') return { status: 'error', message: 'no network access' };
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchFn(productUrl(code, appVersion), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal: controller?.signal,
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return mapResponse(res.status, body);
  } catch (err) {
    return { status: 'error', message: err?.name === 'AbortError' ? 'timed out' : err?.message || 'network error' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
