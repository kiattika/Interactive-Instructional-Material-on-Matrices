import {
  determinantBreakdown,
  isAnswerCorrect,
  detMistakeHint,
  cofactorSign,
  adjugateFromMinors,
  minorMatrix
} from '../lib/determinantPractice';
import { det, adjugate2x2, adjugate3x3 } from '../lib/matrixEngine';
import { defaultStudentProgress, withLabPracticeCompletion, LAB_WALKTHROUGH_XP } from '../lib/learningStore';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

console.log('='.repeat(50));
console.log('  QA: INTERACTIVE DETERMINANT / ADJUGATE BREAKDOWN');
console.log('='.repeat(50));

// --- Hand-checked 2x2 and 3x3 ---------------------------------------------------------------------
const b2 = determinantBreakdown([[2, 1], [1, -1]]);
assert(b2.forward[0].product === -2 && b2.backward[0].product === 1 && b2.det === -3, '2x2: ad = -2, bc = 1, det = -3');
assert(JSON.stringify(b2.forward[0].cells) === '[[0,0],[1,1]]' && JSON.stringify(b2.backward[0].cells) === '[[0,1],[1,0]]', '2x2 diagonals point at the right cells');

const M3 = [[1, 1, 1], [2, -1, 1], [3, 1, -1]];
const b3 = determinantBreakdown(M3);
assert(JSON.stringify(b3.forward.map((t) => t.product)) === JSON.stringify([1, 3, 2]), 'Sarrus forward products: 1·(-1)·(-1)=1, 1·1·3=3, 1·2·1=2');
assert(JSON.stringify(b3.backward.map((t) => t.product)) === JSON.stringify([-3, 1, -2]), 'Sarrus backward products: 1·(-1)·3=-3, 1·1·1=1, 1·2·(-1)=-2');
assert(b3.det === 10 && b3.det === det(M3), 'Sarrus det = (1+3+2) - (-3+1-2) = 10, matching det()');
assert(JSON.stringify(b3.forward[1].cells) === '[[0,1],[1,2],[2,3]]', 'Sarrus diagonals use the extended columns (col 3 = repeated col 0)');

// --- Agreement with the engine on many random matrices ---------------------------------------------
let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 19) - 9; // integers -9..9
let checked = 0;
for (let k = 0; k < 300; k++) {
  const A2 = [[rand(), rand()], [rand(), rand()]];
  const A3 = [[rand(), rand(), rand()], [rand(), rand(), rand()], [rand(), rand(), rand()]];
  if (determinantBreakdown(A2).det !== det(A2)) assert(false, `2x2 breakdown disagrees with det() for ${JSON.stringify(A2)}`);
  if (determinantBreakdown(A3).det !== det(A3)) assert(false, `Sarrus breakdown disagrees with det() for ${JSON.stringify(A3)}`);
  const minors = [0, 1, 2].map((i) => [0, 1, 2].map((j) => determinantBreakdown(minorMatrix(A3, i, j)).det));
  const { adjugate } = adjugateFromMinors(minors);
  if (JSON.stringify(adjugate) !== JSON.stringify(adjugate3x3(A3))) assert(false, `minors → cofactors → transpose disagrees with adjugate3x3() for ${JSON.stringify(A3)}`);
  checked++;
}
assert(checked === 300, '300 random 2x2 + 3x3 matrices: breakdown det == det(), and minors → signs → transpose == adjugate3x3()');
assert(JSON.stringify(adjugate2x2([[2, 1], [1, -1]])) === JSON.stringify([[-1, -1], [-1, 2]]), 'engine 2x2 adjugate reference for the 2x2 fill-in step');

const dec = determinantBreakdown([[0.5, 1.5], [2, 0.25]]);
assert(dec.det === det([[0.5, 1.5], [2, 0.25]]), 'decimal entries: breakdown det matches det() (no float drift)');

// --- Answer checking + hints ---------------------------------------------------------------------
assert(isAnswerCorrect('-3', -3) && isAnswerCorrect(' -3 ', -3) && isAnswerCorrect('-6/2', -3), 'accepts integers, spaces and equivalent fractions');
assert(isAnswerCorrect('0.125', 1 / 8) && !isAnswerCorrect('0.12', 1 / 8), 'decimals compared exactly (0.125 ok, 0.12 not)');
assert(!isAnswerCorrect('', 0) && !isAnswerCorrect('abc', 0) && !isAnswerCorrect('3', -3), 'empty, garbage and sign errors are rejected');
assert(detMistakeHint(String(b3.forwardSum + b3.backwardSum), b3)!.includes('บวกกัน'), 'hint when the two sums are added instead of subtracted');
assert(detMistakeHint(String(b3.backwardSum - b3.forwardSum), b3)!.includes('กลับด้าน'), 'hint when the subtraction is reversed');
assert(detMistakeHint('99', b3) === null, 'no specific hint for an unrelated wrong value');

assert([cofactorSign(0, 0), cofactorSign(0, 1), cofactorSign(1, 1), cofactorSign(2, 1)].join(',') === '1,-1,1,-1', 'checkerboard cofactor signs');

// --- One-time XP per method + size -----------------------------------------------------------------
const start = { ...defaultStudentProgress, xp: 100, matrixLabPracticeCompleted: [] as string[] };
const once = withLabPracticeCompletion(start, 'inverse-2x2', true);
assert(once.xpAwarded === LAB_WALKTHROUGH_XP && once.progress.xp === 115, 'first Inverse 2x2 completion pays LAB_WALKTHROUGH_XP (15)');
const again = withLabPracticeCompletion(once.progress, 'inverse-2x2', true);
assert(again.xpAwarded === 0 && again.progress === once.progress, 'completing Inverse 2x2 again (other presets, tab switching) pays nothing and changes nothing');
const other = withLabPracticeCompletion(again.progress, 'inverse-3x3', true);
assert(other.xpAwarded === LAB_WALKTHROUGH_XP, 'Inverse 3x3 is a separate one-time award');
const cr = withLabPracticeCompletion(other.progress, 'cramer-2x2', true);
assert(cr.xpAwarded === LAB_WALKTHROUGH_XP && cr.progress.matrixLabPracticeCompleted.length === 3, 'Cramer 2x2 is separate from Inverse 2x2');
const off = withLabPracticeCompletion(start, 'cramer-3x3', false);
assert(off.xpAwarded === 0 && off.progress.matrixLabPracticeCompleted.includes('cramer-3x3'), 'with XP disabled completion is still recorded (no retroactive payout later)');
assert(withLabPracticeCompletion(off.progress, 'cramer-3x3', true).xpAwarded === 0, 're-enabling XP never pays out for a walkthrough finished while it was off');

console.log('='.repeat(50));
console.log('  ALL DETERMINANT PRACTICE QA TESTS PASSED!');
console.log('='.repeat(50));
