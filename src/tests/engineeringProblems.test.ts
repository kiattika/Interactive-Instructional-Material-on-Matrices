import { ENGINEERING_ICT_PROBLEMS } from '../lib/engineeringProblems';
import { solveLinearSystem, det } from '../lib/matrixEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

console.log('='.repeat(50));
console.log('  QA: ENGINEERING & ICT APPLIED PROBLEM BANK');
console.log('='.repeat(50));

for (const problem of ENGINEERING_ICT_PROBLEMS) {
  const { system } = problem;
  const d = det(system.A);
  assert(Math.abs(d) > 1e-9, `[${problem.id}] must be well-posed (det ≠ 0), got ${d}`);

  const summary = solveLinearSystem(system);
  assert(summary.type === 'unique', `[${problem.id}] must yield a unique solution`);
  assert(
    !!summary.verifications && summary.verifications.every((v) => v.isValid),
    `[${problem.id}] solution must satisfy every original equation when substituted back`
  );
  assert(
    system.variables.length === system.A.length,
    `[${problem.id}] variable name count must match system size`
  );
}

console.log('='.repeat(50));
console.log('  ALL ENGINEERING/ICT PROBLEMS VERIFIED!');
console.log('='.repeat(50));
