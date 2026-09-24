import React, { useMemo, useState } from 'react';
import { MathView } from '../math/MathComponents';
import { formatFractionOrDec } from '../../lib/matrixEngine';
import { determinantBreakdown, detMistakeHint, DiagonalTerm } from '../../lib/determinantPractice';
import { InteractiveTerms, TermInput } from './InteractiveTerms';

interface InteractiveDeterminantProps {
  matrix: number[][]; // 2x2 or 3x3
  label: string; // LaTeX for what's being computed, e.g. "\\det(A)", "D_x", "M_{12}"
  highlightCol?: number; // e.g. the column Cramer's rule replaced with B
  onComplete: (det: number) => void;
}

const fmt = (v: number) => formatFractionOrDec(v);
const paren = (v: number) => (v < 0 ? `(${fmt(v)})` : fmt(v));

// "Student computes the determinant" step (diagonal method; Sarrus's rule for 3x3), used by the
// Inverse tab (det(A), and all 9 minors of a 3x3) and the Cramer tab (D, Dx, Dy, Dz). The matrix
// (extended for Sarrus) with the focused diagonal lit up, over the shared InteractiveTerms
// interaction: diagonal products, then (forward sum) − (backward sum). Remount (new key) to reset.
export const InteractiveDeterminant: React.FC<InteractiveDeterminantProps> = ({ matrix, label, highlightCol, onComplete }) => {
  const b = useMemo(() => determinantBreakdown(matrix), [matrix]);
  const diagonals: { term: DiagonalTerm; sign: 1 | -1 }[] = useMemo(
    () => [...b.forward.map((term) => ({ term, sign: 1 as const })), ...b.backward.map((term) => ({ term, sign: -1 as const }))],
    [b]
  );
  const terms: TermInput[] = useMemo(
    () =>
      diagonals.map(({ term, sign }) => ({
        factors: term.factors,
        sign,
        tag: sign === 1 ? '↘ เฉียงลง' : '↙ เฉียงขึ้น',
        tagClass: sign === 1 ? 'text-indigo-700' : 'text-amber-700',
        ariaLabel: `ผลคูณ${sign === 1 ? 'เฉียงลง' : 'เฉียงขึ้น'} ${term.factors.map(paren).join(' × ')}`
      })),
    [diagonals]
  );
  const [activeTerm, setActiveTerm] = useState<number | null>(null);

  const n = b.size;
  const displayCols = n === 3 ? 5 : 2; // Sarrus: first two columns repeated
  const active = activeTerm === null ? null : diagonals[activeTerm];
  const cellClass = (r: number, c: number) => {
    const inActive = active?.term.cells.some(([ar, ac]) => ar === r && ac === c);
    if (inActive) return active!.sign === 1 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-amber-400 text-slate-900 border-amber-500';
    if (highlightCol !== undefined && c % n === highlightCol) return 'bg-indigo-50 text-indigo-800 border-indigo-300';
    return c >= n ? 'bg-slate-50 text-slate-400 border-dashed border-slate-300' : 'bg-white text-slate-800 border-slate-200';
  };

  return (
    <InteractiveTerms
      label={label}
      title={
        <>
          หาค่า <MathView latex={label} />
          <span className="text-slate-400 font-medium">{n === 3 ? '(กฎของซาร์รัส)' : '(คูณเฉียงลง − คูณเฉียงขึ้น)'}</span>
        </>
      }
      visual={
        <>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${displayCols}, 2.25rem)` }}>
            {Array.from({ length: n }).map((_, r) =>
              Array.from({ length: displayCols }).map((__, c) => (
                <div key={`${r}-${c}`} className={`h-9 flex items-center justify-center rounded-md border font-bold transition-colors ${cellClass(r, c)}`}>
                  {fmt(matrix[r][c % n])}
                </div>
              ))
            )}
          </div>
          {n === 3 && <p className="text-[11px] text-slate-400 mt-1">คอลัมน์เส้นประ = คอลัมน์ที่ 1-2 ที่เขียนซ้ำ</p>}
        </>
      }
      terms={terms}
      productsOkMessage="✓ คำนวณผลคูณถูกต้อง! ต่อไปนำผลรวมเฉียงลง ลบ ผลรวมเฉียงขึ้น"
      finalWrongMessage="ยังไม่ถูกต้อง — ลองคำนวณการลบอีกครั้ง ระวังการลบจำนวนลบ"
      mistakeHint={(input) => detMistakeHint(input, b)}
      onActiveTermChange={setActiveTerm}
      onComplete={onComplete}
    />
  );
};
