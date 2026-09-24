import React, { useEffect, useMemo, useState } from 'react';
import { MathView, formatLatexFraction } from '../math/MathComponents';
import { formatFractionOrDec, replaceColumn } from '../../lib/matrixEngine';
import { InteractiveDeterminant } from './InteractiveDeterminant';

interface CramerPracticeProps {
  A: number[][];
  B: number[];
  variables: string[];
  onComplete: () => void; // fired once, when every interactive step is done
}

// Matrix Lab › Cramer › "ทำด้วยตนเอง": the student computes D, then D_x, D_y (and D_z for 3x3)
// with the SAME interactive determinant component, the replaced column highlighted each time.
// If D = 0 the flow stops there with the conclusion. The final ratios are shown automatically.
// Remount (new key) when the system changes.
export const CramerPractice: React.FC<CramerPracticeProps> = ({ A, B, variables, onComplete }) => {
  const n = A.length;
  // Step 0 = D (matrix A itself); step k (1..n) = D_{variable k}, i.e. column k-1 replaced by B.
  const steps = useMemo(
    () => [
      { label: 'D', matrix: A, col: undefined as number | undefined, note: 'D = det(A)' },
      ...variables.map((v, k) => ({
        label: `D_${v}`,
        matrix: replaceColumn(A, B, k),
        col: k,
        note: `แทนคอลัมน์ที่ ${k + 1} (คอลัมน์ของ ${v}) ด้วย B`
      }))
    ],
    [A, B, variables]
  );
  const [values, setValues] = useState<(number | null)[]>(() => steps.map(() => null));
  const current = values.findIndex((v) => v === null);
  const D = values[0];
  const singular = D === 0;
  const allDone = current === -1;

  useEffect(() => {
    if (singular || allDone) onComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singular, allDone]);

  const fmt = (v: number) => formatFractionOrDec(v);
  const shown = singular ? 1 : allDone ? steps.length : current + 1;

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap gap-1.5">
        {steps.map((s, k) => (
          <span
            key={s.label}
            className={`px-2.5 py-1 rounded-lg border font-bold ${
              values[k] !== null ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : k === current ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
            }`}
          >
            <MathView latex={values[k] !== null ? `${s.label} = ${fmt(values[k] as number)}` : s.label} />
          </span>
        ))}
      </div>

      {steps.slice(0, shown).map((s, k) => (
        <div key={s.label} className="space-y-1.5">
          <p className="font-bold text-slate-800">
            ขั้นที่ {k + 1}: <MathView latex={s.label} /> <span className="font-medium text-slate-500">— {s.note}</span>
          </p>
          <InteractiveDeterminant
            matrix={s.matrix}
            label={s.label}
            highlightCol={s.col}
            onComplete={(d) => setValues((prev) => prev.map((v, i) => (i === k ? d : v)))}
          />
        </div>
      ))}

      {singular && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl font-bold text-rose-800">
          D = 0 → ตัวหารเป็นศูนย์ จึงใช้กฎของคราเมอร์หาคำตอบเดียวไม่ได้ (ระบบนี้ไม่มีคำตอบ หรือมีคำตอบนับไม่ถ้วน — ตรวจด้วย Gauss Elimination)
        </div>
      )}

      {allDone && !singular && D !== null && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
          <p className="font-bold text-emerald-800">✓ คำนวณ det ครบทุกตัวแล้ว! นำไปหารด้วย D</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {variables.map((v, k) => (
              <MathView
                key={v}
                latex={`${v} = \\frac{D_${v}}{D} = \\frac{${fmt(values[k + 1] as number)}}{${fmt(D)}} = ${formatLatexFraction((values[k + 1] as number) / D)}`}
              />
            ))}
          </div>
          {n === 3 && <p className="text-[11px] text-emerald-700">ระบบ 3 ตัวแปรใช้ดีเทอร์มิแนนต์ 4 ชุด (D, Dx, Dy, Dz)</p>}
        </div>
      )}
    </div>
  );
};
