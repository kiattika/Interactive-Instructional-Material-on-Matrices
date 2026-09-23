import {
  Matrix,
  Vector,
  LinearSystem,
  SolutionSummary,
  InverseStep,
  CramerStep,
  GaussStep,
  RowOperation,
  VerificationResult,
  ExerciseQuestion,
} from '../types';

// Utility for rounding floating point errors (e.g. 1.0000000000000002 -> 1)
export function round(num: number, decimals: number = 6): number {
  if (Math.abs(num) < 1e-10) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

export type Rational = [number, number];

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

export function simplifyRational([num, den]: Rational): Rational {
  if (den === 0) return [num, 0];
  if (num === 0) return [0, 1];
  let g = gcd(num, den);
  let n = Math.round(num / g);
  let d = Math.round(den / g);
  if (d < 0) {
    n = -n;
    d = -d;
  }
  return [n, d];
}

export function numToRational(val: number | string): Rational {
  if (typeof val === 'string') {
    if (val.includes('/')) {
      const parts = val.split('/');
      const n = parseFloat(parts[0]);
      const d = parseFloat(parts[1]);
      if (!isNaN(n) && !isNaN(d) && d !== 0) {
        return simplifyRational([n, d]);
      }
    }
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return numToRational(parsed);
    return [0, 1];
  }
  if (Number.isInteger(val)) return [val, 1];
  const fracStr = toFraction(val);
  if (fracStr && fracStr.includes('/')) {
    const [n, d] = fracStr.split('/').map(Number);
    return simplifyRational([n, d]);
  }
  return simplifyRational([Math.round(val * 1000000), 1000000]);
}

// Strict numeric-or-fraction parser for raw user input (e.g. MatrixLab.tsx's manual-mode k-value
// field). Unlike numToRational() below — which is only ever fed already machine-formatted
// fraction cells (e.g. "209/56" from getGaussSteps()/computeRREF) and silently falls back to 0 on
// anything unparseable, because that path can never actually receive garbage — this returns null
// on failure so a caller can reject bad input outright instead of silently defaulting to a value
// the user never typed (the exact bug: `parseFloat(opK) || 1` turned an unparseable "1/2" into a
// silent no-op k=1). Supports plain numbers ("0.5", "-2") and simple "n/d" fractions ("1/2",
// "-1/2") — deliberately NOT parenthesized forms like "-(1/2)", which fail the token check below
// and are rejected rather than guessed at.
const NUMERIC_TOKEN = /^-?\d+(\.\d+)?$/;
export function parseNumericString(str: string): number | null {
  const trimmed = str.trim();
  if (!trimmed) return null;
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length !== 2) return null;
    const [nStr, dStr] = [parts[0].trim(), parts[1].trim()];
    if (!NUMERIC_TOKEN.test(nStr) || !NUMERIC_TOKEN.test(dStr)) return null;
    const d = parseFloat(dStr);
    if (d === 0) return null;
    return parseFloat(nStr) / d;
  }
  if (!NUMERIC_TOKEN.test(trimmed)) return null;
  return parseFloat(trimmed);
}

export function addRational(r1: Rational, r2: Rational): Rational {
  return simplifyRational([r1[0] * r2[1] + r2[0] * r1[1], r1[1] * r2[1]]);
}

export function subRational(r1: Rational, r2: Rational): Rational {
  return simplifyRational([r1[0] * r2[1] - r2[0] * r1[1], r1[1] * r2[1]]);
}

export function mulRational(r1: Rational, r2: Rational): Rational {
  return simplifyRational([r1[0] * r2[0], r1[1] * r2[1]]);
}

export function divRational(r1: Rational, r2: Rational): Rational {
  if (r2[0] === 0) throw new Error("Division by zero rational");
  return simplifyRational([r1[0] * r2[1], r1[1] * r2[0]]);
}

export function rationalToString(r: Rational): string {
  const [n, d] = simplifyRational(r);
  if (d === 1) return n.toString();
  return `${n}/${d}`;
}

export function rationalToLatex(r: Rational): string {
  const [n, d] = simplifyRational(r);
  if (d === 1) return n.toString();
  if (n < 0) return `-\\frac{${-n}}{${d}}`;
  return `\\frac{${n}}{${d}}`;
}

export function ratMatrixToFormatted(mat: Rational[][]): (string | number)[][] {
  return mat.map(row => row.map(r => {
    const [n, d] = simplifyRational(r);
    if (d === 1) return n;
    return `${n}/${d}`;
  }));
}

export function toFraction(val: number, maxDenominator: number = 100): string | null {
  if (Math.abs(val) < 1e-10) return '0';
  const rounded = round(val, 6);
  if (Number.isInteger(rounded)) return rounded.toString();
  
  const sign = val < 0 ? '-' : '';
  const absVal = Math.abs(val);

  for (let den = 1; den <= maxDenominator; den++) {
    const num = Math.round(absVal * den);
    if (Math.abs(absVal - num / den) < 1e-6) {
      return `${sign}${num}/${den}`;
    }
  }
  return null;
}

export function formatFractionOrDec(num: number, preferFraction: boolean = true): string {
  const rounded = round(num, 6);
  if (Math.abs(rounded) < 1e-10) return '0';
  if (Number.isInteger(rounded)) return rounded.toString();
  if (preferFraction) {
    const frac = toFraction(rounded);
    if (frac) return frac;
  }
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

// Minor: remove row `row` and column `col` from matrix A
function minorMatrix(A: Matrix, row: number, col: number): Matrix {
  return A.filter((_, i) => i !== row).map((r) => r.filter((_, j) => j !== col));
}

// Determinant calculation. 2x2/3x3 use the direct sarrus-style formulas taught
// in the สสวท. curriculum; n >= 4 (enrichment: "higher-order systems") falls back
// to generic cofactor (Laplace) expansion so the classification logic below
// (unique / no solution / infinite solutions) still works beyond 3x3.
export function det(A: Matrix): number {
  const n = A.length;
  if (n === 1) return round(A[0][0]);
  if (n === 2) {
    return round(A[0][0] * A[1][1] - A[0][1] * A[1][0]);
  }
  if (n === 3) {
    const d =
      A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
      A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
      A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
    return round(d);
  }
  // Generic cofactor expansion along the first row (n >= 4).
  // Not taught by name at ม.5 level; used only internally to classify the
  // solution type of higher-order systems solved via Gaussian elimination.
  let d = 0;
  for (let j = 0; j < n; j++) {
    if (A[0][j] === 0) continue;
    const sign = j % 2 === 0 ? 1 : -1;
    d += sign * A[0][j] * det(minorMatrix(A, 0, j));
  }
  return round(d);
}

// Matrix Multiplication A (m x n) * B (n x p)
export function multiplyMatrix(A: Matrix, B: Matrix): Matrix {
  const rowsA = A.length;
  const colsA = A[0].length;
  const colsB = B[0].length;
  const result: Matrix = Array.from({ length: rowsA }, () => Array(colsB).fill(0));

  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) {
        sum += A[i][k] * B[k][j];
      }
      result[i][j] = round(sum);
    }
  }
  return result;
}

// Matrix Vector Multiplication A (n x n) * b (n)
export function multiplyMatrixVector(A: Matrix, b: Vector): Vector {
  const n = A.length;
  const res: Vector = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += A[i][j] * b[j];
    }
    res[i] = round(sum);
  }
  return res;
}

// 2x2 Adjugate matrix
export function adjugate2x2(A: Matrix): Matrix {
  return [
    [A[1][1], -A[0][1]],
    [-A[1][0], A[0][0]],
  ];
}

// 3x3 Adjugate (Transposed Cofactor) Matrix
export function adjugate3x3(A: Matrix): Matrix {
  const cofactor: Matrix = Array.from({ length: 3 }, () => Array(3).fill(0));

  cofactor[0][0] = A[1][1] * A[2][2] - A[1][2] * A[2][1];
  cofactor[0][1] = -(A[1][0] * A[2][2] - A[1][2] * A[2][0]);
  cofactor[0][2] = A[1][0] * A[2][1] - A[1][1] * A[2][0];

  cofactor[1][0] = -(A[0][1] * A[2][2] - A[0][2] * A[2][1]);
  cofactor[1][1] = A[0][0] * A[2][2] - A[0][2] * A[2][0];
  cofactor[1][2] = -(A[0][0] * A[2][1] - A[0][1] * A[2][0]);

  cofactor[2][0] = A[0][1] * A[1][2] - A[0][2] * A[1][1];
  cofactor[2][1] = -(A[0][0] * A[1][2] - A[0][2] * A[1][0]);
  cofactor[2][2] = A[0][0] * A[1][1] - A[0][1] * A[1][0];

  // Transpose to get Adjugate
  const adj: Matrix = Array.from({ length: 3 }, () => Array(3).fill(0));
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      adj[i][j] = round(cofactor[j][i]);
    }
  }
  return adj;
}

// Inverse Matrix
export function inverseMatrix(A: Matrix): Matrix | null {
  const d = det(A);
  if (Math.abs(d) < 1e-10) return null;

  const n = A.length;
  const adj = n === 2 ? adjugate2x2(A) : adjugate3x3(A);
  return adj.map((row) => row.map((val) => round(val / d, 8)));
}

// Column Replacement for Cramer's Rule
export function replaceColumn(A: Matrix, b: Vector, colIndex: number): Matrix {
  const n = A.length;
  const copy: Matrix = A.map((row) => [...row]);
  for (let i = 0; i < n; i++) {
    copy[i][colIndex] = b[i];
  }
  return copy;
}

// Solution Type & RREF Analysis
export function solveLinearSystem(system: LinearSystem): SolutionSummary {
  const { A, B } = system;
  const d = det(A);

  if (Math.abs(d) > 1e-10) {
    const n = A.length;
    // Inverse/Cramer (adjugate-based) are only implemented for 2x2/3x3, matching
    // what's taught by name in the สสวท. curriculum. For higher-order systems
    // (n >= 4, the enrichment topic) the unique solution is still found exactly
    // via Gaussian elimination (RREF), which is why that method generalizes.
    let sol: Vector;
    if (n <= 3) {
      const inv = inverseMatrix(A);
      sol = inv ? multiplyMatrixVector(inv, B) : [];
    } else {
      const aug: Matrix = A.map((row, i) => [...row, B[i]]);
      const rref = computeRREF(aug);
      sol = rref.map((row) => {
        const v = row[n];
        return typeof v === 'number' ? round(v) : round(parseFloat(v));
      });
    }

    // Verifications
    const verifications = verifySolution(system, sol);

    return {
      type: 'unique',
      determinant: d,
      solution: sol,
      explanation: `det(A) = ${d} ≠ 0 ระบบสมการมีคำตอบเพียงชุดเดียว (Unique Solution)`,
      verifications,
    };
  }

  // If det(A) == 0, check augmented matrix rank
  // Create augmented matrix [A | B]
  const aug: Matrix = A.map((row, i) => [...row, B[i]]);
  const rrefMatrix = computeRREF(aug);

  // Check for a contradiction row [0, 0, ... | k] (k != 0, no_solution) or a free row
  // [0, 0, ... | 0] (0 = 0, infinite_solutions) — track the first row index of each kind so
  // callers can point the student at exactly where in the RREF to look.
  const n = A.length;
  let contradictionRow = -1;
  let freeRow = -1;

  for (let i = 0; i < n; i++) {
    const lhsZero = rrefMatrix[i].slice(0, n).every((val) => numToRational(val)[0] === 0);
    if (!lhsZero) continue;
    const rhsNonZero = numToRational(rrefMatrix[i][n])[0] !== 0;
    if (rhsNonZero) {
      if (contradictionRow === -1) contradictionRow = i;
    } else if (freeRow === -1) {
      freeRow = i;
    }
  }

  if (contradictionRow !== -1) {
    return {
      type: 'no_solution',
      determinant: 0,
      explanation: `det(A) = 0 และจากการคำนวณขั้นแถวย่อย เกิดข้อขัดแย้งที่แถว R${contradictionRow + 1} (เช่น 0 = k เมื่อ k ≠ 0) ทำให้ระบบสมการ "ไม่มีคำตอบ" (No Solution)`,
      zeroRowIndex: contradictionRow,
    };
  } else {
    return {
      type: 'infinite_solutions',
      determinant: 0,
      explanation: `det(A) = 0 และจากการคำนวณขั้นแถวย่อย พบแถว R${freeRow + 1} ที่กลายเป็น 0 = 0 ทั้งแถว ทำให้ระบบสมการมี "คำตอบไม่จำกัดจำนวน" (Infinitely Many Solutions)`,
      zeroRowIndex: freeRow,
    };
  }
}

// Compute Reduced Row Echelon Form (RREF)
export function computeRREF(M: (number | string)[][]): (number | string)[][] {
  const mat: Rational[][] = M.map((r) => r.map((val) => numToRational(val)));
  const rows = mat.length;
  const cols = mat[0].length;

  let lead = 0;
  for (let r = 0; r < rows; r++) {
    if (cols <= lead) break;
    let i = r;
    while (mat[i][lead][0] === 0) {
      i++;
      if (i === rows) {
        i = r;
        lead++;
        if (cols === lead) break;
      }
    }
    if (cols === lead) break;

    // Swap row i and r
    const temp = mat[i];
    mat[i] = mat[r];
    mat[r] = temp;

    // Scale row r to pivot 1
    const val = mat[r][lead];
    if (val[0] !== 0) {
      const invVal = simplifyRational([val[1], val[0]]);
      for (let j = 0; j < cols; j++) {
        mat[r][j] = mulRational(mat[r][j], invVal);
      }
    }

    // Eliminate column lead in other rows
    for (let k = 0; k < rows; k++) {
      if (k !== r) {
        const factor = mat[k][lead];
        if (factor[0] !== 0) {
          for (let j = 0; j < cols; j++) {
            mat[k][j] = subRational(mat[k][j], mulRational(factor, mat[r][j]));
          }
        }
      }
    }
    lead++;
  }
  return ratMatrixToFormatted(mat);
}

// Verify calculated solution by substituting into equations
export function verifySolution(system: LinearSystem, solution: Vector): VerificationResult[] {
  const { A, B, dimension } = system;
  const vars =
    dimension === '2x2' ? ['x', 'y'] : dimension === '3x3' ? ['x', 'y', 'z'] : ['x', 'y', 'z', 'w'];
  const results: VerificationResult[] = [];

  for (let i = 0; i < A.length; i++) {
    const row = A[i];
    const rhs = B[i];

    // Build equation string: 2x + y = 5
    const eqParts: string[] = [];
    const subParts: string[] = [];
    let calculatedLhs = 0;

    for (let j = 0; j < row.length; j++) {
      const coeff = row[j];
      const variable = vars[j];
      const solVal = solution[j];
      calculatedLhs += coeff * solVal;

      const sign = j > 0 && coeff >= 0 ? '+ ' : '';
      eqParts.push(`${sign}${coeff}${variable}`);

      const subSign = j > 0 && coeff * solVal >= 0 ? '+ ' : '';
      subParts.push(`${subSign}${coeff}(${formatFractionOrDec(solVal)})`);
    }

    const lhsVal = round(calculatedLhs);
    const isValid = Math.abs(lhsVal - rhs) < 1e-4;

    results.push({
      equationText: `${eqParts.join(' ')} = ${rhs}`,
      substitutedText: `${subParts.join(' ')} = ${lhsVal}`,
      lhsValue: lhsVal,
      rhsValue: rhs,
      isValid,
    });
  }

  return results;
}

// Calculate Inverse Method Step-by-Step details
export function getInverseSteps(system: LinearSystem): InverseStep {
  const { A, B, dimension } = system;
  const d = det(A);
  const hasInv = Math.abs(d) > 1e-10;

  if (!hasInv) {
    return {
      detA: d,
      hasInverse: false,
      steps: [
        {
          stepNumber: 1,
          title: 'เขียนสมการในรูป AX = B',
          description: `ระบุ เมทริกซ์สัมประสิทธิ์ A และเวกเตอร์คงที่ B`,
          matrixState: A,
          vectorState: B,
        },
        {
          stepNumber: 2,
          title: 'คำนวณ Determinant det(A)',
          description: `det(A) = ${d}`,
          formulaText: `det(A) = 0`,
        },
        {
          stepNumber: 3,
          title: 'สรุปผลการหาตัวผกผัน (Inverse)',
          description: `เนื่องจาก det(A) = 0 เมทริกซ์ A จึงไม่มีตัวผกผัน (A⁻¹ ไม่ดำรงอยู่) ไม่สามารถใช้วิธี Matrix Inverse Method ได้`,
        },
      ],
    };
  }

  const adj = dimension === '2x2' ? adjugate2x2(A) : adjugate3x3(A);
  const inv = inverseMatrix(A)!;
  const sol = multiplyMatrixVector(inv, B);

  const steps = [
    {
      stepNumber: 1,
      title: 'ขั้นที่ 1: เขียนระบบสมการในรูปเมทริกซ์ AX = B',
      description: `กำหนด A เป็นเมทริกซ์สัมประสิทธิ์ขนาด ${dimension}, X เป็นเวกเตอร์ตัวแปร และ B เป็นเวกเตอร์ค่าคงที่`,
      matrixState: A,
      vectorState: B,
    },
    {
      stepNumber: 2,
      title: 'ขั้นที่ 2: คำนวณหาค่า Determinant det(A)',
      description:
        dimension === '2x2'
          ? `det(A) = (${A[0][0]} × ${A[1][1]}) - (${A[0][1]} × ${A[1][0]}) = ${d}`
          : `det(A) = ${d} (ใช้วิธีคูณเฉียงหรือกระจายโคแฟกเตอร์)`,
      formulaText: `det(A) = ${d} ≠ 0`,
    },
    {
      stepNumber: 3,
      title: 'ขั้นที่ 3: คำนวณหา เมทริกซ์ผกผัน (Inverse Matrix A⁻¹)',
      description:
        dimension === '2x2'
          ? `A⁻¹ = (1 / det(A)) × adj(A) = (1 / ${d}) × [[${adj[0][0]}, ${adj[0][1]}], [${adj[1][0]}, ${adj[1][1]}]]`
          : `คำนวณ Cofactor Matrix, สลับเปลี่ยนได้ Adjugate Matrix แล้วหารด้วย det(A)`,
      matrixState: inv,
    },
    {
      stepNumber: 4,
      title: 'ขั้นที่ 4: คำนวณหาคำตอบจาก X = A⁻¹B',
      description: `คูณเมทริกซ์ A⁻¹ ด้วย เวกเตอร์ B เพื่อหาค่าของตัวแปร`,
      matrixState: inv,
      vectorState: B,
      formulaText: `X = A⁻¹B = [${sol.map((v) => formatFractionOrDec(v)).join(', ')}]ᵀ`,
    },
    {
      stepNumber: 5,
      title: 'ขั้นที่ 5: สรุปคำตอบของระบบสมการ',
      description:
        dimension === '2x2'
          ? `x = ${formatFractionOrDec(sol[0])}, y = ${formatFractionOrDec(sol[1])}`
          : `x = ${formatFractionOrDec(sol[0])}, y = ${formatFractionOrDec(sol[1])}, z = ${formatFractionOrDec(sol[2])}`,
    },
  ];

  return {
    detA: d,
    hasInverse: true,
    adjugateA: adj,
    inverseA: inv,
    solutionX: sol,
    steps,
  };
}

// Cramer's Rule Step-by-Step details
export function getCramerSteps(system: LinearSystem): CramerStep {
  const { A, B, dimension } = system;
  const d = det(A);

  const matDx = replaceColumn(A, B, 0);
  const detDx = det(matDx);

  const matDy = replaceColumn(A, B, 1);
  const detDy = det(matDy);

  if (dimension === '2x2') {
    const x = d !== 0 ? round(detDx / d) : undefined;
    const y = d !== 0 ? round(detDy / d) : undefined;

    return {
      matrixD: A,
      detD: d,
      matrixDx: matDx,
      detDx,
      matrixDy: matDy,
      detDy,
      x,
      y,
    };
  } else {
    const matDz = replaceColumn(A, B, 2);
    const detDz = det(matDz);

    const x = d !== 0 ? round(detDx / d) : undefined;
    const y = d !== 0 ? round(detDy / d) : undefined;
    const z = d !== 0 ? round(detDz / d) : undefined;

    return {
      matrixD: A,
      detD: d,
      matrixDx: matDx,
      detDx,
      matrixDy: matDy,
      detDy,
      matrixDz: matDz,
      detDz,
      x,
      y,
      z,
    };
  }
}

// Perform elementary row operation on augmented matrix [A | B]
export function applyRowOperation(
  augMatrix: (number | string)[][],
  op: RowOperation
): { newMatrix: (number | string)[][]; isValid: boolean; errorMessage?: string } {
  const M: Rational[][] = augMatrix.map((r) => r.map((val) => numToRational(val)));
  const rows = M.length;

  if (op.row1 < 0 || op.row1 >= rows) {
    return { newMatrix: augMatrix, isValid: false, errorMessage: 'หมายเลขแถวไม่ถูกต้อง' };
  }

  if (op.type === 'swap') {
    if (op.row2 === undefined || op.row2 < 0 || op.row2 >= rows || op.row1 === op.row2) {
      return { newMatrix: augMatrix, isValid: false, errorMessage: 'โปรดเลือก 2 แถวที่แตกต่างกันในการสลับ' };
    }
    const temp = M[op.row1];
    M[op.row1] = M[op.row2];
    M[op.row2] = temp;
  } else if (op.type === 'multiply') {
    if (op.k === undefined || Math.abs(op.k) < 1e-10) {
      return { newMatrix: augMatrix, isValid: false, errorMessage: 'ค่า k ต้องไม่เท่ากับ 0' };
    }
    const kRat = numToRational(op.k);
    for (let j = 0; j < M[0].length; j++) {
      M[op.row1][j] = mulRational(M[op.row1][j], kRat);
    }
  } else if (op.type === 'add') {
    if (op.row2 === undefined || op.row2 < 0 || op.row2 >= rows || op.row1 === op.row2) {
      return { newMatrix: augMatrix, isValid: false, errorMessage: 'แถวต้นทางและเป้าหมายต้องไม่ซ้ำกัน' };
    }
    const kRat = numToRational(op.k ?? 1);
    for (let j = 0; j < M[0].length; j++) {
      M[op.row1][j] = addRational(M[op.row1][j], mulRational(kRat, M[op.row2][j]));
    }
  }

  return { newMatrix: ratMatrixToFormatted(M), isValid: true };
}

// Automatic Gauss Elimination Simulator Steps
export function getGaussSteps(system: LinearSystem): GaussStep[] {
  const { A, B } = system;
  const steps: GaussStep[] = [];

  // Initial Augmented Matrix [A | B]
  let currentRat: Rational[][] = A.map((row, i) => [
    ...row.map((v) => numToRational(v)),
    numToRational(B[i]),
  ]);

  const rows = currentRat.length;
  let stepIdx = 2;

  steps.push({
    stepIndex: 1,
    augmentedMatrix: ratMatrixToFormatted(currentRat),
    operationPerformed: 'เริ่มสร้าง Augmented Matrix [A | B]',
    explanation: 'นำสัมประสิทธิ์ของสมการและค่าคงที่ด้านขวามาเขียนเรียงในเมทริกซ์แต่งเติม',
  });

  // Perform Gauss-Jordan to Identity using exact Rational calculations
  for (let i = 0; i < rows; i++) {
    // 1. Pivot check & Swap if needed
    if (currentRat[i][i][0] === 0) {
      let swapRow = -1;
      for (let k = i + 1; k < rows; k++) {
        if (currentRat[k][i][0] !== 0) {
          swapRow = k;
          break;
        }
      }
      if (swapRow !== -1) {
        const beforeMat = ratMatrixToFormatted(currentRat);
        const temp = currentRat[i];
        currentRat[i] = currentRat[swapRow];
        currentRat[swapRow] = temp;
        const afterMat = ratMatrixToFormatted(currentRat);

        steps.push({
          stepIndex: stepIdx++,
          beforeMatrix: beforeMat,
          augmentedMatrix: afterMat,
          operationPerformed: `R_{${i + 1}} \\leftrightarrow R_{${swapRow + 1}}`,
          explanation: `สลับแถว R${i + 1} และ R${swapRow + 1} เพื่อให้ Pivot หลักไม่เป็น 0`,
          highlightRows: [i, swapRow],
        });
      }
    }

    // 2. Scale pivot to 1
    const pivot = currentRat[i][i];
    if (pivot[0] !== 0 && !(pivot[0] === 1 && pivot[1] === 1)) {
      const invPivot = simplifyRational([pivot[1], pivot[0]]);
      const beforeMat = ratMatrixToFormatted(currentRat);

      currentRat[i] = currentRat[i].map((r) => mulRational(r, invPivot));
      const afterMat = ratMatrixToFormatted(currentRat);

      const multLatex = rationalToLatex(invPivot);
      const opText = `R_{${i + 1}} \\rightarrow ${multLatex} R_{${i + 1}}`;

      steps.push({
        stepIndex: stepIdx++,
        beforeMatrix: beforeMat,
        augmentedMatrix: afterMat,
        operationPerformed: opText,
        // multLatex is a raw LaTeX fragment (e.g. "\frac{1}{4}") embedded in otherwise-plain
        // Thai prose — must be $...$-wrapped so RenderTextWithMath's delimiter-based splitter
        // (used everywhere this explanation is rendered) recognizes it as math instead of
        // showing the literal backslash command as text.
        explanation: `คูณแถว R${i + 1} ด้วย $${multLatex}$ เพื่อปรับให้ Pivot กลายเป็น 1`,
        highlightRows: [i],
      });
    }

    // 3. Eliminate other rows in column i
    for (let r = 0; r < rows; r++) {
      if (r !== i) {
        const factor = currentRat[r][i];
        if (factor[0] !== 0) {
          const beforeMat = ratMatrixToFormatted(currentRat);

          currentRat[r] = currentRat[r].map((val, colIdx) =>
            subRational(val, mulRational(factor, currentRat[i][colIdx]))
          );
          const afterMat = ratMatrixToFormatted(currentRat);

          let opText = '';
          if (factor[0] > 0) {
            const fLatex = rationalToLatex(factor);
            const coeff = fLatex === '1' ? '' : fLatex;
            opText = `R_{${r + 1}} \\rightarrow R_{${r + 1}} - ${coeff} R_{${i + 1}}`;
          } else {
            const absFactor = simplifyRational([-factor[0], factor[1]]);
            const fLatex = rationalToLatex(absFactor);
            const coeff = fLatex === '1' ? '' : fLatex;
            opText = `R_{${r + 1}} \\rightarrow R_{${r + 1}} + ${coeff} R_{${i + 1}}`;
          }

          steps.push({
            stepIndex: stepIdx++,
            beforeMatrix: beforeMat,
            augmentedMatrix: afterMat,
            operationPerformed: opText,
            explanation: `กำจัดสมาชิกในแถว R${r + 1} หลักที่ ${i + 1} ให้กลายเป็น 0`,
            highlightRows: [r, i],
          });
        }
      }
    }
  }

  return steps;
}

// Generate mathematically verified random exercise questions
export function generateExercises(): ExerciseQuestion[] {
  return [
    {
      id: 'ex-1',
      difficulty: 'Easy',
      type: 'determinant',
      title: 'การหาค่า Determinant 2x2',
      instruction: 'จงหาค่า $\\det(A)$ ของเมทริกซ์ $A = \\begin{bmatrix} 2 & 1 \\\\ 1 & -1 \\end{bmatrix}$',
      system: {
        dimension: '2x2',
        A: [
          [2, 1],
          [1, -1],
        ],
        B: [5, 1],
        variables: ['x', 'y'],
      },
      options: ['$-3$', '$3$', '$-1$', '$1$'],
      correctAnswer: '$-3$',
      optionFeedback: {
        '$3$': 'สลับลำดับการลบ: $bc - ad = 1 - (-2) = 3$ — สูตรคือ $ad - bc$',
        '$-1$': 'บวก $bc$ แทนการลบ: $-2 + 1 = -1$ — สูตรคือ $ad - bc$',
        '$1$': 'นี่คือผลบวกเส้นทแยงมุมหลัก $2 + (-1) = 1$ ไม่ใช่ det — ต้องคูณเฉียงแล้วลบกัน $ad - bc$'
      },
      explanation: '$\\det(A) = (2 \\times -1) - (1 \\times 1) = -2 - 1 = -3$',
      hints: [
        'สูตร det ของเมทริกซ์ 2x2 คือ $ad - bc$',
        'สำหรับ $A = \\begin{bmatrix} 2 & 1 \\\\ 1 & -1 \\end{bmatrix}$ คูณเฉียงลง $(2 \\times -1)$ ลบด้วยคูณเฉียงขึ้น $(1 \\times 1)$',
        '$(-2) - (1) = -3$',
      ],
    },
    {
      id: 'ex-2',
      difficulty: 'Easy',
      type: 'representation',
      title: 'การแปลงระบบสมการเป็นรูปเมทริกซ์ AX = B',
      instruction: 'ระบบสมการ $2x + y = 5$ และ $x - y = 1$ เมทริกซ์สัมประสิทธิ์ $A$ คือข้อใด?',
      system: {
        dimension: '2x2',
        A: [
          [2, 1],
          [1, -1],
        ],
        B: [5, 1],
        variables: ['x', 'y'],
      },
      options: [
        '$A = \\begin{bmatrix} 2 & 1 \\\\ 1 & -1 \\end{bmatrix}$',
        '$A = \\begin{bmatrix} 2 & 5 \\\\ 1 & 1 \\end{bmatrix}$',
        '$A = \\begin{bmatrix} 1 & 2 \\\\ -1 & 1 \\end{bmatrix}$',
        '$A = \\begin{bmatrix} 5 & 1 \\\\ 2 & 1 \\end{bmatrix}$',
      ],
      correctAnswer: '$A = \\begin{bmatrix} 2 & 1 \\\\ 1 & -1 \\end{bmatrix}$',
      optionFeedback: {
        '$A = \\begin{bmatrix} 2 & 5 \\\\ 1 & 1 \\end{bmatrix}$': 'นำค่าคงที่ฝั่งขวา ($5, 1$) มาปนในเมทริกซ์ $A$ — ค่าคงที่ต้องอยู่ใน $B$',
        '$A = \\begin{bmatrix} 1 & 2 \\\\ -1 & 1 \\end{bmatrix}$': 'สลับตำแหน่งสมาชิก — แถวแรกต้องเป็นสัมประสิทธิ์ของ $x$ แล้วตามด้วย $y$ จากสมการแรก คือ $[2, 1]$',
        '$A = \\begin{bmatrix} 5 & 1 \\\\ 2 & 1 \\end{bmatrix}$': 'นำค่าคงที่ $5$ มาใส่แทนสัมประสิทธิ์ — $A$ มีเฉพาะตัวเลขหน้าตัวแปร'
      },
      explanation: 'แถวแรกคือสัมประสิทธิ์ของ $x$ และ $y$ ในสมการแรก $(2, 1)$ แถวสองคือ $(1, -1)$',
      hints: [
        'นำตัวเลขหน้าตัวแปร $x$ และ $y$ ในแต่ละสมการมาจัดเรียงตามแถว',
        'สมการ 1: $2x + 1y \\implies$ แถวที่ 1 คือ $[2, 1]$',
        'สมการ 2: $1x - 1y \\implies$ แถวที่ 2 คือ $[1, -1]$',
      ],
    },
    {
      id: 'ex-3',
      difficulty: 'Medium',
      type: 'cramer',
      title: "การแก้ระบบสมการด้วย Cramer's Rule",
      instruction: 'จากระบบสมการ $2x + y = 5$ และ $x - y = 1$ ค่าของ $\\det(D_x)$ คือข้อใด?',
      system: {
        dimension: '2x2',
        A: [
          [2, 1],
          [1, -1],
        ],
        B: [5, 1],
        variables: ['x', 'y'],
      },
      options: ['$-6$', '$-3$', '$6$', '$3$'],
      correctAnswer: '$-6$',
      optionFeedback: {
        '$-3$': 'นั่นคือ $\\det(A)$ — ต้องนำ $B$ ไปแทนคอลัมน์แรกของ $A$ ก่อนจึงจะเป็น $D_x$',
        '$6$': 'ผิดเครื่องหมาย: $(5)(-1) - (1)(1) = -5 - 1 = -6$',
        '$3$': 'ตรวจว่าใช้ $D_x = \\begin{bmatrix} 5 & 1 \\\\ 1 & -1 \\end{bmatrix}$ และเครื่องหมายถูกหรือยัง — $B$ ต้องแทนคอลัมน์แรก (คอลัมน์ของ $x$)'
      },
      explanation: '$D_x$ เกิดจากการแทนที่คอลัมน์แรกของ $A$ ด้วย $B$ คือ $D_x = \\begin{bmatrix} 5 & 1 \\\\ 1 & -1 \\end{bmatrix}$ ดังนั้น $\\det(D_x) = (5 \\times -1) - (1 \\times 1) = -6$',
      hints: [
        '$D_x$ คือเมทริกซ์ที่นำ $B = \\begin{bmatrix} 5 \\\\ 1 \\end{bmatrix}$ มาแทนในคอลัมน์แรกของ $A$',
        '$D_x = \\begin{bmatrix} 5 & 1 \\\\ 1 & -1 \\end{bmatrix}$',
        '$\\det(D_x) = (5) \\times (-1) - (1) \\times (1) = -5 - 1 = -6$',
      ],
    },
    {
      id: 'ex-4',
      difficulty: 'Medium',
      type: 'solve_system',
      title: 'การแก้ระบบสมการ 2x2 ในรูปเศษส่วน',
      instruction: 'คำตอบ $(x, y)$ ของระบบสมการ $3x + 2y = 12$ และ $x - y = 1$ ในรูปเศษส่วนอย่างต่ำคือข้อใด?',
      system: {
        dimension: '2x2',
        A: [
          [3, 2],
          [1, -1],
        ],
        B: [12, 1],
        variables: ['x', 'y'],
      },
      options: [
        '$x = \\frac{14}{5}, y = \\frac{9}{5}$',
        '$x = 2, y = 3$',
        '$x = \\frac{12}{5}, y = \\frac{7}{5}$',
        '$x = 4, y = 0$',
      ],
      correctAnswer: '$x = \\frac{14}{5}, y = \\frac{9}{5}$',
      optionFeedback: {
        '$x = 2, y = 3$': 'แทนกลับ: $3(2) + 2(3) = 12$ เป็นจริง แต่ $2 - 3 = -1 \\neq 1$ — คำตอบต้องเป็นจริงทั้งสองสมการ',
        '$x = \\frac{12}{5}, y = \\frac{7}{5}$': 'เป็นจริงแค่สมการที่ 2 แต่สมการแรกได้ $3(\\frac{12}{5}) + 2(\\frac{7}{5}) = 10 \\neq 12$',
        '$x = 4, y = 0$': '$3(4) + 2(0) = 12$ เป็นจริง แต่ $4 - 0 = 4 \\neq 1$'
      },
      explanation: '$\\det(A) = -5, \\det(D_x) = -14 \\implies x = \\frac{-14}{-5} = \\frac{14}{5}$; $\\det(D_y) = -9 \\implies y = \\frac{-9}{-5} = \\frac{9}{5}$',
      hints: [
        'คำนวณ $\\det(A) = (3 \\times -1) - (2 \\times 1) = -5$',
        'คำนวณ $\\det(D_x) = (12 \\times -1) - (2 \\times 1) = -14 \\implies x = \\frac{14}{5}$',
        'คำนวณ $\\det(D_y) = (3 \\times 1) - (12 \\times 1) = -9 \\implies y = \\frac{9}{5}$',
      ],
    },
    {
      id: 'ex-5',
      difficulty: 'Hard',
      type: 'solution_type',
      title: 'วิเคราะห์ชนิดของคำตอบระบบสมการ',
      instruction: 'ระบบสมการ $x + y = 2$ และ $2x + 2y = 5$ มีลักษณะคำตอบเป็นอย่างไร?',
      system: {
        dimension: '2x2',
        A: [
          [1, 1],
          [2, 2],
        ],
        B: [2, 5],
        variables: ['x', 'y'],
      },
      options: [
        'มีคำตอบเดียว (Unique Solution)',
        'ไม่มีคำตอบ (No Solution)',
        'มีคำตอบไม่จำกัดจำนวน (Infinitely Many Solutions)',
        'ไม่สามารถสรุปได้',
      ],
      correctAnswer: 'ไม่มีคำตอบ (No Solution)',
      optionFeedback: {
        'มีคำตอบเดียว (Unique Solution)': '$\\det(A) = 1(2) - 1(2) = 0$ จึงไม่มีทางมีคำตอบเดียว',
        'มีคำตอบไม่จำกัดจำนวน (Infinitely Many Solutions)': 'ถ้ามีคำตอบนับไม่ถ้วน ฝั่งขวาต้องเป็นสัดส่วนเดียวกันด้วย ($2 \\times 2 = 4$) แต่ที่นี่เป็น $5$',
        'ไม่สามารถสรุปได้': 'สรุปได้ — เมื่อ $\\det(A) = 0$ ให้ตรวจความสอดคล้องต่อ ซึ่งพบข้อขัดแย้ง $4 = 5$'
      },
      explanation: '$\\det(A) = 0$ และเมื่อนำมาคำนวณ $2(x+y) = 4$ แต่สมการที่สองให้ $2x+2y = 5$ ซึ่งเกิดข้อขัดแย้ง $4 = 5$ ทำให้ระบบสมการไม่มีคำตอบ',
      hints: [
        'คำนวณ $\\det(A) = 1(2) - 1(2) = 0$',
        'สังเกตสัมประสิทธิ์ สมการที่ 2 เป็น 2 เท่าของสมการแรกฝั่งซ้าย แต่ฝั่งขวา $2(2) = 4 \\neq 5$',
        'ข้อเท็จจริงขัดแย้งกันอย่างสิ้นเชิง แสดงว่าไม่มีจุดตัด หรือ "ไม่มีคำตอบ"',
      ],
    },
  ];
}
