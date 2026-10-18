// Camera barcode scanning for the Fridge.
//
// The phone's own BarcodeDetector is used when it reads EAN-13 (Chrome on Android usually does). Otherwise
// the vendored barcode-detector ponyfill (zxing-wasm, src/vendor/barcode-detector/README.md) is loaded on
// demand, with its .wasm from this app (never a CDN), so scanning works offline.
// PLACEHOLDER(Q-19): which one Martin's phone uses is unknown until he opens Settings → Diagnostics.
import { RETAIL_FORMATS, normalizeBarcode } from './barcode.js';

const VENDOR = new URL('../../vendor/barcode-detector/', import.meta.url);

/** The formats the phone's own BarcodeDetector reads, or null when it has none. Never throws. */
export async function nativeFormats(win = globalThis) {
  const BD = win.BarcodeDetector;
  if (typeof BD !== 'function' || typeof BD.getSupportedFormats !== 'function') return null;
  try {
    const formats = await BD.getSupportedFormats();
    return Array.isArray(formats) ? formats : null;
  } catch {
    return null;
  }
}

let fallbackLib = null;
async function loadFallback() {
  if (!fallbackLib) {
    fallbackLib = (async () => {
      const lib = await import(new URL('ponyfill.js', VENDOR).href);
      await lib.prepareZXingModule({
        overrides: {
          locateFile: (path, prefix) => (path.endsWith('.wasm') ? new URL(path, VENDOR).href : prefix + path),
        },
        fireImmediately: true,
      });
      return lib;
    })();
    fallbackLib.catch(() => {
      fallbackLib = null; // let a later attempt try again
    });
  }
  return fallbackLib;
}

/**
 * A detector for retail barcodes: { kind: 'native' | 'fallback', formats, detect(source) }.
 * forceFallback skips the phone's own detector (tests). Rejects when neither can start.
 */
export async function createDetector({ win = globalThis, forceFallback = false } = {}) {
  if (!forceFallback) {
    const formats = await nativeFormats(win);
    const usable = formats ? RETAIL_FORMATS.filter((f) => formats.includes(f)) : [];
    if (usable.includes('ean_13')) {
      const detector = new win.BarcodeDetector({ formats: usable });
      return { kind: 'native', formats: usable, detect: (source) => detector.detect(source) };
    }
  }
  const lib = await loadFallback();
  const detector = new lib.BarcodeDetector({ formats: RETAIL_FORMATS });
  return { kind: 'fallback', formats: [...RETAIL_FORMATS], detect: (source) => detector.detect(source) };
}

/** Turns a camera error into what Martin should read (and whether it was a refusal). */
export function cameraProblem(err) {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
    return {
      denied: true,
      message:
        'Camera access was refused. To scan, allow the camera for TheHub (Chrome: the lock or tune icon next to the address, or Android Settings → Apps → Chrome → Permissions). You can type the barcode or add the item by hand below.',
    };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
    return { denied: false, message: 'No camera was found. Type the barcode or add the item by hand below.' };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return { denied: false, message: 'The camera is busy (another app may be using it). Close that app and try again, or type the barcode below.' };
  }
  if (name === 'Unsupported' || name === 'NotSupportedError' || name === 'TypeError') {
    return { denied: false, message: 'This browser cannot open the camera here. Type the barcode or add the item by hand below.' };
  }
  return { denied: false, message: `The camera could not start (${err?.message || name || 'unknown problem'}). Type the barcode or add the item by hand below.` };
}

/**
 * Opens the back camera in `video` and reads barcodes until one valid retail code is found.
 * Calls onCode(code) once (then stops), onProblem({ denied, message }) if the camera cannot start,
 * onReady(kind) when scanning runs. Returns stop(). Stops by itself when the video leaves the page or
 * the app goes to the background.
 */
export function startScanner({
  video,
  onCode,
  onProblem,
  onReady,
  win = globalThis,
  mediaDevices = win.navigator?.mediaDevices,
  detectorFactory = createDetector,
  intervalMs = 200,
}) {
  let stopped = false;
  let stream = null;
  let timer = null;

  function stop() {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    stream?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
    win.removeEventListener?.('hashchange', stop);
    win.document?.removeEventListener?.('visibilitychange', onHidden);
  }
  function onHidden() {
    if (win.document?.visibilityState === 'hidden') stop();
  }
  win.addEventListener?.('hashchange', stop);
  win.document?.addEventListener?.('visibilitychange', onHidden);

  (async () => {
    if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
      stop();
      onProblem?.(cameraProblem({ name: 'Unsupported' }));
      return;
    }
    // The camera is asked for only now, when the scan screen is open; the reader is made after that, so a
    // refused camera never loads the fallback's .wasm.
    try {
      stream = await mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch (err) {
      if (!stopped) {
        stop();
        onProblem?.(cameraProblem(err));
      }
      return;
    }
    if (stopped) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    let detector;
    try {
      detector = await detectorFactory({ win });
    } catch (err) {
      if (!stopped) {
        stop();
        onProblem?.({ denied: false, message: `The barcode reader could not start (${err?.message || 'unknown problem'}). Type the barcode below.` });
      }
      return;
    }
    if (stopped) return;
    video.srcObject = stream;
    video.play?.()?.catch?.(() => {});
    onReady?.(detector.kind);

    const tick = async () => {
      if (stopped) return;
      if (!video.isConnected) return stop();
      try {
        if (video.readyState >= 2) {
          const results = await detector.detect(video);
          if (stopped) return;
          for (const r of results || []) {
            const code = normalizeBarcode(r.rawValue, r.format);
            if (code) {
              stop();
              onCode(code);
              return;
            }
          }
        }
      } catch {
        // A frame that cannot be read: try the next one.
      }
      if (!stopped) timer = setTimeout(tick, intervalMs);
    };
    tick();
  })();

  return stop;
}
