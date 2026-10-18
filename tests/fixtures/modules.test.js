// E2E test build only: the test server (scripts/serve.mjs with THEHUB_TEST=1) answers requests
// for src/modules.js with this file, so the import below resolves from /TheHub/src/.
import gym from './modules/gym/index.js';
import istqb from './modules/istqb/index.js';
import bulgarian from './modules/bulgarian/index.js';
import fridge from './modules/fridge/index.js';
import demo from '../tests/fixtures/demo-module.js';
import sample from '../tests/fixtures/sample-study-module.js';

export default [gym, istqb, bulgarian, fridge, demo, sample];
