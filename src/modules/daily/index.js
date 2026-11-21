// Daily checks (0.9.13; Martin, 2026-11-21): things done once a day, ticked on the home screen under "Today", reset
// every day. A hidden module like the pet: no app icon and no nav tab; its page (#/daily) is opened from the
// widget. Its data is backed up like every module's.
import { SCHEMA_VERSION, defaultData, validate } from './data.js';
import { renderDaily, todayWidget } from './screens.js';

export default {
  id: 'daily',
  name: 'Daily checks',
  icon: '✅',
  hidden: true,
  schemaVersion: SCHEMA_VERSION,
  migrations: {},
  defaultData: () => defaultData(),
  validate,
  routes: { '': (ctx) => renderDaily(ctx) },
  todayWidget: (ctx) => todayWidget(ctx),
};
