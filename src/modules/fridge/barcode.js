// Retail barcodes (GTINs): EAN-13, EAN-8, UPC-A and UPC-E. Codes stay strings (leading zeros matter).

/** The BarcodeDetector format names the Fridge reads. */
export const RETAIL_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

/** The GS1 check digit for the digits before it (EAN-8, UPC-A, EAN-13 all use this rule). */
export function gs1CheckDigit(body) {
  let sum = 0;
  // Weights 3, 1, 3, ... counted from the digit next to the check digit.
  for (let i = 0; i < body.length; i++) {
    const digit = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10;
}

function hasValidCheckDigit(code) {
  return gs1CheckDigit(code.slice(0, -1)) === Number(code.at(-1));
}

/** Expands an 8-digit UPC-E code (number system 0 or 1) to its 12-digit UPC-A form, or null. */
export function expandUpcE(code) {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const ns = code[0];
  const [d1, d2, d3, d4, d5, d6] = code.slice(1, 7);
  const check = code[7];
  let body;
  if (d6 <= '2') body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === '3') body = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === '4') body = `${d1}${d2}${d3}${d4}00000${d5}`;
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return `${ns}${body}${check}`;
}

/**
 * Cleans and checks a scanned or typed code. format (optional) is the detector's format name.
 * Returns the code to store and look up ("5449000000996"), or null when it is not a valid retail code.
 * UPC-E is stored in its UPC-A form, which is how product databases list it.
 */
export function normalizeBarcode(raw, format) {
  const code = String(raw ?? '').replace(/[\s-]/g, '');
  if (!/^\d+$/.test(code)) return null;
  if (format === 'upc_e' || (code.length === 8 && !hasValidCheckDigit(code))) {
    const upcA = expandUpcE(code);
    return upcA && hasValidCheckDigit(upcA) ? upcA : null;
  }
  if (code.length === 8 || code.length === 12 || code.length === 13) return hasValidCheckDigit(code) ? code : null;
  return null;
}
