// Settings → Diagnostics: what this phone's browser can do, for checks Claude cannot make from the PC
// (Q-19: which barcode formats the phone's own BarcodeDetector reads).
import { h } from './dom.js';

/** One line on the browser's own BarcodeDetector. Never throws. */
export async function barcodeSupportLine(win = globalThis) {
  const BD = win.BarcodeDetector;
  if (typeof BD !== 'function' || typeof BD.getSupportedFormats !== 'function') {
    return "BarcodeDetector: not available (the Fridge uses TheHub's built-in reader).";
  }
  try {
    const formats = await BD.getSupportedFormats();
    return formats?.length ? `BarcodeDetector formats: ${formats.join(', ')}` : "BarcodeDetector: present but reads no formats (the Fridge uses TheHub's built-in reader).";
  } catch (err) {
    return `BarcodeDetector: error (${err?.message || err}).`;
  }
}

/** One line on camera access. */
export function cameraLine(win = globalThis) {
  return typeof win.navigator?.mediaDevices?.getUserMedia === 'function' ? 'Camera: available (asked for only when scanning).' : 'Camera: not available in this browser.';
}

export function diagnosticsCard(win = globalThis) {
  const barcode = h('p', { 'data-testid': 'diag-barcode' }, 'BarcodeDetector: checking…');
  barcodeSupportLine(win).then((line) => (barcode.textContent = line));
  return h(
    'section',
    { class: 'card', 'data-testid': 'diagnostics' },
    h('h2', {}, 'Diagnostics'),
    barcode,
    h('p', { 'data-testid': 'diag-camera' }, cameraLine(win)),
    h('p', { class: 'muted' }, 'If Claude asks what your phone supports, copy these lines.'),
  );
}
