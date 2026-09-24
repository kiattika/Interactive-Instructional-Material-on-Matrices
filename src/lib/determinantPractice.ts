// Pure logic behind Matrix Lab's interactive "student computes it" steps for the Inverse and
// Cramer tabs (components/lab/*). Breaks a determinant into the individual diagonal products a
// student writes by hand (2x2: ad and bc; 3x3: Sarrus's 3 forward + 3 backward diagonals), and
// the 3x3 adjugate into its 9 minors -> cofactor signs -> transpose — a breakdown the engine's
// det()/adjugate3x3() compute in one shot. Tested against those functions in
// src/tests/determinantPractice.test.ts, so the two can never disagree.
import { round, parseNumericString, minorMatrix } from './matrixEngine';

export type Cell = [row: number, col: number];

export interface DiagonalTerm {
  // Cells in the (extended, for 3x3) matrix display; col may be >= n for Sarrus's repeated columns.
  cells: Cell[];
  factors: number[];
  product: number;
}

export interface DeterminantBreakdown {
  size: 2 | 3;
  forward: DiagonalTerm[]; // top-left -> bottom-right, added
  backward: DiagonalTerm[]; // top-right -> bottom-left, subtracted
  forwardSum: number;
  backwardSum: number;
  det: number;
}

function term(M: number[][], cells: Cell[]): DiagonalTerm {
  const n = M.length;
  const factors = cells.map(([r, c]) => M[r][c % n]);
  return { cells, factors, product: termProduct(factors) };
}

/** 2x2: ad (forward) and bc (backward). 3x3: Sarrus's rule on the matrix extended with its first two columns. */
export function determinantBreakdown(M: number[][]): DeterminantBreakdown {
  const size = M.length;
  if (size !== 2 && size !== 3) throw new Error('determinantBreakdown supports 2x2 and 3x3 only');
  const forward =
    size === 2
      ? [term(M, [[0, 0], [1, 1]])]
      : [0, 1, 2].map((j) => term(M, [[0, j], [1, j + 1], [2, j + 2]]));
  const backward =
    size === 2
      ? [term(M, [[0, 1], [1, 0]])]
      : [0, 1, 2].map((j) => term(M, [[0, j + 2], [1, j + 1], [2, j]]));
  const forwardSum = round(forward.reduce((a, t) => a + t.product, 0), 10);
  const backwardSum = round(backward.reduce((a, t) => a + t.product, 0), 10);
  return { size, forward, backward, forwardSum, backwardSum, det: round(forwardSum - backwardSum, 10) };
}

/**
 * Product of a term's factors, rounded only at 10 decimals (float-noise cleanup). Deliberately NOT
 * the engine's 6-decimal default: with fractional factors such as A⁻¹'s 1/3, rounding to 6 places
 * turned (1/3)·5 into 1.666667 and rejected a student's exact answer "5/3".
 */
export function termProduct(factors: number[]): number {
  return round(factors.reduce((a, v) => a * v, 1), 10);
}

/** Parses a typed answer (integer, decimal or a/b fraction) and compares it to the expected value. */
export function isAnswerCorrect(input: string, expected: number): boolean {
  const value = parseNumericString(input);
  if (value === null) return false;
  return Math.abs(value - expected) < 1e-9 * Math.max(1, Math.abs(expected));
}

/**
 * Targeted feedback for a wrong final determinant — the two most common slips — or null for a
 * generic "try again". Mirrors the Socratic "why is this wrong" style of the practice questions.
 */
export function detMistakeHint(input: string, b: DeterminantBreakdown): string | null {
  const value = parseNumericString(input);
  if (value === null) return 'กรุณากรอกตัวเลขหรือเศษส่วน เช่น -3 หรือ 1/2';
  const near = (x: number) => Math.abs(value - x) < 1e-9 * Math.max(1, Math.abs(x));
  if (near(b.forwardSum + b.backwardSum)) return 'ดูเหมือนนำผลคูณสองกลุ่มมาบวกกัน — det ต้องเป็น (ผลรวมเฉียงลง) ลบ (ผลรวมเฉียงขึ้น)';
  if (near(b.backwardSum - b.forwardSum)) return 'ลบกลับด้าน — ต้องเป็น (ผลรวมเฉียงลง) − (ผลรวมเฉียงขึ้น) ไม่ใช่กลับกัน';
  return null;
}

/** +1 / -1 checkerboard sign for cofactor (i, j). */
export function cofactorSign(i: number, j: number): 1 | -1 {
  return (i + j) % 2 === 0 ? 1 : -1;
}

export { minorMatrix };

/**
 * Checks a student's transpose of the cofactor matrix: output cell [i][j] must equal cof[j][i].
 * `untransposed` flags the classic slip — a wrong cell that holds cof[i][j] instead (copied the
 * cofactor matrix without swapping rows and columns).
 */
export function checkTransposeCells(inputs: string[][], cof: number[][]): { results: boolean[][]; untransposed: boolean } {
  const results = inputs.map((row, i) => row.map((v, j) => isAnswerCorrect(v, cof[j][i])));
  const untransposed = inputs.some((row, i) => row.some((v, j) => !results[i][j] && isAnswerCorrect(v, cof[i][j])));
  return { results, untransposed };
}

/** Builds cofactor matrix and adjugate (its transpose) from the 9 minor determinants. */
export function adjugateFromMinors(minors: number[][]): { cofactors: number[][]; adjugate: number[][] } {
  const cofactors = minors.map((row, i) => row.map((m, j) => round(cofactorSign(i, j) * m)));
  const adjugate = cofactors.map((_, i) => cofactors.map((row) => row[i]));
  return { cofactors, adjugate };
}
