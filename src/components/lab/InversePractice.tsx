import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { MathView, MatrixDisplay } from '../math/MathComponents';
import { adjugate2x2, formatFractionOrDec } from '../../lib/matrixEngine';
import { adjugateFromMinors, checkTransposeCells, cofactorSign, isAnswerCorrect, minorMatrix } from '../../lib/determinantPractice';
import { InteractiveDeterminant } from './InteractiveDeterminant';
import { InteractiveTerms } from './InteractiveTerms';

interface InversePracticeProps {
  A: number[][];
  B: number[];
  onComplete: () => void; // fired once, when the student has computed X
}

const fmt = (v: number) => formatFractionOrDec(v);
const paren = (v: number) => (v < 0 ? `(${fmt(v)})` : fmt(v));
const STEP_TITLE = 'font-bold text-slate-800 text-xs';
const VARIABLES = ['x', 'y', 'z'];
const OK_BOX = 'p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg font-bold text-emerald-800';
const ERR_BOX = 'p-2.5 rounded-lg font-bold bg-rose-50 text-rose-800 border border-rose-200';
const CHECK_BTN =
  'px-4 py-1.5 min-h-11 sm:min-h-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-2xs transition-colors';
const cellInputClass = (ok: boolean | null) =>
  `w-16 p-1.5 min-h-11 sm:min-h-0 border rounded-lg text-base sm:text-xs font-bold text-center disabled:bg-slate-50 ${
    ok === true ? 'border-emerald-400 text-emerald-700' : ok === false ? 'border-rose-400 text-rose-700' : 'border-slate-200'
  }`;

// Grid of fill-in cells shared by the 2x2 adj(A) step and the 3x3 transpose step.
const CellGrid: React.FC<{
  size: number;
  values: string[][];
  checked: (boolean | null)[][];
  ariaPrefix: string;
  onChange: (i: number, j: number, v: string) => void;
}> = ({ size, values, checked, ariaPrefix, onChange }) => (
  <div className="grid gap-1.5 p-1.5 border-x-2 border-slate-400 rounded-md" style={{ gridTemplateColumns: `repeat(${size}, auto)` }}>
    {values.map((row, i) =>
      row.map((v, j) => (
        <input
          key={`${i}-${j}`}
          value={v}
          onChange={(e) => onChange(i, j, e.target.value)}
          disabled={checked[i][j] === true}
          inputMode="decimal"
          aria-label={`${ariaPrefix} แถว ${i + 1} คอลัมน์ ${j + 1}`}
          className={cellInputClass(checked[i][j])}
        />
      ))
    )}
  </div>
);

const emptyGrid = (n: number) => Array.from({ length: n }, () => Array.from({ length: n }, () => ''));
const nullGrid = (n: number) => Array.from({ length: n }, () => Array.from({ length: n }, () => null as boolean | null));
const setCell = <T,>(grid: T[][], i: number, j: number, v: T) => grid.map((r, ri) => r.map((c, cj) => (ri === i && cj === j ? v : c)));

// Matrix Lab › Inverse › "ทำด้วยตนเอง": the student computes every step up to X themselves.
//   1. det(A) — shared determinant component. det(A) = 0 → conclusion, no completion (no X exists).
//   2. adj(A):  2x2 — fill in all 4 cells.
//               3x3 — the 9 minors (same determinant component, row i / column j crossed out);
//                     cofactor signs applied automatically; then the student fills in the transpose.
//   3. A⁻¹ = adj(A) ÷ det(A) — shown (arithmetic on already-earned values).
//   4. X = A⁻¹B — each row entered as its products A⁻¹[i][j]·B[j] and their sum (InteractiveTerms,
//      the same interaction as the determinant). Completion fires only here, once X is reached.
// Remount (new key) when the system changes.
export const InversePractice: React.FC<InversePracticeProps> = ({ A, B, onComplete }) => {
  const n = A.length;
  const [detA, setDetA] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);

  // 2x2: adj(A) fill-in
  const expectedAdj2 = useMemo(() => (n === 2 ? adjugate2x2(A) : null), [A, n]);
  const [adjInputs, setAdjInputs] = useState<string[][]>(() => emptyGrid(2));
  const [adjChecked, setAdjChecked] = useState<(boolean | null)[][]>(() => nullGrid(2));
  const [adjFeedback, setAdjFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);

  // 3x3: minors (one at a time), then the transpose fill-in
  const [minors, setMinors] = useState<(number | null)[][]>(() => [0, 1, 2].map(() => [null, null, null]));
  const minorOrder = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => [i, j] as [number, number]));
  const nextMinor = minorOrder.find(([i, j]) => minors[i][j] === null) || null;
  const allMinorsDone = n === 3 && nextMinor === null;
  const cofactors = useMemo(() => (allMinorsDone ? adjugateFromMinors(minors as number[][]).cofactors : null), [allMinorsDone, minors]);
  const [tInputs, setTInputs] = useState<string[][]>(() => emptyGrid(3));
  const [tChecked, setTChecked] = useState<(boolean | null)[][]>(() => nullGrid(3));
  const [tFeedback, setTFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);

  // The adjugate, once the student has produced it correctly
  const adjugate: number[][] | null = useMemo(() => {
    if (n === 2) return adjChecked.every((r) => r.every((c) => c === true)) ? expectedAdj2 : null;
    return cofactors && tChecked.every((r) => r.every((c) => c === true)) ? adjugateFromMinors(minors as number[][]).adjugate : null;
  }, [n, adjChecked, expectedAdj2, cofactors, tChecked, minors]);
  // Full precision (no rounding): the X = A⁻¹B step checks the student's products against these,
  // so e.g. 1/3 must stay 1/3 for an exact typed answer like 5/3 to be accepted.
  const inverse = adjugate && detA ? adjugate.map((r) => r.map((v) => v / detA)) : null;

  // X rows, one at a time
  const [xValues, setXValues] = useState<(number | null)[]>(() => Array.from({ length: n }, () => null));
  const nextRow = xValues.findIndex((v) => v === null);
  const xDone = inverse !== null && nextRow === -1;

  useEffect(() => {
    if (xDone && !completed) {
      setCompleted(true);
      onComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xDone]);

  const handleCheckAdj2 = () => {
    const results = expectedAdj2!.map((row, i) => row.map((v, j) => isAnswerCorrect(adjInputs[i][j], v)));
    setAdjChecked(results);
    setAdjFeedback(
      results.every((r) => r.every(Boolean))
        ? { isCorrect: true, message: '✓ คำนวณถูกต้อง! adj(A) ครบทั้ง 4 ช่อง' }
        : {
            isCorrect: false,
            message: 'ยังมีช่องที่ไม่ถูกต้อง (สีแดง) — จำหลัก: สลับตำแหน่งเส้นทแยงมุมหลัก (a ↔ d) และเปลี่ยนเครื่องหมายเส้นทแยงมุมรอง (−b, −c)'
          }
    );
  };

  const handleCheckTranspose = () => {
    const { results, untransposed } = checkTransposeCells(tInputs, cofactors!);
    setTChecked(results);
    setTFeedback(
      results.every((r) => r.every(Boolean))
        ? { isCorrect: true, message: '✓ คำนวณถูกต้อง! ได้ adj(A) = Cof(A)ᵀ ครบทั้ง 9 ช่อง' }
        : {
            isCorrect: false,
            message: untransposed
              ? 'ดูเหมือนคัดลอก Cof(A) มาโดยยังไม่สลับ — ตำแหน่งแถว i คอลัมน์ j ของ adj(A) ต้องมาจากแถว j คอลัมน์ i ของ Cof(A) (แถวกลายเป็นคอลัมน์)'
              : 'ยังมีช่องที่ไม่ถูกต้อง (สีแดง) — Transpose คือนำแถวที่ 1, 2, 3 ของ Cof(A) ไปเขียนเป็นคอลัมน์ที่ 1, 2, 3'
          }
    );
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Step 1: det(A) */}
      <div className="space-y-2">
        <p className={STEP_TITLE}>ขั้นที่ 1: หาค่า det(A) เพื่อตรวจว่า A มีตัวผกผันหรือไม่</p>
        <InteractiveDeterminant matrix={A} label="\det(A)" onComplete={setDetA} />
      </div>

      {detA === 0 && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl font-bold text-rose-800">
          det(A) = 0 → เมทริกซ์ A ไม่มีตัวผกผัน จึงหา X = A⁻¹B ไม่ได้ (ลองวิเคราะห์ด้วย Gauss Elimination แทน — หรือเลือกโจทย์ที่ det(A) ≠ 0
          เพื่อฝึกวิธี Inverse จนได้คำตอบ)
        </div>
      )}

      {/* Step 2 (2x2): fill in adj(A) */}
      {detA !== null && detA !== 0 && n === 2 && (
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3">
          <p className={STEP_TITLE}>ขั้นที่ 2: เติม adj(A) ให้ครบทั้ง 4 ช่อง</p>
          <MathView
            latex={`A = \\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix} = \\begin{bmatrix} ${fmt(A[0][0])} & ${fmt(A[0][1])} \\\\ ${fmt(A[1][0])} & ${fmt(A[1][1])} \\end{bmatrix} \\implies \\operatorname{adj}(A) = \\begin{bmatrix} d & -b \\\\ -c & a \\end{bmatrix}`}
          />
          <div className="flex items-center gap-2">
            <MathView latex="\operatorname{adj}(A) =" />
            <CellGrid
              size={2}
              values={adjInputs}
              checked={adjChecked}
              ariaPrefix="adj(A)"
              onChange={(i, j, v) => {
                setAdjInputs((prev) => setCell(prev, i, j, v));
                setAdjChecked((prev) => setCell(prev, i, j, null));
              }}
            />
          </div>
          {adjugate === null && (
            <button onClick={handleCheckAdj2} disabled={adjInputs.some((r) => r.some((v) => !v.trim()))} className={CHECK_BTN}>
              ตรวจคำตอบ
            </button>
          )}
          {adjFeedback && <div className={adjFeedback.isCorrect ? OK_BOX : ERR_BOX}>{adjFeedback.message}</div>}
        </div>
      )}

      {/* Step 2 (3x3): the 9 minors, each computed with the shared determinant component */}
      {detA !== null && detA !== 0 && n === 3 && (
        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3">
          <p className={STEP_TITLE}>ขั้นที่ 2: หาไมเนอร์ (Minor) ทั้ง 9 ตัว — ตัดแถว i และคอลัมน์ j ออก แล้วหา det ของเมทริกซ์ 2×2 ที่เหลือ</p>
          <div className="flex flex-wrap items-start gap-4">
            <div>
              <p className="text-[11px] text-slate-500 mb-1">ความคืบหน้า (ไมเนอร์ที่หาได้แล้ว)</p>
              <div className="grid grid-cols-3 gap-1">
                {minorOrder.map(([i, j]) => {
                  const v = minors[i][j];
                  const isNext = nextMinor && nextMinor[0] === i && nextMinor[1] === j;
                  return (
                    <div
                      key={`${i}${j}`}
                      className={`w-12 h-9 flex items-center justify-center rounded-md border font-bold ${
                        v !== null ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : isNext ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
                      }`}
                    >
                      {v !== null ? fmt(v) : <MathView latex={`M_{${i + 1}${j + 1}}`} />}
                    </div>
                  );
                })}
              </div>
            </div>
            {nextMinor && (
              <div>
                <p className="text-[11px] text-slate-500 mb-1">
                  <MathView latex={`M_{${nextMinor[0] + 1}${nextMinor[1] + 1}}`} />: ตัดแถวที่ {nextMinor[0] + 1} และคอลัมน์ที่ {nextMinor[1] + 1}
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {A.map((row, i) =>
                    row.map((v, j) => {
                      const crossed = i === nextMinor[0] || j === nextMinor[1];
                      return (
                        <div
                          key={`${i}-${j}`}
                          className={`w-9 h-9 flex items-center justify-center rounded-md border font-bold ${
                            crossed ? 'bg-rose-50 border-rose-200 text-rose-300 line-through' : 'bg-white border-indigo-300 text-indigo-800'
                          }`}
                        >
                          {fmt(v)}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          {nextMinor && (
            <InteractiveDeterminant
              key={`${nextMinor[0]}${nextMinor[1]}`}
              matrix={minorMatrix(A, nextMinor[0], nextMinor[1])}
              label={`M_{${nextMinor[0] + 1}${nextMinor[1] + 1}}`}
              onComplete={(d) => setMinors((prev) => setCell(prev, nextMinor[0], nextMinor[1], d))}
            />
          )}

          {cofactors && (
            <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-200">
              <p className="font-bold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> ✓ คำนวณไมเนอร์ครบทั้ง 9 ตัวแล้ว!
              </p>
              <p className={STEP_TITLE}>ขั้นที่ 3: ใส่เครื่องหมายตามรูปแบบกระดานหมากรุก (แสดงให้อัตโนมัติ)</p>
              <div className="flex flex-wrap items-center gap-3">
                <MathView latex={`\\begin{bmatrix} + & - & + \\\\ - & + & - \\\\ + & - & + \\end{bmatrix}`} />
                <MathView latex={`\\operatorname{Cof}(A) = \\begin{bmatrix} ${cofactors.map((r) => r.map(fmt).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`} />
              </div>
              <p className="text-[11px] text-slate-500">
                เครื่องหมายของ <MathView latex="C_{ij} = (-1)^{i+j} M_{ij}" /> เช่น{' '}
                <MathView latex={`C_{12} = ${cofactorSign(0, 1) < 0 ? '-' : '+'}M_{12} = ${fmt(cofactors[0][1])}`} />
              </p>

              <p className={STEP_TITLE}>ขั้นที่ 4: Transpose — เติม adj(A) = Cof(A)ᵀ ให้ครบทั้ง 9 ช่อง (แถวของ Cof(A) กลายเป็นคอลัมน์)</p>
              <div className="flex items-center gap-2">
                <MathView latex="\operatorname{adj}(A) =" />
                <CellGrid
                  size={3}
                  values={tInputs}
                  checked={tChecked}
                  ariaPrefix="adj(A) = Cof(A)ᵀ"
                  onChange={(i, j, v) => {
                    setTInputs((prev) => setCell(prev, i, j, v));
                    setTChecked((prev) => setCell(prev, i, j, null));
                  }}
                />
              </div>
              {adjugate === null && (
                <button onClick={handleCheckTranspose} disabled={tInputs.some((r) => r.some((v) => !v.trim()))} className={CHECK_BTN}>
                  ตรวจคำตอบ
                </button>
              )}
              {tFeedback && <div className={tFeedback.isCorrect ? OK_BOX : ERR_BOX}>{tFeedback.message}</div>}
            </div>
          )}
        </div>
      )}

      {/* A⁻¹ (shown) and X = A⁻¹B (interactive, row by row) */}
      {inverse && detA && (
        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3">
          <p className={STEP_TITLE}>ขั้นที่ {n === 2 ? 3 : 5}: หา A⁻¹ = adj(A) ÷ det(A) (คำนวณให้จากค่าที่หาได้แล้ว)</p>
          <div className="flex flex-wrap items-center gap-3 overflow-x-auto">
            <MathView latex={`A^{-1} = \\frac{1}{${fmt(detA)}}\\operatorname{adj}(A)`} />
            <MatrixDisplay matrix={inverse} symbol="A^{-1}" />
          </div>

          <p className={STEP_TITLE}>
            ขั้นที่ {n === 2 ? 4 : 6}: หา X = A⁻¹B ทีละแถว — คูณสมาชิกแถวของ A⁻¹ กับสมาชิกของ B ทีละคู่ แล้วบวกกัน
          </p>
          <p className="text-[11px] text-slate-500">กรอกเป็นเศษส่วนได้ เช่น 5/3 หรือ -1/2 (ทศนิยมที่ปัดเศษ เช่น 1.67 ยังไม่นับว่าถูกต้อง)</p>
          {inverse.slice(0, nextRow === -1 ? n : nextRow + 1).map((row, i) => (
            <InteractiveTerms
              key={i}
              label={VARIABLES[i]}
              title={
                <>
                  แถวที่ {i + 1}: หาค่า <MathView latex={VARIABLES[i]} />
                </>
              }
              visual={
                <MathView
                  latex={`\\begin{bmatrix} ${row.map(fmt).join(' & ')} \\end{bmatrix} \\begin{bmatrix} ${B.map(fmt).join(' \\\\ ')} \\end{bmatrix}`}
                />
              }
              terms={row.map((a, j) => ({
                factors: [a, B[j]],
                sign: 1 as const,
                tag: `คู่ที่ ${j + 1}`,
                tagClass: 'text-indigo-700',
                ariaLabel: `ผลคูณแถว ${i + 1} คู่ที่ ${j + 1}: ${paren(a)} × ${paren(B[j])}`
              }))}
              productsOkMessage="✓ คำนวณผลคูณถูกต้อง! ต่อไปนำผลคูณทั้งหมดมาบวกกัน"
              finalWrongMessage="ยังไม่ถูกต้อง — ลองบวกผลคูณทั้งหมดอีกครั้ง ระวังการบวกจำนวนลบและเศษส่วน"
              onComplete={(v) => setXValues((prev) => prev.map((x, k) => (k === i ? v : x)))}
            />
          ))}

          {xDone && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
              <p className="font-bold text-emerald-800">✓ ได้คำตอบของระบบสมการแล้ว!</p>
              <MathView latex={`X = A^{-1}B = \\begin{bmatrix} ${(xValues as number[]).map(fmt).join(' \\\\ ')} \\end{bmatrix}`} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
