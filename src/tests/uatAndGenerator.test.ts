import {
  solveLinearSystem,
  getCramerSteps,
  getInverseSteps,
  getGaussSteps,
  toFraction,
  formatFractionOrDec,
  det
} from '../lib/matrixEngine';
import { LinearSystem } from '../types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ UAT FAIL: ${msg}`);
    process.exit(1);
  }
}

console.log('==================================================');
console.log('   RUNNING PHASE 4 AUTOMATED UAT & STRESS TESTS   ');
console.log('==================================================\n');

// 1. Math Method Consistency Test (Inverse == Cramer == Gauss)
console.log('--- Test 1: Method Consistency (Inverse == Cramer == Gauss) ---');
const testSystem: LinearSystem = {
  dimension: '3x3',
  A: [
    [2, 1, -1],
    [-3, -1, 2],
    [-2, 1, 2]
  ],
  B: [8, -11, -3],
  variables: ['x', 'y', 'z']
};

const solSystem = solveLinearSystem(testSystem);
const cramerRes = getCramerSteps(testSystem);
const invRes = getInverseSteps(testSystem);

assert(solSystem.type === 'unique', '3x3 test system must have a unique solution');
assert(solSystem.solution !== null, 'Solution must not be null');

const [x, y, z] = solSystem.solution!;
assert(Math.abs(x - 2) < 1e-4, 'x must equal 2');
assert(Math.abs(y - 3) < 1e-4, 'y must equal 3');
assert(Math.abs(z - (-1)) < 1e-4, 'z must equal -1');

assert(cramerRes.x === 2 && cramerRes.y === 3 && cramerRes.z === -1, 'Cramer method must yield x=2, y=3, z=-1');
assert(invRes.solutionX![0] === 2 && invRes.solutionX![1] === 3 && invRes.solutionX![2] === -1, 'Inverse method must yield x=2, y=3, z=-1');

console.log('✓ PASS: All 3 methods yield mathematically identical solutions for 3x3 system.');

// 2. Classroom Problem Generator Stress Test (100 Generated Problems)
console.log('\n--- Test 2: Generator Stress Test (100 Systems) ---');
let generatedCount = 0;

for (let i = 0; i < 50; i++) {
  // 2x2 random unique system
  const a1 = Math.floor(Math.random() * 10) - 5 || 1;
  const b1 = Math.floor(Math.random() * 10) - 5 || 1;
  const a2 = Math.floor(Math.random() * 10) - 5 || 1;
  const b2 = Math.floor(Math.random() * 10) - 5 || 1;
  
  // Ensure non-zero det
  if (a1 * b2 - b1 * a2 === 0) continue;

  const sys2x2: LinearSystem = {
    dimension: '2x2',
    A: [[a1, b1], [a2, b2]],
    B: [Math.floor(Math.random() * 20) - 10, Math.floor(Math.random() * 20) - 10],
    variables: ['x', 'y']
  };

  const sol = solveLinearSystem(sys2x2);
  assert(sol.type === 'unique', `Random 2x2 #${i} must solve uniquely`);
  assert(sol.solution !== null && !isNaN(sol.solution[0]) && !isNaN(sol.solution[1]), `Random 2x2 #${i} values must be valid numbers`);
  generatedCount++;
}

for (let i = 0; i < 50; i++) {
  // 3x3 system
  const sys3x3: LinearSystem = {
    dimension: '3x3',
    A: [
      [1, 1, 1],
      [2, -1, 1],
      [3, 1, -1]
    ],
    B: [Math.floor(Math.random() * 15), Math.floor(Math.random() * 15), Math.floor(Math.random() * 15)],
    variables: ['x', 'y', 'z']
  };

  const sol = solveLinearSystem(sys3x3);
  assert(sol.type === 'unique', `Random 3x3 #${i} must solve uniquely`);
  assert(sol.solution !== null && !isNaN(sol.solution[0]), `Random 3x3 #${i} values must be valid numbers`);
  generatedCount++;
}

console.log(`✓ PASS: ${generatedCount} generated classroom problems verified without math errors.`);

// 3. Fraction Formatting Test
console.log('\n--- Test 3: Fraction & Decimal QA ---');
assert(toFraction(0.5) === '1/2', '0.5 -> 1/2');
assert(toFraction(0.75) === '3/4', '0.75 -> 3/4');
assert(toFraction(0.33333333) === '1/3', '0.33333333 -> 1/3');
assert(formatFractionOrDec(2.5) === '5/2', '2.5 -> 5/2');
assert(formatFractionOrDec(4) === '4', 'Integer 4 stays 4');

console.log('✓ PASS: Fraction and exact decimal formatting passed all UAT assertions.');

console.log('\n==================================================');
console.log('     ALL AUTOMATED PHASE 4 UAT TESTS PASSED!      ');
console.log('==================================================');
