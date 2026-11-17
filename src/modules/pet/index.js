// The companion pet (0.9.12; Martin, 2026-11-16: a simple tamagotchi on the home screen, fed "without it feeling
// like a chore"; its look: "Surprise me"). A hidden module: no app icon and no nav tab; it lives on the home screen
// (homeWidget) and has its own page at #/pet. Its data is backed up like every module's.
import { SCHEMA_VERSION, defaultData, validate } from './data.js';
import { homeWidget, renderPet } from './screens.js';

export default {
  id: 'pet',
  name: 'Pet',
  icon: '🌱',
  hidden: true,
  schemaVersion: SCHEMA_VERSION,
  migrations: {},
  defaultData: () => defaultData(),
  validate,
  routes: { '': renderPet },
  homeWidget: (ctx) => homeWidget(ctx),
};
