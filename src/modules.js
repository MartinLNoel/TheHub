// The modules this build ships, in nav order. Each one follows the module contract in
// docs/plans/part-0-overview.md. Parts 6, 7 and 8 add istqb, bulgarian and fridge here.
// (The e2e test server swaps this file for tests/fixtures/modules.test.js, which adds a demo module.)
import gym from './modules/gym/index.js';

export default [gym];
