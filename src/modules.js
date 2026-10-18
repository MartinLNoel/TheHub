// The modules this build ships, in nav order. Each one follows the module contract in
// docs/plans/part-0-overview.md. Part 6 added istqb, Part 8 fridge; Part 7 adds bulgarian here.
// (The e2e test server swaps this file for tests/fixtures/modules.test.js, which adds a demo module.)
import gym from './modules/gym/index.js';
import istqb from './modules/istqb/index.js';
import fridge from './modules/fridge/index.js';

export default [gym, istqb, fridge];
