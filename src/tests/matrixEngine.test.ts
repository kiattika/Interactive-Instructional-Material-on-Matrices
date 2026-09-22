import {
  det,
  multiplyMatrix,
  multiplyMatrixVector,
  inverseMatrix,
  solveLinearSystem,
  getInverseSteps,
  getCramerSteps,
  getGaussSteps,
  formatFractionOrDec,
  toFraction,
} from '../lib/matrixEngine';
import { LinearSystem } from '../types';
import { CIRCUIT_4LOOP, UNIQUE_4X4, INFINITE_4X4, NO_SOLUTION_4X4 } from '../pages/HigherOrderLab';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

function testAllCases() {
  console.log('==================================================');
  console.log('       RUNNING DETERMINISTIC MATRIX ENGINE QA     ');
  console.log('==================================================\n');

  // Case A: Unique Solution 2x2 (2x + y = 5, x - y = 1)
  const caseA: LinearSystem = {
    dimension: '2x2',
    A: [
      [2, 1],
      [1, -1],
    ],
    B: [5, 1],
    variables: ['x', 'y'],
  };

  const solA = solveLinearSystem(caseA);
  assert(solA.type === 'unique', 'Case A must be unique solution');
  assert(solA.determinant === -3, 'Case A det(A) must be -3');
  assert(Math.abs(solA.solution![0] - 2) < 1e-4, 'Case A x = 2');
  assert(Math.abs(solA.solution![1] - 1) < 1e-4, 'Case A y = 1');

  // Cross-verify Case A with Cramer
  const cramerA = getCramerSteps(caseA);
  assert(cramerA.x === 2 && cramerA.y === 1, 'Case A Cramer rule gives x=2, y=1');

  // Cross-verify Case A with Inverse
  const invA = getInverseSteps(caseA);
  assert(invA.hasInverse && invA.solutionX![0] === 2 && invA.solutionX![1] === 1, 'Case A Inverse method gives x=2, y=1');

  // Case B: Unique Solution 3x3 (x+y+z=6, 2x-y+z=3, 3x+y-z=2)
  const caseB: LinearSystem = {
    dimension: '3x3',
    A: [
      [1, 1, 1],
      [2, -1, 1],
      [3, 1, -1],
    ],
    B: [6, 3, 2],
    variables: ['x', 'y', 'z'],
  };

  const solB = solveLinearSystem(caseB);
  assert(solB.type === 'unique', 'Case B must be unique solution');
  assert(Math.abs(solB.solution![0] - 1) < 1e-4, 'Case B x = 1');
  assert(Math.abs(solB.solution![1] - 2) < 1e-4, 'Case B y = 2');
  assert(Math.abs(solB.solution![2] - 3) < 1e-4, 'Case B z = 3');

  // Verify Cramer 3x3
  const cramerB = getCramerSteps(caseB);
  assert(cramerB.x === 1 && cramerB.y === 2 && cramerB.z === 3, 'Case B Cramer gives x=1, y=2, z=3');

  // Verify Inverse 3x3
  const invB = getInverseSteps(caseB);
  assert(invB.hasInverse && invB.solutionX![0] === 1 && invB.solutionX![1] === 2 && invB.solutionX![2] === 3, 'Case B Inverse gives x=1, y=2, z=3');

  // Case C: No Solution (x + y = 2, 2x + 2y = 5)
  const caseC: LinearSystem = {
    dimension: '2x2',
    A: [
      [1, 1],
      [2, 2],
    ],
    B: [2, 5],
    variables: ['x', 'y'],
  };

  const solC = solveLinearSystem(caseC);
  assert(solC.type === 'no_solution', 'Case C must detect No Solution');

  // Case D: Infinite Solutions (x + y = 2, 2x + 2y = 4)
  const caseD: LinearSystem = {
    dimension: '2x2',
    A: [
      [1, 1],
      [2, 2],
    ],
    B: [2, 4],
    variables: ['x', 'y'],
  };

  const solD = solveLinearSystem(caseD);
  assert(solD.type === 'infinite_solutions', 'Case D must detect Infinitely Many Solutions');

  // Case E: Fractional Solution (3x + 2y = 12, x - y = 1)
  const caseE: LinearSystem = {
    dimension: '2x2',
    A: [
      [3, 2],
      [1, -1],
    ],
    B: [12, 1],
    variables: ['x', 'y'],
  };

  const solE = solveLinearSystem(caseE);
  assert(solE.type === 'unique', 'Case E must be unique');
  assert(Math.abs(solE.solution![0] - 2.8) < 1e-4, 'Case E x = 2.8 (14/5)');
  assert(Math.abs(solE.solution![1] - 1.8) < 1e-4, 'Case E y = 1.8 (9/5)');

  // Test Fraction formatting
  assert(toFraction(2.8) === '14/5', '2.8 formatted as 14/5');
  assert(toFraction(1.8) === '9/5', '1.8 formatted as 9/5');
  assert(formatFractionOrDec(1 / 3) === '1/3', '1/3 formatted as fraction 1/3');

  // Case F: Higher-order (4x4) Unique Solution — enrichment topic, solved via
  // Gaussian Elimination since Cramer/Inverse are only implemented up to 3x3.
  const caseF: LinearSystem = {
    dimension: '4x4',
    A: [
      [2, 1, 1, 1],
      [1, 3, 1, 0],
      [0, 1, 4, 2],
      [1, 0, 1, 5],
    ],
    B: [11, 10, 22, 24],
    variables: ['x', 'y', 'z', 'w'],
  };
  const solF = solveLinearSystem(caseF);
  assert(solF.type === 'unique', 'Case F (4x4) must be unique solution');
  assert(solF.determinant === 77, 'Case F (4x4) det(A) must be 77');
  assert(
    [1, 2, 3, 4].every((v, i) => Math.abs(solF.solution![i] - v) < 1e-4),
    'Case F (4x4) solution must be x=1, y=2, z=3, w=4'
  );
  assert(
    !!solF.verifications && solF.verifications.every((v) => v.isValid),
    'Case F (4x4) solution must verify against all 4 original equations'
  );
  const gaussF = getGaussSteps(caseF);
  assert(gaussF.length > 0, 'Case F (4x4) Gaussian elimination must produce step-by-step output');

  // Case G: Higher-order (4x4) No Solution
  const caseG: LinearSystem = {
    dimension: '4x4',
    A: [
      [1, 1, 1, 1],
      [2, 2, 2, 2],
      [0, 1, 0, 1],
      [1, 0, 1, 0],
    ],
    B: [4, 9, 2, 2],
    variables: ['x', 'y', 'z', 'w'],
  };
  assert(solveLinearSystem(caseG).type === 'no_solution', 'Case G (4x4) must detect No Solution');

  // Case H: Higher-order (4x4) Infinite Solutions
  const caseH: LinearSystem = {
    dimension: '4x4',
    A: [
      [1, 1, 1, 1],
      [2, 2, 2, 2],
      [0, 1, 0, 1],
      [1, 0, 1, 0],
    ],
    B: [4, 8, 2, 2],
    variables: ['x', 'y', 'z', 'w'],
  };
  assert(solveLinearSystem(caseH).type === 'infinite_solutions', 'Case H (4x4) must detect Infinite Solutions');

  // Cases I-L: HigherOrderLab.tsx's actual preset constants — verified directly against
  // solveLinearSystem() so a mislabeled preset (CRITICAL BUG 2: "ตัวอย่างทั่วไป (คำตอบเดียว)"
  // actually had det(A) = 0 and produced "no solution") can't recur silently. Any future edit
  // to these presets that breaks their labeled solution type fails this test.
  const circuitSystem: LinearSystem = { dimension: '4x4', A: CIRCUIT_4LOOP.A, B: CIRCUIT_4LOOP.B, variables: ['x', 'y', 'z', 'w'] };
  const solCircuit = solveLinearSystem(circuitSystem);
  assert(solCircuit.type === 'unique', 'Preset "วงจรไฟฟ้า 4 ลูป" must be unique solution');
  assert(
    [10, 6, -3, 8].every((v, i) => Math.abs(solCircuit.solution![i] - v) < 1e-4),
    'Preset "วงจรไฟฟ้า 4 ลูป" solution must be [10, 6, -3, 8]'
  );

  const uniqueSystem: LinearSystem = { dimension: '4x4', A: UNIQUE_4X4.A, B: UNIQUE_4X4.B, variables: ['x', 'y', 'z', 'w'] };
  const solUnique = solveLinearSystem(uniqueSystem);
  assert(solUnique.type === 'unique', 'Preset "ตัวอย่างทั่วไป (คำตอบเดียว)" must be unique solution (CRITICAL BUG 2 regression guard)');
  assert(Math.abs(solUnique.determinant) > 1e-9, 'Preset "ตัวอย่างทั่วไป (คำตอบเดียว)" must have det(A) != 0');
  assert(
    [2, -1, 3, -2].every((v, i) => Math.abs(solUnique.solution![i] - v) < 1e-4),
    'Preset "ตัวอย่างทั่วไป (คำตอบเดียว)" solution must be [2, -1, 3, -2]'
  );

  const infiniteSystem: LinearSystem = { dimension: '4x4', A: INFINITE_4X4.A, B: INFINITE_4X4.B, variables: ['x', 'y', 'z', 'w'] };
  const solInfinite = solveLinearSystem(infiniteSystem);
  assert(solInfinite.type === 'infinite_solutions', 'Preset "ตัวอย่างคำตอบไม่จำกัด" must be infinite solutions');
  assert(solInfinite.zeroRowIndex !== undefined, 'Preset "ตัวอย่างคำตอบไม่จำกัด" must report a zeroRowIndex');

  const noSolutionSystem: LinearSystem = { dimension: '4x4', A: NO_SOLUTION_4X4.A, B: NO_SOLUTION_4X4.B, variables: ['x', 'y', 'z', 'w'] };
  const solNoSolution = solveLinearSystem(noSolutionSystem);
  assert(solNoSolution.type === 'no_solution', 'Preset "ตัวอย่างไม่มีคำตอบ" must be no solution');
  assert(solNoSolution.zeroRowIndex !== undefined, 'Preset "ตัวอย่างไม่มีคำตอบ" must report a zeroRowIndex');

  console.log('\n==================================================');
  console.log('       ALL MATHEMATICAL QA TESTS PASSED!          ');
  console.log('==================================================');
}

testAllCases();
