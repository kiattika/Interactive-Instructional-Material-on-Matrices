import { computeE1, computeE2, computeEffectivenessIndex, computeEfficiencyStats, EfficiencyInput } from '../lib/efficiencyStats';
import { defaultStudentProgress, StudentProgress } from '../lib/learningStore';
import { resolveCheckAttempt, lessonCheckScore } from '../lib/checkAttempts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}
const close = (a: number | null, b: number) => a !== null && Math.abs(a - b) < 1e-12;

console.log('='.repeat(50));
console.log('  QA: E1 / E2 / EFFECTIVENESS INDEX');
console.log('='.repeat(50));

const s = (o: Partial<EfficiencyInput>): EfficiencyInput => ({
  preTestCompleted: false,
  preTestScore: 0,
  postTestCompleted: false,
  postTestScore: 0,
  ...o
});

// Hand-worked fixture:
//  A: lessons 80, 100 (avg 90)          pre 40  post 80
//  B: lessons 70      (avg 70)          pre 60  post 90
//  C: no scored lessons                 pre 50  (no post)
//  D: lessons 60, 70, 80 (avg 70)       (no pre) post 70
//  E: legacy roster record, no lessonCheckScores field at all
const students: EfficiencyInput[] = [
  s({ lessonCheckScores: { 1: 80, 2: 100 }, preTestCompleted: true, preTestScore: 40, postTestCompleted: true, postTestScore: 80 }),
  s({ lessonCheckScores: { 1: 70 }, preTestCompleted: true, preTestScore: 60, postTestCompleted: true, postTestScore: 90 }),
  s({ lessonCheckScores: {}, preTestCompleted: true, preTestScore: 50 }),
  s({ lessonCheckScores: { 1: 60, 2: 70, 3: 80 }, postTestCompleted: true, postTestScore: 70 }),
  s({})
];

// E1 = mean(90, 70, 70). Here that happens to equal the pooled mean of all 6 lesson scores, so
// the second E1 case below uses data where the two differ.
const e1 = computeE1(students);
assert(close(e1.value, 230 / 3) && e1.n === 3, 'E1 = mean of per-student averages (90, 70, 70) = 76.67, n = 3 (students with ≥1 scored lesson)');
const distinguishing = computeE1([s({ lessonCheckScores: { 1: 100 } }), s({ lessonCheckScores: { 1: 50, 2: 50, 3: 50 } })]);
assert(close(distinguishing.value, 75), 'E1 averages per-student averages (100 and 50 → 75), not the pooled lesson scores (250/4 = 62.5)');

const e2 = computeE2(students);
assert(close(e2.value, 80) && e2.n === 3, 'E2 = mean post-test of the 3 students who completed it (80, 90, 70) = 80, n = 3');

const ei = computeEffectivenessIndex(students);
assert(ei.n === 2, 'E.I. uses only the paired subset (A and B completed both tests), n = 2');
assert(close(ei.meanPre, 50) && close(ei.meanPost, 85), 'paired means: pre 50, post 85 (C and D are excluded)');
assert(close(ei.value, 0.7), 'E.I. = (85 - 50) / (100 - 50) = 0.70');
// Sum form from Thai textbooks: (Σpost - Σpre) / (n·full - Σpre)
assert(close(ei.value, (170 - 100) / (2 * 100 - 100)), 'mean form equals the textbook sum form (Σpost - Σpre) / (n·100 - Σpre)');

const all = computeEfficiencyStats(students);
assert(all.totalStudents === 5 && all.e1.n === 3 && all.e2.n === 3 && all.ei.n === 2, 'each figure keeps its own n, distinct from the roster total (5)');

// Zero denominators -> honest "not enough data", never NaN or a misleading 0
const empty = computeEfficiencyStats([s({}), s({ preTestCompleted: true, preTestScore: 30 })]);
assert(empty.e1.value === null && empty.e1.n === 0, 'E1 is null (not NaN/0) when no student has a scored lesson');
assert(empty.e2.value === null && empty.e2.n === 0, 'E2 is null when no student completed the Post-Test');
assert(empty.ei.value === null && empty.ei.n === 0 && !empty.ei.preAtCeiling, 'E.I. is null when no student has paired data');
const ceiling = computeEffectivenessIndex([s({ preTestCompleted: true, preTestScore: 100, postTestCompleted: true, postTestScore: 100 })]);
assert(ceiling.value === null && ceiling.n === 1 && ceiling.preAtCeiling, 'E.I. is null (flagged, not divided by zero) when mean pre-test is 100');
assert(close(computeEffectivenessIndex([s({ preTestCompleted: true, preTestScore: 60, postTestCompleted: true, postTestScore: 40 })]).value, -0.5), 'E.I. can be negative when post < pre (reported as-is)');

// --- Lesson scores (E1's input) from real check-question outcomes -------------------------------
const base = (): StudentProgress => ({
  ...defaultStudentProgress,
  checkQuestionXpAwarded: [],
  checkQuestionFirstTryMissed: [],
  checkQuestionOutcomes: {}
});
let p = base();
const k = (i: number) => `lesson3-check${i}`;
p = resolveCheckAttempt(p, k(0), true, 0, true).progress; // 1
p = resolveCheckAttempt(p, k(1), true, 1, true).progress; // 0.5 (second try)
p = resolveCheckAttempt(p, k(2), false, 1, true).progress; // 0 (revealed)
p = resolveCheckAttempt(p, k(3), true, 0, false).progress; // 1 — recorded even with XP disabled
assert(lessonCheckScore(p, 3, 5) === null, 'no lesson score until every check-question has an outcome');
p = resolveCheckAttempt(p, k(4), true, 0, true).progress; // 1
assert(lessonCheckScore(p, 3, 5) === 70, 'lesson score = (1 + 0.5 + 0 + 1 + 1) / 5 × 100 = 70, exact');
const retried = resolveCheckAttempt(p, k(2), true, 0, true).progress;
assert(retried.checkQuestionOutcomes[k(2)] === 0, 'a practice retry after the answer was revealed never overwrites the first outcome');
const legacy = { ...base(), checkQuestionXpAwarded: ['lesson4-check0'] };
assert(!('lesson4-check0' in resolveCheckAttempt(legacy, 'lesson4-check0', true, 0, true).progress.checkQuestionOutcomes),
  'a question already settled before outcomes were tracked gets no (possibly after-the-fact) outcome');

console.log('='.repeat(50));
console.log('  ALL EFFICIENCY STATS QA TESTS PASSED!');
console.log('='.repeat(50));
