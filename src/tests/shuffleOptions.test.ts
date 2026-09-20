import { shuffleOptions, shuffleOptionsByValue } from '../lib/shuffleOptions';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

console.log('='.repeat(50));
console.log('  QA: SHUFFLE OPTIONS (ANTI-INDEX-0-CLUSTERING)');
console.log('='.repeat(50));

const OPTIONS_4 = ['A', 'B', 'C', 'D'];

// 1. Determinism: the same seed always produces the same order.
const first = shuffleOptions('student1-q1', OPTIONS_4, 0);
const second = shuffleOptions('student1-q1', OPTIONS_4, 0);
assert(
  JSON.stringify(first) === JSON.stringify(second),
  'same seed must always produce the same shuffled order (stable within one sitting)'
);

// 2. Different seeds (different students) generally produce different orders for the SAME
// question id — spot-check across many synthetic students that they don't all collapse to
// the same order (which would defeat the point of per-student shuffling).
const ordersForOneQuestion = new Set<string>();
for (let s = 0; s < 50; s++) {
  const r = shuffleOptions(`student${s}-q1`, OPTIONS_4, 0);
  ordersForOneQuestion.add(r.options.join(','));
}
assert(
  ordersForOneQuestion.size > 1,
  'different students must not all see the exact same option order for the same question'
);

// 3. Correctness is preserved: whatever index correctIndex ends up at, that option's VALUE in
// the shuffled array must be the original correct option.
const original = ['correct', 'wrong1', 'wrong2', 'wrong3'];
let allCorrectPreserved = true;
for (let s = 0; s < 20; s++) {
  const r = shuffleOptions(`student${s}-qX`, original, 0);
  if (r.options[r.correctIndex] !== 'correct') allCorrectPreserved = false;
}
assert(allCorrectPreserved, 'the correct option must still be at correctIndex after shuffling, for any seed');

// 4. The main regression test: across a large sample of questions that ALL had their correct
// answer hardcoded at index 0 (the exact bug found in learningStore.ts / diagnosticQuestions.ts
// / matrixEngine.ts), the shuffled correct-answer position must be roughly evenly distributed
// across all 4 slots, not clustered back at index 0.
const SAMPLE_SIZE = 4000;
const positionCounts = [0, 0, 0, 0];
for (let i = 0; i < SAMPLE_SIZE; i++) {
  const { correctIndex } = shuffleOptions(`student${i}-question${i}`, OPTIONS_4, 0);
  positionCounts[correctIndex]++;
}
console.log(`  Position distribution over ${SAMPLE_SIZE} samples: ${positionCounts.join(', ')}`);
const expected = SAMPLE_SIZE / 4;
const tolerance = expected * 0.25; // generous — this only needs to rule out clustering, not be perfectly uniform
for (let pos = 0; pos < 4; pos++) {
  assert(
    Math.abs(positionCounts[pos] - expected) < tolerance,
    `option index ${pos} should get roughly ${expected} correct answers (got ${positionCounts[pos]}, tolerance ±${tolerance})`
  );
}
assert(
  positionCounts[0] < SAMPLE_SIZE * 0.4,
  `index 0 must not still dominate after shuffling (got ${positionCounts[0]}/${SAMPLE_SIZE})`
);

// 5. shuffleOptionsByValue: matches by value instead of index, and preserves correctness.
const valueOptions = ['$-3$', '$3$', '$-1$', '$1$'];
const byValue = shuffleOptionsByValue('student7-ex1', valueOptions, '$-3$');
assert(
  byValue.options[byValue.correctIndex] === '$-3$',
  'shuffleOptionsByValue must locate the correct value and preserve it after shuffling'
);

// 6. shuffleOptionsByValue fails safe (doesn't throw) when the value genuinely isn't present.
const notFound = shuffleOptionsByValue('student1-badq', valueOptions, '$999$');
assert(notFound.correctIndex === -1, 'shuffleOptionsByValue must report -1, not throw, when the correct value is missing');
assert(
  JSON.stringify(notFound.options) === JSON.stringify(valueOptions),
  'shuffleOptionsByValue must leave options in original order when the correct value is missing'
);

console.log('\n' + '='.repeat(50));
console.log('  ALL SHUFFLE OPTIONS QA TESTS PASSED!');
console.log('='.repeat(50));
