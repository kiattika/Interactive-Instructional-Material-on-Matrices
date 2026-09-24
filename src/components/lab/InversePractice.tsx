import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { MathView, MatrixDisplay } from '../math/MathComponents';
import { adjugate2x2, formatFractionOrDec, multiplyMatrixVector, round } from '../../lib/matrixEngine';
import { adjugateFromMinors, cofactorSign, isAnswerCorrect, minorMatrix } from '../../lib/determinantPractice';
import { InteractiveDeterminant } from './InteractiveDeterminant';

interface InversePracticeProps {
  A: number[][];
  B: number[];
  onComplete: () => void; // fired once, when every interactive step is done
}

const fmt = (v: number) => formatFractionOrDec(v);
const STEP_TITLE = 'font-bold text-slate-800 text-xs';

// Matrix Lab › Inverse › "ทำด้วยตนเอง": the student computes det(A) and adj(A) themselves.
//   2x2: det(A) (shared determinant component), then fills in all 4 cells of adj(A).
//   3x3: det(A), then each of the 9 minors M_ij with the SAME determinant component (row i and
//        column j crossed out), then cofactor signs + transpose are shown automatically.
// A⁻¹ = adj(A) / det(A) and X = A⁻¹B are shown as the result once the interactive work is done.
// Remount (new key) when the system changes.
export const InversePractice: React.FC<InversePracticeProps> = ({ A, B, onComplete }) => {
  const n = A.length;
  const [detA, setDetA] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);

  // 2x2 adj fill-in
  const expectedAdj2 = useMemo(() => (n === 2 ? adjugate2x2(A) : null), [A, n]);
  const [adjInputs, setAdjInputs] = useState<string[][]>([['', ''], ['', '']]);
  const [adjChecked, setAdjChecked] = useState<(boolean | null)[][]>([[null, null], [null, null]]);
  const [adjFeedback, setAdjFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);

  // 3x3 minors, one at a time
  const [minors, setMinors] = useState<(number | null)[][]>(() => [0, 1, 2].map(() => [null, null, null]));
  const minorOrder = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => [i, j] as [number, number]));
  const nextMinor = minorOrder.find(([i, j]) => minors[i][j] === null) || null;
  const allMinorsDone = n === 3 && nextMinor === null;

  const finish = () => {
    if (completed) return;
    setCompleted(true);
    onComplete();
  };

  // 3x3: the interactive part ends with the 9th minor (signs + transpose are shown automatically).
  useEffect(() => {
    if (allMinorsDone) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMinorsDone]);

  const adjugate: number[][] | null = useMemo(() => {
    if (n === 2) return adjChecked.every((r) => r.every((c) => c === true)) ? expectedAdj2 : null;
    return allMinorsDone ? adjugateFromMinors(minors as number[][]).adjugate : null;
  }, [n, adjChecked, expectedAdj2, allMinorsDone, minors]);

  const handleCheckAdj2 = () => {
    const results = expectedAdj2!.map((row, i) => row.map((v, j) => isAnswerCorrect(adjInputs[i][j], v)));
    setAdjChecked(results);
    if (results.every((r) => r.every(Boolean))) {
      setAdjFeedback({ isCorrect: true, message: '✓ คำนวณถูกต้อง! adj(A) ครบทั้ง 4 ช่อง' });
      finish();
    } else {
      setAdjFeedback({
        isCorrect: false,
        message: 'ยังมีช่องที่ไม่ถูกต้อง (สีแดง) — จำหลัก: สลับตำแหน่งเส้นทแยงมุมหลัก (a ↔ d) และเปลี่ยนเครื่องหมายเส้นทแยงมุมรอง (−b, −c)'
      });
    }
  };

  const inverse = adjugate && detA ? adjugate.map((r) => r.map((v) => round(v / detA, 8))) : null;
  const X = inverse ? multiplyMatrixVector(inverse, B) : null;

  return (
    <div className="space-y-4 text-xs">
      {/* Step 1: det(A) */}
      <div className="space-y-2">
        <p className={STEP_TITLE}>ขั้นที่ 1: หาค่า det(A) เพื่อตรวจว่า A มีตัวผกผันหรือไม่</p>
        <InteractiveDeterminant matrix={A} label="\det(A)" onComplete={(d) => {
          setDetA(d);
          if (d === 0) finish();
        }} />
      </div>

      {detA === 0 && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl font-bold text-rose-800">
          det(A) = 0 → เมทริกซ์ A ไม่มีตัวผกผัน จึงใช้วิธี Inverse แก้ระบบนี้ไม่ได้ (ลองวิเคราะห์ด้วย Gauss Elimination แทน)
        </div>
      )}

      {/* Step 2 (2x2): fill in adj(A) */}
      {detA !== null && detA !== 0 && n === 2 && (
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3">
          <p className={STEP_TITLE}>ขั้นที่ 2: เติม adj(A) ให้ครบทั้ง 4 ช่อง</p>
          <MathView latex={`A = \\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix} = \\begin{bmatrix} ${fmt(A[0][0])} & ${fmt(A[0][1])} \\\\ ${fmt(A[1][0])} & ${fmt(A[1][1])} \\end{bmatrix} \\implies \\operatorname{adj}(A) = \\begin{bmatrix} d & -b \\\\ -c & a \\end{bmatrix}`} />
          <div className="flex items-center gap-2">
            <MathView latex="\operatorname{adj}(A) =" />
            <div className="grid grid-cols-2 gap-1.5 p-1.5 border-x-2 border-slate-400 rounded-md">
              {[0, 1].map((i) =>
                [0, 1].map((j) => (
                  <input
                    key={`${i}-${j}`}
                    value={adjInputs[i][j]}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAdjInputs((prev) => prev.map((r, ri) => r.map((c, cj) => (ri === i && cj === j ? v : c))));
                      setAdjChecked((prev) => prev.map((r, ri) => r.map((c, cj) => (ri === i && cj === j ? null : c))));
                    }}
                    disabled={adjChecked[i][j] === true}
                    inputMode="decimal"
                    aria-label={`adj(A) แถว ${i + 1} คอลัมน์ ${j + 1}`}
                    className={`w-16 p-1.5 min-h-11 sm:min-h-0 border rounded-lg text-base sm:text-xs font-bold text-center disabled:bg-slate-50 ${
                      adjChecked[i][j] === true ? 'border-emerald-400 text-emerald-700' : adjChecked[i][j] === false ? 'border-rose-400 text-rose-700' : 'border-slate-200'
                    }`}
                  />
                ))
              )}
            </div>
          </div>
          {adjugate === null && (
            <button
              onClick={handleCheckAdj2}
              disabled={adjInputs.some((r) => r.some((v) => !v.trim()))}
              className="px-4 py-1.5 min-h-11 sm:min-h-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-2xs transition-colors"
            >
              ตรวจคำตอบ
            </button>
          )}
          {adjFeedback && (
            <div className={adjFeedback.isCorrect ? 'p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg font-bold text-emerald-800' : 'p-2.5 rounded-lg font-bold bg-rose-50 text-rose-800 border border-rose-200'}>
              {adjFeedback.message}
            </div>
          )}
        </div>
      )}

      {/* Step 2 (3x3): the 9 minors, each computed with the shared determinant component */}
      {detA !== null && detA !== 0 && n === 3 && (
        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3">
          <p className={STEP_TITLE}>ขั้นที่ 2: หาไมเนอร์ (Minor) ทั้ง 9 ตัว — ตัดแถว i และคอลัมน์ j ออก แล้วหา det ของเมทริกซ์ 2×2 ที่เหลือ</p>
          <div className="flex flex-wrap items-start gap-4">
            {/* progress grid of minors */}
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
            {/* A with the crossed-out row/column for the current minor */}
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
              onComplete={(d) => {
                const [i, j] = nextMinor;
                setMinors((prev) => prev.map((r, ri) => r.map((c, cj) => (ri === i && cj === j ? d : c))));
              }}
            />
          )}
          {allMinorsDone && (
            <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200">
              <p className="font-bold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> ✓ คำนวณไมเนอร์ครบทั้ง 9 ตัวแล้ว!
              </p>
              <p className={STEP_TITLE}>ขั้นที่ 3: ใส่เครื่องหมายตามรูปแบบกระดานหมากรุก แล้ว Transpose (แสดงให้อัตโนมัติ)</p>
              <div className="flex flex-wrap items-center gap-3">
                <MathView latex={`\\begin{bmatrix} + & - & + \\\\ - & + & - \\\\ + & - & + \\end{bmatrix}`} />
                <MathView
                  latex={`\\operatorname{Cof}(A) = \\begin{bmatrix} ${adjugateFromMinors(minors as number[][]).cofactors.map((r) => r.map(fmt).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`}
                />
                <MatrixDisplay matrix={adjugate as number[][]} symbol="\operatorname{adj}(A) = \operatorname{Cof}(A)^T" />
              </div>
              <p className="text-[11px] text-slate-500">
                เครื่องหมายของ <MathView latex="C_{ij} = (-1)^{i+j} M_{ij}" /> เช่น{' '}
                <MathView latex={`C_{12} = ${cofactorSign(0, 1) < 0 ? '-' : '+'}M_{12} = ${fmt(cofactorSign(0, 1) * (minors[0][1] as number))}`} />
              </p>
            </div>
          )}
        </div>
      )}

      {/* Result, once the interactive work is done */}
      {inverse && X && detA && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
          <p className="font-bold text-emerald-800">ผลลัพธ์: นำ adj(A) หารด้วย det(A) แล้วคูณกับ B</p>
          <div className="flex flex-wrap items-center gap-3 overflow-x-auto">
            <MathView latex={`A^{-1} = \\frac{1}{${fmt(detA)}}\\operatorname{adj}(A)`} />
            <MatrixDisplay matrix={inverse} symbol="A^{-1}" />
            <MathView latex={`X = A^{-1}B = \\begin{bmatrix} ${X.map(fmt).join(' \\\\ ')} \\end{bmatrix}`} />
          </div>
        </div>
      )}
    </div>
  );
};

