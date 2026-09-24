import React, { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { MathView } from '../math/MathComponents';
import { formatFractionOrDec, round } from '../../lib/matrixEngine';
import { isAnswerCorrect, termProduct } from '../../lib/determinantPractice';

export interface TermInput {
  factors: number[];
  sign: 1 | -1; // added or subtracted when combining
  tag: string; // e.g. "↘ เฉียงลง", "คอลัมน์ 1"
  tagClass: string;
  ariaLabel: string;
}

interface InteractiveTermsProps {
  label: string; // LaTeX for the result being computed, e.g. "\\det(A)", "x"
  title: React.ReactNode;
  visual?: React.ReactNode; // what the terms come from (matrix with diagonals, row · vector, ...)
  terms: TermInput[];
  productsOkMessage: string;
  finalWrongMessage: string;
  mistakeHint?: (input: string) => string | null; // targeted hint for a wrong combined value
  onActiveTermChange?: (index: number | null) => void;
  onComplete: (value: number) => void;
}

const fmt = (v: number) => formatFractionOrDec(v);
const paren = (v: number) => (v < 0 ? `(${fmt(v)})` : fmt(v));

// The shared "enter each product, then combine them" interaction used across Matrix Lab's Inverse
// and Cramer practice: determinants (InteractiveDeterminant — diagonal products, forward minus
// backward) and the rows of X = A⁻¹B (row × vector products, summed). Two phases, each with a check
// button and the same green/red feedback as Manual Ops: every product first, then the combined
// value (typed, since sign slips when combining are the classic mistake). Remount (new key) to reset.
export const InteractiveTerms: React.FC<InteractiveTermsProps> = ({
  label,
  title,
  visual,
  terms,
  productsOkMessage,
  finalWrongMessage,
  mistakeHint,
  onActiveTermChange,
  onComplete
}) => {
  // termProduct keeps full precision (see its doc comment) so exact fraction answers are accepted.
  const products = useMemo(() => terms.map((t) => termProduct(t.factors)), [terms]);
  const value = useMemo(() => round(products.reduce((a, p, i) => a + terms[i].sign * p, 0), 10), [products, terms]);

  const [inputs, setInputs] = useState<string[]>(() => terms.map(() => ''));
  const [checked, setChecked] = useState<(boolean | null)[]>(() => terms.map(() => null));
  const [phase, setPhase] = useState<'products' | 'final' | 'done'>('products');
  const [finalInput, setFinalInput] = useState('');
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);

  const plus = products.filter((_, i) => terms[i].sign === 1);
  const minus = products.filter((_, i) => terms[i].sign === -1);
  const group = (ps: number[]) => (ps.length > 1 ? `(${ps.map(paren).join(' + ')})` : paren(ps[0]));
  const combineLatex = minus.length ? `${label} = ${group(plus)} - ${group(minus)} =` : `${label} = ${plus.map(paren).join(' + ')} =`;

  const handleCheckProducts = () => {
    const results = terms.map((_, i) => isAnswerCorrect(inputs[i], products[i]));
    setChecked(results);
    if (results.every(Boolean)) {
      setPhase('final');
      setFeedback({ isCorrect: true, message: productsOkMessage });
      return;
    }
    const signSlip = terms.some((_, i) => !results[i] && products[i] !== 0 && isAnswerCorrect(inputs[i], -products[i]));
    setFeedback({
      isCorrect: false,
      message: signSlip
        ? 'มีช่องที่ผิดเฉพาะเครื่องหมาย (ช่องสีแดง) — ตรวจการคูณจำนวนลบอีกครั้ง'
        : 'ยังมีผลคูณที่ไม่ถูกต้อง (ช่องสีแดง) — ลองคูณตัวเลขคู่นั้นใหม่'
    });
  };

  const handleCheckFinal = () => {
    if (isAnswerCorrect(finalInput, value)) {
      setPhase('done');
      setFeedback({ isCorrect: true, message: '✓ คำนวณถูกต้อง!' });
      onComplete(value);
      return;
    }
    setFeedback({ isCorrect: false, message: mistakeHint?.(finalInput) || finalWrongMessage });
  };

  return (
    <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-slate-800 flex items-center gap-1.5">{title}</p>
        {phase === 'done' && (
          <span className="flex items-center gap-1 font-bold text-emerald-700">
            <CheckCircle2 className="w-4 h-4" /> <MathView latex={`${label} = ${fmt(value)}`} />
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {visual && <div className="flex-shrink-0">{visual}</div>}
        <div className="space-y-1.5 flex-grow w-full">
          {terms.map((t, i) => {
            const ok = checked[i];
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className={`w-16 font-bold ${t.tagClass}`}>{t.tag}</span>
                <span className="font-mono text-slate-700">{t.factors.map(paren).join(' × ')} =</span>
                <input
                  value={inputs[i]}
                  onChange={(e) => {
                    const v = e.target.value;
                    setInputs((prev) => prev.map((p, k) => (k === i ? v : p)));
                    setChecked((prev) => prev.map((p, k) => (k === i ? null : p)));
                  }}
                  onFocus={() => onActiveTermChange?.(i)}
                  onBlur={() => onActiveTermChange?.(null)}
                  disabled={phase !== 'products' || ok === true}
                  inputMode="decimal"
                  aria-label={t.ariaLabel}
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
          <MathView latex={combineLatex} />
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
            <span className="font-black text-emerald-700 text-sm">{fmt(value)}</span>
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
