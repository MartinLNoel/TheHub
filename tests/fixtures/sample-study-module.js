// A sample study module used ONLY by tests (unit and e2e), to exercise the study engine with the
// sample course in tests/fixtures/sample-course/. It never ships: real courses arrive in Part 6 (ISTQB)
// and Part 7 (Bulgarian).
import { createStudyModule } from '../../src/core/study/index.js';

export default createStudyModule({
  id: 'sample',
  name: 'Sample course',
  icon: '📚',
  contentBase: 'tests/fixtures/sample-course/',
  session: { quizSize: 5, drillSize: 4, retrievalCount: 2 },
  mocks: [
    { id: 'quick', label: 'Quick mock', kind: 'mini-mock', count: 5, minutes: 5 },
    { id: 'weighted', label: 'Weighted mock', kind: 'full-mock', perChapter: { 1: 3, 2: 2 }, minutes: 10 },
  ],
  cards: { newPerDay: 10 },
});
