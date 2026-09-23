import {
  CURRICULUM_LESSONS,
  defaultStudentProgress,
  StudentProgress,
  CHECK_QUESTION_CORRECT_XP,
  CHECK_QUESTION_SECOND_TRY_XP
} from '../lib/learningStore';
import { generateExercises } from '../lib/matrixEngine';
import { resolveCheckAttempt } from '../lib/checkAttempts';
import { shuffleOptions } from '../lib/shuffleOptions';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

console.log('='.repeat(50));
console.log('  QA: PRACTICE QUESTIONS (CONTENT + TWO-STRIKE XP)');
console.log('='.repeat(50));

// --- Content shape ------------------------------------------------------------------------------
let checkQuestionCount = 0;
for (const lesson of CURRICULUM_LESSONS) {
  assert(lesson.checkQuestions.length === 5, `lesson ${lesson.id} has 5 check-questions`);
  lesson.checkQuestions.forEach((q, i) => {
    const label = `lesson ${lesson.id} q${i + 1}`;
    checkQuestionCount++;
    const shapeOk =
      q.options.length === 4 &&
      new Set(q.options).size === q.options.length &&
      q.correctIndex >= 0 &&
      q.correctIndex < q.options.length &&
      q.whyWrong.length === q.options.length &&
      q.whyWrong.every((w, j) => (j === q.correctIndex ? w === null : typeof w === 'string' && w.trim().length > 0)) &&
      q.explanation.trim().length > 0;
    if (!shapeOk) assert(false, `${label}: 4 unique options, valid correctIndex, whyWrong null only at the answer and non-empty elsewhere`);
  });
}
assert(checkQuestionCount === 60, 'all 60 check-questions have 4 unique options and a "why wrong" for every wrong option');

for (const ex of generateExercises()) {
  if (!ex.options) continue;
  const wrong = ex.options.filter((o) => o !== ex.correctAnswer);
  const fb = ex.optionFeedback || {};
  assert(ex.options.includes(ex.correctAnswer as string), `${ex.id}: correctAnswer is one of its options`);
  assert(wrong.every((o) => typeof fb[o] === 'string' && fb[o].trim().length > 0), `${ex.id}: every wrong option has feedback`);
  assert(!(ex.correctAnswer as string in fb), `${ex.id}: the correct answer has no "why wrong" feedback`);
  assert(Object.keys(fb).every((k) => ex.options!.includes(k)), `${ex.id}: every feedback key matches a real option`);
}

// --- Shuffling option+feedback pairs keeps existing students' order -------------------------------
const q0 = CURRICULUM_LESSONS[0].checkQuestions[0];
const seed = 'student-abc-lesson1-check0';
const asStrings = shuffleOptions(seed, q0.options, q0.correctIndex);
const asPairs = shuffleOptions(seed, q0.options.map((text, i) => ({ text, why: q0.whyWrong[i] })), q0.correctIndex);
assert(
  JSON.stringify(asPairs.options.map((p) => p.text)) === JSON.stringify(asStrings.options) &&
    asPairs.correctIndex === asStrings.correctIndex,
  'shuffling {text, whyWrong} pairs yields the same order as the previous string-only shuffle'
);
assert(asPairs.options[asPairs.correctIndex].why === null, 'after shuffling, the correct option still carries a null whyWrong');

// --- Two-strike XP rules ------------------------------------------------------------------------
const fresh = (o: Partial<StudentProgress> = {}): StudentProgress => ({
  ...defaultStudentProgress,
  xp: 100,
  checkQuestionXpAwarded: [],
  checkQuestionFirstTryMissed: [],
  ...o
});
const KEY = 'lesson1-check0';

assert(CHECK_QUESTION_SECOND_TRY_XP === 3, 'second-try XP is half of 5, rounded up to a whole 3');

let r = resolveCheckAttempt(fresh(), KEY, true, 0, true);
assert(r.outcome === 'correct' && r.xpAwarded === CHECK_QUESTION_CORRECT_XP && r.progress.xp === 105, 'correct on first try: full XP');
assert(r.progress.checkQuestionXpAwarded.includes(KEY), 'correct answer settles the key');

r = resolveCheckAttempt(fresh(), KEY, false, 0, true);
assert(r.outcome === 'retry' && r.xpAwarded === 0 && r.progress.xp === 100, 'first wrong pick: retry, no XP, answer not revealed');
assert(r.progress.checkQuestionFirstTryMissed.includes(KEY), 'first wrong pick is remembered');
const afterMiss = r.progress;

r = resolveCheckAttempt(afterMiss, KEY, true, 1, true);
assert(r.outcome === 'correct' && r.xpAwarded === CHECK_QUESTION_SECOND_TRY_XP && r.progress.xp === 103, 'correct on second try: half XP');

r = resolveCheckAttempt(afterMiss, KEY, false, 1, true);
assert(r.outcome === 'revealed' && r.xpAwarded === 0 && r.progress.xp === 100, 'wrong twice: revealed, no XP');
const afterReveal = r.progress;
assert(afterReveal.checkQuestionXpAwarded.includes(KEY), 'revealing the answer settles (forfeits) the key');

r = resolveCheckAttempt(afterReveal, KEY, true, 0, true);
assert(r.xpAwarded === 0 && r.progress.xp === 100, 'after a reveal, "try again" then answering correctly earns nothing (old loophole closed)');

r = resolveCheckAttempt(afterMiss, KEY, true, 0, true);
assert(r.xpAwarded === CHECK_QUESTION_SECOND_TRY_XP, 'a reset/revisit after a first miss can earn at most half XP');

r = resolveCheckAttempt(fresh({ checkQuestionXpAwarded: [KEY] }), KEY, true, 0, true);
assert(r.xpAwarded === 0 && r.progress.xp === 100, 'an already-settled question never pays again');

r = resolveCheckAttempt(fresh(), KEY, true, 0, false);
assert(r.xpAwarded === 0 && !r.progress.checkQuestionXpAwarded.includes(KEY), 'with XP disabled: no XP, and the key stays unsettled');

const noop = fresh({ checkQuestionFirstTryMissed: [KEY] });
assert(resolveCheckAttempt(noop, KEY, false, 0, true).progress === noop, 'a repeat first miss with nothing new to record returns the same object');

console.log('='.repeat(50));
console.log('  ALL PRACTICE QUESTION QA TESTS PASSED!');
console.log('='.repeat(50));
