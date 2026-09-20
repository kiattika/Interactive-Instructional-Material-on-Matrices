// Shared, rendering-layer fix for a systemic exam-quality bug found across three separate
// content sources (learningStore.ts's lesson checkQuestions, diagnosticQuestions.ts, and
// matrixEngine.ts's generateExercises): the correct answer was overwhelmingly placed at
// option index 0 (30/36 lesson questions, 18/20 diagnostic questions, 4/5 hardcoded exercises).
// Rather than hand-editing ~60+ hardcoded option arrays across three files (which would also
// leave the bug free to return the moment anyone adds new content the same way), every consumer
// shuffles options through this module before rendering them.
//
// The seed should combine the current student's id (see classroomSync.ts's getStudentId) with
// the question's own id, e.g. `${studentId}-${questionId}`. That gives two properties at once:
//   - Stable within one student's usage: the same question always shuffles the same way for
//     them, so it doesn't visibly re-order on every re-render or revisit.
//   - Different across students: two students see the SAME question in DIFFERENT orders, so
//     "the answer is always in position N" can never become the new predictable pattern either.

/** Deterministic 32-bit string hash (djb2-xor variant) — good enough for a shuffle seed, not
 * meant to be cryptographic. */
function hashStringToSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  return hash >>> 0; // unsigned
}

/** mulberry32 — small, fast, deterministic PRNG seeded from the hash above. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ShuffledOptions<T> {
  options: T[];
  correctIndex: number;
}

/**
 * Shuffles `options` deterministically based on `seed`, returning the new array plus the
 * correct answer's new index. Use this directly for index-based content (e.g. Question's
 * `correctIndex`); use `shuffleOptionsByValue` below for value-based content (e.g.
 * ExerciseQuestion's `correctAnswer` string matched against `options`).
 */
export function shuffleOptions<T>(seed: string, options: T[], correctIndex: number): ShuffledOptions<T> {
  const rand = mulberry32(hashStringToSeed(seed));
  const order = options.map((_, i) => i);
  // Fisher-Yates, driven by the seeded PRNG so the same seed always produces the same order.
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const shuffled = order.map((i) => options[i]);
  const newCorrectIndex = order.indexOf(correctIndex);
  return { options: shuffled, correctIndex: newCorrectIndex };
}

/**
 * Convenience wrapper for content where the correct answer is identified by matching a VALUE
 * against `options` (e.g. ExerciseQuestion.correctAnswer: string) rather than an index.
 * Returns correctIndex: -1 (with options left in their original order) if the value genuinely
 * isn't found — fails safe rather than throwing on malformed content.
 */
export function shuffleOptionsByValue<T>(seed: string, options: T[], correctValue: T): ShuffledOptions<T> {
  const correctIndex = options.indexOf(correctValue);
  if (correctIndex === -1) {
    return { options, correctIndex: -1 };
  }
  return shuffleOptions(seed, options, correctIndex);
}
