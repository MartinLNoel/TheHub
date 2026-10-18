# Vendored: barcode-detector 3.2.2 (with zxing-wasm 3.1.3)

The Fridge's fallback barcode scanner, used only when the phone's own `BarcodeDetector` is missing or cannot read
EAN / UPC codes (`src/modules/fridge/scanner.js`). The app has no build step, so the files are copied here
unchanged from the npm packages and listed in `PRECACHE` in `sw.js` (it works offline).

| File | From | SHA-256 |
|---|---|---|
| `ponyfill.js` | `barcode-detector@3.2.2` `dist/es/ponyfill.js` | `009a5585abd30198fb5fbdfca4a0c6555747a6da308442462adc47f101e9605a` |
| `zxing-exported.js` | `barcode-detector@3.2.2` `dist/es/zxing-exported.js` (bundles the zxing-wasm 3.1.3 loader) | `96594fe045ebae09ffc7c22901a7efda1874736b937cf2006470f0bdc92bb551` |
| `zxing_reader.wasm` | `zxing-wasm@3.1.3` `dist/reader/zxing_reader.wasm` | `2ebda08a93eea3efcd8399cda6b276e6a0b1de4fec60b4d8988a047de4c6d1ba` (equals the library's own `ZXING_WASM_SHA256`) |

Licences: `LICENSE-barcode-detector.txt` (MIT, Ze-Zheng Wu), `LICENSE-zxing-wasm.txt` (MIT, Ze-Zheng Wu),
`LICENSE-zxing-cpp-Apache-2.0.txt` (Apache 2.0, the zxing-cpp code compiled into the `.wasm`).

By default the library downloads the `.wasm` from a CDN; `scanner.js` calls `prepareZXingModule` with a
`locateFile` override so it loads the copy in this folder instead. Nothing here talks to the network.

To update: `npm pack barcode-detector@<version>` and the `zxing-wasm` version it depends on (exact, see its
`package.json`), copy the same three files, update this table and the licence files, bump the app version, and
run the e2e test "fallback scanner reads an EAN-13 from the camera".
