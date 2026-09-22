import { useEffect, useMemo, useState } from 'react';
import { LinearSystem } from '../types';
import { det, solveLinearSystem, getGaussSteps, formatFractionOrDec } from '../lib/matrixEngine';
import { loadStudentProgress, saveStudentProgress, LAB_WALKTHROUGH_XP } from '../lib/learningStore';
import { RenderTextWithMath } from '../components/math/MathComponents';
import { GaussStepDisplay } from '../components/GaussStepDisplay';
import {
  Network,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Infinity as InfinityIcon,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';

const VARS = ['x', 'y', 'z', 'w'];

// Exported so src/tests/mathRendering.test.ts can sweep these for KaTeX/raw-LaTeX-leak
// regressions — same rationale as MatrixLab.tsx's *_CONCEPT_TEXT constants.
export const CIRCUIT_PROBLEM_TEXT =
  'วงจรไฟฟ้ามี 4 ลูปต่อเรียงกัน เขียนสมการกระแสเมช $I_1, I_2, I_3, I_4$ ตามกฎแรงดันของเคอร์ชอฟฟ์ได้ระบบสมการ 4 ตัวแปรด้านล่าง ลองกด "แก้สมการทีละขั้นตอน" แล้วสังเกตว่า $I_3$ ที่ได้เป็นค่าลบ — หมายความว่าอย่างไรทางวิศวกรรม?';
export const SYSTEM_HEADING_TEXT = 'ระบบสมการ $AX = B$ (แก้ไขตัวเลขได้อิสระ)';

// 4-loop circuit example — mesh currents I1..I4 (see engineeringProblems.ts for the
// worked 2x2/3x3 equivalents). Verified numerically: unique solution [10, 6, -3, 8].
const CIRCUIT_4LOOP: { A: number[][]; B: number[] } = {
  A: [
    [4, -1, 0, 0],
    [-1, 4, -1, 0],
    [0, -1, 4, -1],
    [0, 0, -1, 4],
  ],
  B: [34, 17, -26, 35],
};

const BLANK_4X4: { A: number[][]; B: number[] } = {
  A: [
    [1, 1, 1, 1],
    [2, -1, 1, 0],
    [0, 1, -1, 2],
    [1, 0, 2, -1],
  ],
  B: [10, 3, 7, 4],
};

export default function HigherOrderLab() {
  const [matrixStrA, setMatrixStrA] = useState<string[][]>(
    CIRCUIT_4LOOP.A.map((row) => row.map((v) => v.toString()))
  );
  const [vectorStrB, setVectorStrB] = useState<string[]>(CIRCUIT_4LOOP.B.map((v) => v.toString()));
  // 0 = steps hidden; 1..N = how many of getGaussSteps()'s steps are currently revealed. Steps
  // are revealed one at a time via "ขั้นตอนถัดไป" rather than all at once, so the answer isn't
  // spoiled before the student has followed the reduction — see the redesign note below.
  const [revealedCount, setRevealedCount] = useState(0);
  const [activePreset, setActivePreset] = useState<'circuit' | 'blank' | null>('circuit');
  const [progress, setProgress] = useState(loadStudentProgress);
  // True only for the visit where the walkthrough XP was actually just granted — see
  // MatrixLab.tsx's identical justEarnedLabXp for why (never re-claim XP on a later revisit).
  const [justEarnedLabXp, setJustEarnedLabXp] = useState(false);

  const system: LinearSystem = useMemo(() => {
    const numA = matrixStrA.map((row) => row.map((v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v))));
    const numB = vectorStrB.map((v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v)));
    return { dimension: '4x4', A: numA, B: numB, variables: VARS };
  }, [matrixStrA, vectorStrB]);

  const detA = useMemo(() => det(system.A), [system]);
  const summary = useMemo(() => solveLinearSystem(system), [system]);
  const gaussSteps = useMemo(() => getGaussSteps(system), [system]);
  const showSteps = revealedCount > 0;
  const isWalkthroughComplete = revealedCount >= gaussSteps.length && gaussSteps.length > 0;

  // One-time XP award for stepping all the way through the walkthrough (not just opening it) —
  // see LAB_WALKTHROUGH_XP's doc comment in learningStore.ts for the scale reasoning, and
  // StudentProgress.higherOrderLabCompleted for the anti-farm flag (tracked separately from
  // MatrixLab's matrixLabGaussCompleted so completing both labs credits both).
  useEffect(() => {
    if (isWalkthroughComplete && !progress.higherOrderLabCompleted) {
      const updated = { ...progress, xp: progress.xp + LAB_WALKTHROUGH_XP, higherOrderLabCompleted: true };
      saveStudentProgress(updated);
      setProgress(updated);
      setJustEarnedLabXp(true);
    }
  }, [isWalkthroughComplete, progress]);

  const loadPreset = (preset: 'circuit' | 'blank') => {
    const data = preset === 'circuit' ? CIRCUIT_4LOOP : BLANK_4X4;
    setMatrixStrA(data.A.map((row) => row.map((v) => v.toString())));
    setVectorStrB(data.B.map((v) => v.toString()));
    setActivePreset(preset);
    setRevealedCount(0);
    setJustEarnedLabXp(false);
  };

  const handleCellChange = (r: number, c: number, val: string) => {
    const next = matrixStrA.map((row) => [...row]);
    next[r][c] = val;
    setMatrixStrA(next);
    setActivePreset(null);
    setRevealedCount(0);
  };

  const handleBChange = (r: number, val: string) => {
    const next = [...vectorStrB];
    next[r] = val;
    setVectorStrB(next);
    setActivePreset(null);
    setRevealedCount(0);
  };

  return (
    <div className="space-y-5 pb-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full border border-white/20 text-indigo-200 text-xs font-bold mb-3">
          <Network className="w-3.5 h-3.5" /> บทที่ 12 · ห้องปฏิบัติการระบบสมการขั้นสูง
        </div>
        <h1 className="text-2xl sm:text-3xl font-black">
          Higher-Order Systems Lab <span className="text-indigo-400">(4×4)</span>
        </h1>
        <p className="text-sm text-indigo-200 mt-2 max-w-2xl leading-relaxed">
          เมื่อระบบสมการมีตัวแปรมากกว่า 3 ตัว วิธี Cramer's Rule และ Inverse Matrix (Adjugate) ที่เคยเรียน
          จะไม่สะดวกอีกต่อไป ห้องนี้ให้ทดลองแก้ระบบสมการ 4 ตัวแปรด้วย{' '}
          <strong className="text-white">เมทริกซ์แต่งเติมและ Gaussian Elimination</strong> ซึ่งเป็นวิธีเดียวที่ขยายขนาดได้จริง
        </p>
      </div>

      {/* Preset selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500 mr-1">โจทย์ตัวอย่าง:</span>
        <button
          onClick={() => loadPreset('circuit')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            activePreset === 'circuit'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          ⚡ วงจรไฟฟ้า 4 ลูป (Kirchhoff)
        </button>
        <button
          onClick={() => loadPreset('blank')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            activePreset === 'blank'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          ตัวอย่างทั่วไป (คำตอบเดียว)
        </button>
      </div>

      {activePreset === 'circuit' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed">
          <strong>โจทย์:</strong>{' '}
          <RenderTextWithMath text={CIRCUIT_PROBLEM_TEXT} />
        </div>
      )}

      {/* Input grid */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-3">
          <RenderTextWithMath text={SYSTEM_HEADING_TEXT} />
        </h3>
        <div className="flex items-center justify-center gap-3 py-2 overflow-x-auto">
          <span className="text-3xl font-light text-slate-300">[</span>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {matrixStrA.map((row, r) =>
              row.map((val, c) => (
                <input
                  key={`${r}-${c}`}
                  value={val}
                  onChange={(e) => handleCellChange(r, c, e.target.value)}
                  className="w-12 h-12 text-center font-bold text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-indigo-400 focus:bg-white"
                />
              ))
            )}
          </div>
          <span className="text-3xl font-light text-slate-300">]</span>
          <div className="flex flex-col gap-2 ml-2">
            {VARS.map((v) => (
              <div key={v} className="w-10 h-12 flex items-center justify-center font-bold text-indigo-700 text-sm">
                {v}
              </div>
            ))}
          </div>
          <span className="text-2xl font-light text-slate-300">=</span>
          <div className="flex flex-col gap-2">
            {vectorStrB.map((val, r) => (
              <input
                key={r}
                value={val}
                onChange={(e) => handleBChange(r, e.target.value)}
                className="w-12 h-12 text-center font-bold text-sm rounded-lg border border-amber-200 bg-amber-50 focus:outline-none focus:border-amber-400 focus:bg-white"
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            det(A) = <strong className="text-slate-800">{detA}</strong> — เนื่องจากมี 4 ตัวแปร จึงใช้ได้เฉพาะวิธี Gaussian
            Elimination เท่านั้น (Cramer/Inverse ไม่รองรับขนาดนี้)
          </span>
          <button
            onClick={() => setRevealedCount(showSteps ? 0 : 1)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" /> {showSteps ? 'ซ่อนขั้นตอน' : 'แก้สมการทีละขั้นตอน'}
          </button>
        </div>
      </div>

      {/* Step-by-step Gaussian elimination — revealed progressively (one new step per click) so
          the result below isn't spoiled before the student follows the reduction. */}
      {showSteps && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" /> ขั้นตอน Gaussian Elimination (Gauss-Jordan)
          </h3>
          <p className="text-xs text-slate-500 mb-2">
            กฎ ERO ทั้ง 3 ข้อเหมือนกับที่เรียนในบทที่ 8 ทุกประการ เพียงมีจำนวนแถว/คอลัมน์เพิ่มขึ้นเป็น 4
          </p>
          {gaussSteps.slice(0, revealedCount).map((gs, idx, revealed) => {
            const isLatest = idx === revealed.length - 1;
            return (
              <div
                key={gs.stepIndex}
                className={`p-4 rounded-2xl border text-xs space-y-1 transition-all ${
                  isLatest ? 'bg-indigo-50/60 border-indigo-300 shadow-sm' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span
                    className={`font-bold px-2.5 py-0.5 rounded-md border w-fit ${
                      isLatest
                        ? 'text-sm text-indigo-900 bg-indigo-100 border-indigo-200'
                        : 'text-indigo-700 bg-indigo-50 border-indigo-100'
                    }`}
                  >
                    Step {gs.stepIndex}
                  </span>
                  <span className="text-slate-500 font-medium">{gs.explanation}</span>
                </div>
                <GaussStepDisplay step={gs} />
              </div>
            );
          })}

          {isWalkthroughComplete ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold text-center">
              ✓ ครบทุกขั้นตอนแล้ว! ได้คำตอบสุดท้ายตามที่แสดงด้านล่าง
              {justEarnedLabXp && <span> — ได้รับ +{LAB_WALKTHROUGH_XP} XP!</span>}
            </div>
          ) : (
            <button
              onClick={() => setRevealedCount((c) => Math.min(c + 1, gaussSteps.length))}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 mx-auto"
            >
              ขั้นตอนถัดไป <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Result summary — shown after the steps, not before, so the answer doesn't spoil the
          walkthrough that leads to it. */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-3">ผลลัพธ์และการวิเคราะห์ประเภทคำตอบ</h3>
        {summary.type === 'unique' && summary.solution && (
          <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 space-y-1">
              <p className="font-bold">มีคำตอบเดียว (Unique Solution)</p>
              <p className="font-mono text-sm">
                {VARS.map((v, i) => `${v} = ${formatFractionOrDec(summary.solution![i])}`).join(',  ')}
              </p>
              {summary.solution.some((v) => v < 0) && (
                <p className="flex items-center gap-1.5 text-amber-700 pt-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> มีค่าติดลบอย่างน้อยหนึ่งตัว — ในบริบทวงจรไฟฟ้า
                  หมายถึงกระแสไหลสวนทิศทางที่สมมติไว้ ไม่ใช่คำตอบที่ผิด
                </p>
              )}
            </div>
          </div>
        )}
        {summary.type === 'no_solution' && (
          <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
            <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rose-900 font-bold">
              ไม่มีคำตอบ (No Solution) — พบแถวขัดแย้งระหว่างการทำ Gaussian Elimination
            </p>
          </div>
        )}
        {summary.type === 'infinite_solutions' && (
          <div className="flex items-start gap-3 p-4 bg-sky-50 border border-sky-200 rounded-xl">
            <InfinityIcon className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-sky-900 font-bold">
              มีคำตอบนับไม่ถ้วน (Infinite Solutions) — มีตัวแปรอิสระอย่างน้อยหนึ่งตัว
            </p>
          </div>
        )}
      </div>

      {/* Why Gauss only note */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 text-xs text-indigo-900 leading-relaxed flex gap-3">
        <RotateCcw className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          <strong>ทำไมห้องนี้ไม่มีปุ่ม Cramer หรือ Inverse?</strong> เพราะการคำนวณ det/adjugate ของเมทริกซ์ 4×4 ด้วยมือ
          ต้องขยาย cofactor ถึง 4 พจน์ (แต่ละพจน์เป็น det ของเมทริกซ์ 3×3) ซึ่งซับซ้อนและเสี่ยงผิดพลาดมาก
          Gaussian Elimination จึงเป็นทางเลือกเดียวที่เหมาะกับการคำนวณด้วยมือ และเป็นอัลกอริทึมเดียวกับที่ซอฟต์แวร์
          วิศวกรรมจริงใช้เมื่อระบบมีตัวแปรหลักสิบหรือหลักร้อยตัว (ดูบทที่ 12)
        </p>
      </div>
    </div>
  );
}
