// E2E test build only: the test server (scripts/serve.mjs with THEHUB_TEST=1) answers requests
// for src/modules.js with this file, so the import below resolves from /TheHub/src/.
import demo from '../tests/fixtures/demo-module.js';

export default [demo];
