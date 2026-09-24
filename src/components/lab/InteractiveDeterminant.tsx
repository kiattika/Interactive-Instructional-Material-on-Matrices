import React, { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { MathView } from '../math/MathComponents';
import { formatFractionOrDec } from '../../lib/matrixEngine';
import { determinantBreakdown, isAnswerCorrect, detMistakeHint, DiagonalTerm } from '../../lib/determinantPractice';

interface InteractiveDeterminantProps {
  matrix: number[][]; // 2x2 or 3x3
  label: string; // LaTeX for what's being computed, e.g. "\\det(A)", "D_x", "M_{12}"
  highlightCol?: number; // e.g. the column Cramer's rule replaced with B
  onComplete: (det: number) => void;
}

// Shared "student computes the determinant" step (diagonal method; Sarrus's rule for 3x3), used by
// the Inverse tab (det(A), and all 9 minors of a 3x3) and the Cramer tab (D, Dx, Dy, Dz). Same
// check-button + green/red feedback language as Manual Ops. Two phases: the diagonal products,
// then the final subtraction (typed, since subtracting negative products is the classic slip).
// Remount with a new `key` to reset it for a different matrix.
export const InteractiveDeterminant: React.FC<InteractiveDeterminantProps> = ({ matrix, label, highlightCol, onComplete }) => {
  const b = useMemo(() => determinantBreakdown(matrix), [matrix]);
  const terms: { term: DiagonalTerm; sign: 1 | -1 }[] = [
    ...b.forward.map((term) => ({ term, sign: 1 as const })),
    ...b.backward.map((term) => ({ term, sign: -1 as const }))
  ];
  const n = b.size;
  const displayCols = n === 3 ? 5 : 2; // Sarrus: first two columns repeated

  const [inputs, setInputs] = useState<string[]>(() => terms.map(() => ''));
  const [checked, setChecked] = useState<(boolean | null)[]>(() => terms.map(() => null));
  const [phase, setPhase] = useState<'products' | 'final' | 'done'>('products');
  const [finalInput, setFinalInput] = useState('');
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);
  const [activeTerm, setActiveTerm] = useState<number | null>(null);

  const fmt = (v: number) => formatFractionOrDec(v);
  const paren = (v: number) => (v < 0 ? `(${fmt(v)})` : fmt(v));
  // "(1 + 3 + 2)" for Sarrus's three terms; a single 2x2 term needs no extra grouping: "(-2) - 1".
  const group = (ts: DiagonalTerm[]) => (ts.length > 1 ? `(${ts.map((t) => paren(t.product)).join(' + ')})` : paren(ts[0].product));

  const handleCheckProducts = () => {
    const results = terms.map((t, i) => isAnswerCorrect(inputs[i], t.term.product));
    setChecked(results);
    if (results.every(Boolean)) {
      setPhase('final');
      setFeedback({ isCorrect: true, message: '✓ คำนวณผลคูณถูกต้อง! ต่อไปนำผลรวมเฉียงลง ลบ ผลรวมเฉียงขึ้น' });
      return;
    }
    const signSlip = terms.some((t, i) => !results[i] && isAnswerCorrect(inputs[i], -t.term.product) && t.term.product !== 0);
    setFeedback({
      isCorrect: false,
      message: signSlip
        ? 'มีช่องที่ผิดเฉพาะเครื่องหมาย (ช่องสีแดง) — ตรวจการคูณจำนวนลบอีกครั้ง'
        : 'ยังมีผลคูณที่ไม่ถูกต้อง (ช่องสีแดง) — ลองคูณตัวเลขบนเส้นทแยงนั้นใหม่'
    });
  };

  const handleCheckFinal = () => {
    if (isAnswerCorrect(finalInput, b.det)) {
      setPhase('done');
      setFeedback({ isCorrect: true, message: `✓ คำนวณถูกต้อง!` });
      onComplete(b.det);
      return;
    }
    setFeedback({ isCorrect: false, message: detMistakeHint(finalInput, b) || 'ยังไม่ถูกต้อง — ลองคำนวณการลบอีกครั้ง ระวังการลบจำนวนลบ' });
  };

  const active = activeTerm === null ? null : terms[activeTerm];
  const cellClass = (r: number, c: number) => {
    const inActive = active?.term.cells.some(([ar, ac]) => ar === r && ac === c);
    const repeated = c >= n;
    if (inActive) return active!.sign === 1 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-amber-400 text-slate-900 border-amber-500';
    if (highlightCol !== undefined && c % n === highlightCol) return 'bg-indigo-50 text-indigo-800 border-indigo-300';
    return repeated ? 'bg-slate-50 text-slate-400 border-dashed border-slate-300' : 'bg-white text-slate-800 border-slate-200';
  };

  return (
    <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-slate-800 flex items-center gap-1.5">
          หาค่า <MathView latex={label} />
          <span className="text-slate-400 font-medium">{n === 3 ? '(กฎของซาร์รัส)' : '(คูณเฉียงลง − คูณเฉียงขึ้น)'}</span>
        </p>
        {phase === 'done' && (
          <span className="flex items-center gap-1 font-bold text-emerald-700">
            <CheckCircle2 className="w-4 h-4" /> <MathView latex={`${label} = ${fmt(b.det)}`} />
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* Matrix (extended for Sarrus) — the diagonal being worked on lights up */}
        <div className="flex-shrink-0">
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
        </div>

        {/* One input per diagonal product */}
        <div className="space-y-1.5 flex-grow w-full">
          {terms.map((t, i) => {
            const ok = checked[i];
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className={`w-16 font-bold ${t.sign === 1 ? 'text-indigo-700' : 'text-amber-700'}`}>
                  {t.sign === 1 ? '↘ เฉียงลง' : '↙ เฉียงขึ้น'}
                </span>
                <span className="font-mono text-slate-700">{t.term.factors.map(paren).join(' × ')} =</span>
                <input
                  value={inputs[i]}
                  onChange={(e) => {
                    const v = e.target.value;
                    setInputs((prev) => prev.map((p, k) => (k === i ? v : p)));
                    setChecked((prev) => prev.map((p, k) => (k === i ? null : p)));
                  }}
                  onFocus={() => setActiveTerm(i)}
                  onBlur={() => setActiveTerm(null)}
                  disabled={phase !== 'products' || ok === true}
                  inputMode="decimal"
                  aria-label={`ผลคูณ${t.sign === 1 ? 'เฉียงลง' : 'เฉียงขึ้น'} ${t.term.factors.map(paren).join(' × ')}`}
                  className={`w-20 p-1.5 min-h-11 sm:min-h-0 border rounded-lg text-base sm:text-xs font-bold text-center disabled:bg-slate-50 ${
                    ok === true ? 'border-emerald-400 text-emerald-700' : ok === false ? 'border-rose-400 text-rose-700' : 'border-slate-200'
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {phase === 'products' && (
        <button
          onClick={handleCheckProducts}
          disabled={inputs.some((v) => !v.trim())}
          className="px-4 py-1.5 min-h-11 sm:min-h-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-2xs transition-colors"
        >
          ตรวจผลคูณ
        </button>
      )}

      {phase !== 'products' && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <MathView
            latex={`${label} = ${group(b.forward)} - ${group(b.backward)} =`}
          />
          {phase === 'final' ? (
            <>
              <input
                value={finalInput}
                onChange={(e) => setFinalInput(e.target.value)}
                inputMode="decimal"
                aria-label={`ค่าของ ${label}`}
                className="w-20 p-1.5 min-h-11 sm:min-h-0 border border-slate-200 rounded-lg text-base sm:text-xs font-bold text-center"
              />
              <button
                onClick={handleCheckFinal}
                disabled={!finalInput.trim()}
                className="px-4 py-1.5 min-h-11 sm:min-h-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-2xs transition-colors"
              >
                ตรวจคำตอบ
              </button>
            </>
          ) : (
            <span className="font-black text-emerald-700 text-sm">{fmt(b.det)}</span>
          )}
        </div>
      )}

      {feedback && (
        <div
          className={
            feedback.isCorrect
              ? 'p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg font-bold text-emerald-800'
              : 'p-2.5 rounded-lg font-bold bg-rose-50 text-rose-800 border border-rose-200'
          }
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
};
