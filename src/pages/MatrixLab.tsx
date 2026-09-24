import { useState, useMemo, useEffect } from 'react';
import {
  LinearSystem,
  SystemDimension,
  RowOperation,
  AppliedProblem,
  GaussStep,
} from '../types';
import {
  det,
  solveLinearSystem,
  getInverseSteps,
  getCramerSteps,
  getGaussSteps,
  applyRowOperation,
  formatFractionOrDec,
  parseNumericString,
} from '../lib/matrixEngine';
import { ENGINEERING_ICT_PROBLEMS } from '../lib/engineeringProblems';
import {
  loadStudentProgress,
  saveStudentProgress,
  loadTeacherSettings,
  LAB_WALKTHROUGH_XP,
  SolvingMethod,
  LabPracticeKey,
  withLabPracticeCompletion
} from '../lib/learningStore';
import { InversePractice } from '../components/lab/InversePractice';
import { CramerPractice } from '../components/lab/CramerPractice';
import { withActivity, withMethodUsed, withEarnedBadges, VERSATILE_SOLVER_BADGE } from '../lib/motivation';
import { GeminiTutor } from '../components/GeminiTutor';
import { GaussStepDisplay } from '../components/GaussStepDisplay';
import {
  SystemDisplay,
  MatrixDisplay,
  AugmentedMatrixDisplay,
  MathView,
  RenderTextWithMath,
} from '../components/math/MathComponents';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Undo2,
  BookOpen,
  Info,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Mirrors the LaTeX shape getGaussSteps() builds in matrixEngine.ts, but for an operation the
// STUDENT picked in the manual-mode UI (see handleApplyManualOp) rather than one the algorithm
// chose — just echoes their own typed coefficient back rather than re-deriving/simplifying it.
function buildManualOpLatex(opType: 'swap' | 'multiply' | 'add', row1: number, row2: number, kStr: string): string {
  const r1 = row1 + 1;
  const r2 = row2 + 1;
  if (opType === 'swap') return `R_{${r1}} \\leftrightarrow R_{${r2}}`;
  if (opType === 'multiply') return `R_{${r1}} \\rightarrow (${kStr})R_{${r1}}`;
  return `R_{${r1}} \\rightarrow R_{${r1}} + (${kStr})R_{${r2}}`;
}

// One entry in the manual-mode operation history — see manualHistory's doc comment below.
interface ManualOpHistoryEntry {
  beforeMatrix: (number | string)[][];
  afterMatrix: (number | string)[][];
  opLatex: string;
  highlightRows: number[];
}

// RREF is unique for a given matrix regardless of which valid sequence of row operations reached
// it, so a straight cell-by-cell comparison against getGaussSteps()'s final step reliably
// detects "the student finished the reduction," however they got there.
function augmentedMatricesEqual(a: (number | string)[][], b: (number | string)[][]): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, i) => row.length === b[i].length && row.every((val, j) => String(val) === String(b[i][j])));
}

// Walkthrough-vs-practice toggle shared by the Inverse, Cramer and Gauss tabs.
function ModeToggle({
  label,
  mode,
  onChange,
  autoLabel,
  manualLabel
}: {
  label: string;
  mode: 'auto' | 'manual';
  onChange: (mode: 'auto' | 'manual') => void;
  autoLabel: string;
  manualLabel: string;
}) {
  const btn = (value: 'auto' | 'manual', text: string) => (
    <button
      onClick={() => onChange(value)}
      className={`px-3 py-1 min-h-11 sm:min-h-0 rounded-lg text-xs font-bold transition-all ${
        mode === value ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {text}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
      <span className="text-xs font-bold text-slate-700 px-2">{label}</span>
      <div className="grid grid-cols-2 w-full sm:w-auto sm:flex gap-1">
        {btn('auto', autoLabel)}
        {btn('manual', manualLabel)}
      </div>
    </div>
  );
}

const PRESETS = {
  '2x2_unique': {
    name: '2x2: Unique Solution (คำตอบเดียว)',
    dimension: '2x2' as SystemDimension,
    A: [
      [2, 1],
      [1, -1],
    ],
    B: [5, 1],
  },
  '2x2_infinite': {
    name: '2x2: Infinite Solutions (คำตอบไม่จำกัด)',
    dimension: '2x2' as SystemDimension,
    A: [
      [1, 1],
      [2, 2],
    ],
    B: [2, 4],
  },
  '2x2_no_sol': {
    name: '2x2: No Solution (ไม่มีคำตอบ)',
    dimension: '2x2' as SystemDimension,
    A: [
      [1, 1],
      [2, 2],
    ],
    B: [2, 5],
  },
  '3x3_unique': {
    name: '3x3: Unique Solution (คำตอบเดียว)',
    dimension: '3x3' as SystemDimension,
    A: [
      [1, 1, 1],
      [2, -1, 1],
      [3, 1, -1],
    ],
    B: [6, 3, 2],
  },
};

// Maps each applied-problem preset in the dropdown to its full AppliedProblem record in
// engineeringProblems.ts (the same source Exercises.tsx uses) — single source of truth, so
// the A/B numbers here can never drift from the scenario text describing them, and so the
// scenario itself can be shown (see the Phase 2 bug report: presets used to load only the
// raw numbers, silently dropping the actual question the student is supposed to answer).
const APPLIED_PRESET_IDS = {
  app_circuit: 'eng-circuit-2loop',
  app_cipher: 'ict-hill-cipher',
  app_mixing: 'eng-chem-mixing',
} as const;

function findAppliedProblem(problemId: string): AppliedProblem {
  const problem = ENGINEERING_ICT_PROBLEMS.find((p) => p.id === problemId);
  if (!problem) {
    throw new Error(`Applied problem "${problemId}" not found in ENGINEERING_ICT_PROBLEMS`);
  }
  return problem;
}

// Exported so src/tests/mathRendering.test.ts can sweep these for KaTeX/raw-LaTeX-leak
// regressions — see PHASE1_UPDATE_NOTES.md and the Phase 2 bug report for why hardcoded
// inline JSX strings like these need the same coverage as data-driven lesson content.
export const INVERSE_CONCEPT_TEXT =
  'จาก $AX = B$ คูณด้วย $A^{-1}$ ทางซ้าย จะได้ $X = A^{-1}B$ (เงื่อนไขสำคัญ: $\\det(A) \\neq 0$)';
export const CRAMER_CONCEPT_TEXT =
  'คำนวณ $D = \\det(A)$ และแทนคอลัมน์ของตัวแปรด้วยเวกเตอร์ $B$ เพื่อหา $D_x, D_y, D_z$ แล้วใช้ $x = D_x/D$, $y = D_y/D$, $z = D_z/D$';

export default function MatrixLab() {
  const [dimension, setDimension] = useState<SystemDimension>('2x2');
  const [matrixStrA, setMatrixStrA] = useState<string[][]>([
    ['2', '1'],
    ['1', '-1'],
  ]);
  const [vectorStrB, setVectorStrB] = useState<string[]>(['5', '1']);

  const [activeTab, setActiveTab] = useState<'inverse' | 'cramer' | 'gauss' | 'compare'>('inverse');
  const [activeAppliedProblem, setActiveAppliedProblem] = useState<AppliedProblem | null>(null);
  const [cramerSelectedMat, setCramerSelectedMat] = useState<'D' | 'Dx' | 'Dy' | 'Dz'>('D');
  // Manual Ops is the default so students practice doing the row reduction themselves before
  // reaching for the passive auto-simulation — see the Phase-3 UX brief.
  const [gaussMode, setGaussMode] = useState<'auto' | 'manual'>('manual');
  // Inverse/Cramer default to the student-computes-it practice, same as Gauss's Manual Ops; the
  // original read-only walkthrough stays one click away.
  const [inverseMode, setInverseMode] = useState<'auto' | 'manual'>('manual');
  const [cramerMode, setCramerMode] = useState<'auto' | 'manual'>('manual');
  // Last completed practice walkthrough (and XP actually paid for it), for the completion banner.
  const [practiceDone, setPracticeDone] = useState<{ key: LabPracticeKey; systemKey: string; xp: number } | null>(null);

  // Manual Gauss Operation State — matrices here can contain fraction STRINGS (e.g. "1/2"), not
  // just plain numbers, since applyRowOperation() returns the same Rational-formatted shape as
  // getGaussSteps() (see GaussStepDisplay.tsx's doc comment on why that must never be re-run
  // through formatFractionOrDec, which expects a raw number).
  //
  // Every applied operation is kept (not just the latest), so the student can see the full
  // sequence of steps they've taken so far and undo the most recent one to try a different
  // Ri/Rj/k combination instead of restarting from scratch (see handleUndoManualOp).
  const [manualHistory, setManualHistory] = useState<ManualOpHistoryEntry[]>([]);
  const [opType, setOpType] = useState<'swap' | 'multiply' | 'add'>('add');
  const [opRow1, setOpRow1] = useState<number>(1);
  const [opRow2, setOpRow2] = useState<number>(0);
  const [opK, setOpK] = useState<string>('-2');
  const [manualFeedback, setManualFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);

  const [progress, setProgress] = useState(loadStudentProgress);
  const [settings] = useState(loadTeacherSettings);
  // True only for the visit where the Gauss walkthrough XP was actually just granted — keeps
  // the completion banner from claiming "+15 XP!" again on every later visit to an
  // already-completed walkthrough.
  const [justEarnedLabXp, setJustEarnedLabXp] = useState(false);
  const [justEarnedVersatileBadge, setJustEarnedVersatileBadge] = useState(false);

  // Versatile Solver tracking: a method counts as "used" when the student opens its tab — or,
  // for Inverse (the tab already open on arrival), when they expand one of its steps, so merely
  // visiting the lab doesn't count. Re-reads storage before writing so this frequent small save
  // can't overwrite XP another component (e.g. LivePollAwardWatcher) added since mount.
  const recordMethodUse = (method: SolvingMethod) => {
    const fresh = loadStudentProgress();
    const updated = withActivity(withMethodUsed(fresh, method, settings.enableBadges));
    if (updated === fresh) return;
    saveStudentProgress(updated);
    setProgress(updated);
    if (!fresh.earnedBadges.includes(VERSATILE_SOLVER_BADGE) && updated.earnedBadges.includes(VERSATILE_SOLVER_BADGE)) {
      setJustEarnedVersatileBadge(true);
    }
  };

  // Learning Mode & Hints
  const [learningMode, setLearningMode] = useState<boolean>(false);
  const [learningAnswer, setLearningAnswer] = useState<string | null>(null);
  const [learningFeedback, setLearningFeedback] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState<number>(0);

  // Expandable steps control
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  // Dimension Change Handler
  const handleDimensionChange = (newDim: SystemDimension) => {
    setActiveAppliedProblem(null);
    setDimension(newDim);
    if (newDim === '2x2') {
      setMatrixStrA([
        ['2', '1'],
        ['1', '-1'],
      ]);
      setVectorStrB(['5', '1']);
    } else {
      setMatrixStrA([
        ['1', '1', '1'],
        ['2', '-1', '1'],
        ['3', '1', '-1'],
      ]);
      setVectorStrB(['6', '3', '2']);
    }
    setManualHistory([]);
    setManualFeedback(null);
  };

  // Load Preset — either a plain numeric preset (PRESETS) or an applied-problem preset
  // (APPLIED_PRESET_IDS), which also surfaces the problem's scenario text above the calculator.
  const handleLoadPreset = (presetKey: string) => {
    if (presetKey in APPLIED_PRESET_IDS) {
      const problemId = APPLIED_PRESET_IDS[presetKey as keyof typeof APPLIED_PRESET_IDS];
      const problem = findAppliedProblem(problemId);
      setActiveAppliedProblem(problem);
      setDimension(problem.system.dimension);
      setMatrixStrA(problem.system.A.map((r) => r.map((c) => c.toString())));
      setVectorStrB(problem.system.B.map((c) => c.toString()));
    } else {
      const p = PRESETS[presetKey as keyof typeof PRESETS];
      setActiveAppliedProblem(null);
      setDimension(p.dimension);
      setMatrixStrA(p.A.map((r) => r.map((c) => c.toString())));
      setVectorStrB(p.B.map((c) => c.toString()));
    }
    setManualHistory([]);
    setManualFeedback(null);
  };

  // Parse Numeric System
  const system: LinearSystem = useMemo(() => {
    const numA = matrixStrA.map((row) =>
      row.map((val) => {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
      })
    );
    const numB = vectorStrB.map((val) => {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    });

    return {
      dimension,
      A: numA,
      B: numB,
      variables: dimension === '2x2' ? ['x', 'y'] : ['x', 'y', 'z'],
    };
  }, [dimension, matrixStrA, vectorStrB]);

  // Identifies the current system; the practice components are keyed by it so editing the matrix,
  // loading a preset or switching dimension restarts them from a clean slate.
  const systemKey = `${dimension}|${JSON.stringify(system.A)}|${JSON.stringify(system.B)}`;

  // One-time award per method + size (see withLabPracticeCompletion). Re-reads storage first, like
  // recordMethodUse, so it can't overwrite XP another component added since this page loaded.
  const handlePracticeComplete = (method: 'inverse' | 'cramer') => {
    const key = `${method}-${dimension}` as LabPracticeKey;
    const fresh = loadStudentProgress();
    const { progress: next, xpAwarded } = withLabPracticeCompletion(fresh, key, settings.enableXp);
    // May also complete a method badge's lab requirement (inverse_solver, cramer_specialist,
    // determinant_master) — see LESSON_BADGE_RULES in lib/motivation.ts.
    const updated = withEarnedBadges(withActivity(withMethodUsed(next, method, settings.enableBadges)), settings.enableBadges);
    if (updated !== fresh) {
      saveStudentProgress(updated);
      setProgress(updated);
    }
    setPracticeDone({ key, systemKey, xp: xpAwarded });
  };

  const renderPracticeDone = (method: 'inverse' | 'cramer') =>
    practiceDone && practiceDone.key === `${method}-${dimension}` && practiceDone.systemKey === systemKey ? (
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold text-center text-xs">
        ✓ ทำครบทุกขั้นตอนแล้ว!
        {practiceDone.xp > 0
          ? <span> — ได้รับ +{practiceDone.xp} XP!</span>
          : progress.matrixLabPracticeCompleted.includes(practiceDone.key) && settings.enableXp
          ? <span className="font-medium"> (เคยได้รับ XP ของแบบฝึก {dimension} นี้ไปแล้ว — ฝึกซ้ำกับโจทย์อื่นได้เรื่อยๆ)</span>
          : null}
      </div>
    ) : null;

  // Solvers calculation
  const summary = useMemo(() => solveLinearSystem(system), [system]);
  const inverseData = useMemo(() => getInverseSteps(system), [system]);
  const cramerData = useMemo(() => getCramerSteps(system), [system]);
  const gaussSteps = useMemo(() => getGaussSteps(system), [system]);

  // Current manual augmented matrix — the latest history entry's result, or the untouched
  // starting matrix when no operation has been applied yet.
  const currentManualAug = useMemo<(number | string)[][]>(() => {
    if (manualHistory.length > 0) return manualHistory[manualHistory.length - 1].afterMatrix;
    return system.A.map((r, i) => [...r, system.B[i]]);
  }, [manualHistory, system]);

  // Handle Manual Row Operation
  const handleApplyManualOp = () => {
    // k is a free-text field shared by both 'multiply' (Ri -> kRi) and 'add' (Ri -> Ri + kRj), so
    // this validation covers both op types. A parse failure (e.g. the unsupported "-(1/2)" form,
    // empty input, or garbage text) must be rejected outright, NOT silently coerced to a default
    // — parseFloat(opK) || 1 used to turn any unparseable k into a silent no-op (k=1) while still
    // reporting success, leaving the row unchanged with no indication anything went wrong.
    let kValue = 1;
    if (opType !== 'swap') {
      const parsed = parseNumericString(opK);
      if (parsed === null) {
        setManualFeedback({
          isCorrect: false,
          message: 'ไม่เข้าใจค่า k ที่กรอก กรุณากรอกตัวเลขหรือเศษส่วน เช่น 0.5 หรือ -1/2',
        });
        return;
      }
      kValue = parsed;
    }

    const op: RowOperation = {
      type: opType,
      row1: opRow1,
      row2: opRow2,
      k: kValue,
      description: '',
    };

    const res = applyRowOperation(currentManualAug, op);
    if (!res.isValid) {
      setManualFeedback({ isCorrect: false, message: res.errorMessage || 'การทำงานไม่ถูกต้อง' });
      return;
    }

    setManualHistory((h) => [
      ...h,
      {
        beforeMatrix: currentManualAug,
        afterMatrix: res.newMatrix,
        opLatex: buildManualOpLatex(opType, opRow1, opRow2, opK),
        highlightRows: opType === 'multiply' ? [opRow1] : [opRow1, opRow2],
      },
    ]);
    setManualFeedback({
      isCorrect: true,
      message: '✓ คำนวณถูกต้อง! เมทริกซ์แต่งเติมถูกปรับเปลี่ยนเรียบร้อย',
    });
  };

  // Full reset — clears the entire operation history and starts over from the original matrix.
  const handleResetManualGauss = () => {
    setManualHistory([]);
    setManualFeedback(null);
  };

  // Undo — removes only the most recent operation, restoring the matrix state to what it was
  // right before that operation, so the student can try a different Ri/Rj/k combination instead
  // of restarting the whole reduction from scratch.
  const handleUndoManualOp = () => {
    setManualHistory((h) => h.slice(0, -1));
    setManualFeedback(null);
  };

  // Each history entry rendered as its own before→operation→after step, in the same visual as
  // auto mode (GaussStepDisplay). When no operation has been applied yet, show a single
  // "step 0" with just the starting matrix, same as gaussSteps' own Step 1.
  const manualDisplaySteps: GaussStep[] = useMemo(() => {
    if (manualHistory.length === 0) {
      return [{ stepIndex: 0, augmentedMatrix: currentManualAug, explanation: '' }];
    }
    return manualHistory.map((entry, idx) => ({
      stepIndex: idx + 1,
      beforeMatrix: entry.beforeMatrix,
      augmentedMatrix: entry.afterMatrix,
      operationPerformed: entry.opLatex,
      explanation: '',
      highlightRows: entry.highlightRows,
    }));
  }, [manualHistory, currentManualAug]);

  const finalGaussStep = gaussSteps[gaussSteps.length - 1];
  const isManualGaussComplete =
    manualHistory.length > 0 && !!finalGaussStep && augmentedMatricesEqual(currentManualAug, finalGaussStep.augmentedMatrix);

  // The final-answer verification box only makes sense once the student has actually reached
  // the end of a step-by-step method — showing it unconditionally (the old behavior) let it
  // spoil the answer before working through any steps. Cramer's tab has no sequential-step
  // concept (just a D/Dx/Dy/Dz matrix selector) so it never shows there, and it's removed
  // entirely from the method-comparison tab per the teacher's request.
  const lastInverseStepNumber = inverseData.steps[inverseData.steps.length - 1]?.stepNumber;
  const showVerificationBox =
    (activeTab === 'inverse' && inverseMode === 'auto' && expandedStep === lastInverseStepNumber) ||
    (activeTab === 'gauss' && (gaussMode === 'auto' || isManualGaussComplete));

  // One-time XP award for actually completing the manual walkthrough (reaching RREF), not just
  // opening the tab — see LAB_WALKTHROUGH_XP's doc comment in learningStore.ts for the scale
  // reasoning, and StudentProgress.matrixLabGaussCompleted for the anti-farm flag. The
  // completed flag is still recorded even while XP is disabled (enableXp only pauses the
  // increment, it never rewrites what a student has already accomplished), so re-enabling XP
  // later doesn't retroactively pay out for a walkthrough finished while it was off.
  useEffect(() => {
    if (isManualGaussComplete && !progress.matrixLabGaussCompleted) {
      // Completing the walkthrough can also complete the Gaussian Expert badge's lab requirement.
      const updated = withEarnedBadges(
        withActivity({
          ...progress,
          xp: settings.enableXp ? progress.xp + LAB_WALKTHROUGH_XP : progress.xp,
          matrixLabGaussCompleted: true
        }),
        settings.enableBadges
      );
      saveStudentProgress(updated);
      setProgress(updated);
      if (settings.enableXp) setJustEarnedLabXp(true);
    }
  }, [isManualGaussComplete, progress, settings.enableXp, settings.enableBadges]);

  // Hints array
  const hintsList = [
    `คำใบ้ที่ 1: สำหรับระบบสมการนี้ det(A) มีค่าเท่ากับ ${det(system.A)}.`,
    `คำใบ้ที่ 2: หาก det(A) ≠ 0 แสดงว่าระบบสมการนี้มีคำตอบเดียว`,
    `คำใบ้ที่ 3: ใช้สูตร X = A⁻¹B หรือ x = Dx / D ในการหาคำตอบสุดท้าย`,
  ];

  // Fixed-height app shell (left column scrolls on its own beside the tutor) is lg-only: below lg
  // the grid is a single column, and flex-grow + overflow-hidden there squeezed the left column
  // (itself a scroller) to 0px tall, hiding the whole editor/solver on phones and tablets.
  return (
    <div className="flex flex-col gap-4 lg:h-full">
      {/* Top Header & Presets Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Interactive Matrix Laboratory</h2>
          <p className="text-xs text-slate-500">ทดลอง แก้สมการ และวิเคราะห์ขั้นตอนด้วยเมทริกซ์</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Dimension Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => handleDimensionChange('2x2')}
              className={`px-3 py-1 min-h-11 sm:min-h-0 text-xs font-bold rounded-lg transition-all ${
                dimension === '2x2' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2 × 2
            </button>
            <button
              onClick={() => handleDimensionChange('3x3')}
              className={`px-3 py-1 min-h-11 sm:min-h-0 text-xs font-bold rounded-lg transition-all ${
                dimension === '3x3' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3 × 3
            </button>
          </div>

          {/* Quick Presets */}
          <select
            onChange={(e) => e.target.value && handleLoadPreset(e.target.value)}
            className="min-h-11 sm:min-h-0 min-w-0 flex-1 sm:flex-none text-base sm:text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 outline-none focus:border-indigo-500"
            defaultValue=""
          >
            <option value="" disabled>
              -- เลือกโจทย์ตัวอย่าง --
            </option>
            <option value="2x2_unique">2x2: Unique Solution (2x+y=5, x-y=1)</option>
            <option value="2x2_infinite">2x2: Infinitely Many (x+y=2, 2x+2y=4)</option>
            <option value="2x2_no_sol">2x2: No Solution (x+y=2, 2x+2y=5)</option>
            <option value="3x3_unique">3x3: Unique Solution (3 equations)</option>
            <option value="app_circuit">⚡ ประยุกต์: วงจรไฟฟ้า 2 ลูป (Kirchhoff)</option>
            <option value="app_cipher">🔐 ประยุกต์: ถอดรหัส Hill Cipher</option>
            <option value="app_mixing">🧪 ประยุกต์: ผสมสารละลาย 3 ชนิด</option>
          </select>
        </div>
      </div>

      {/* Applied-problem scenario banner — shown prominently above the calculator whenever an
          engineering/ICT preset is active, so the student sees the actual question being asked
          instead of just raw A/B numbers (Phase 2 bug report). */}
      {activeAppliedProblem && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-sm space-y-3 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-md text-xs sm:text-[10px] font-bold uppercase tracking-wider border ${
                activeAppliedProblem.field === 'engineering'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-teal-50 text-teal-700 border-teal-200'
              }`}
            >
              {activeAppliedProblem.fieldLabel}
            </span>
            <span className="text-xs font-bold text-slate-800">{activeAppliedProblem.title}</span>
          </div>
          <div className="text-sm text-slate-800 leading-relaxed">
            <RenderTextWithMath text={activeAppliedProblem.scenario} />
          </div>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1.5">
            <p className="font-bold text-amber-900 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" /> คำถามช่วยคิด (Polya ขั้น 1-2)
            </p>
            {activeAppliedProblem.guidingQuestions.map((q, i) => (
              <p key={i} className="text-amber-900">
                • <RenderTextWithMath text={q} />
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Main Bento Layout: Left = Matrix Editor & Solvers, Right = Gemini AI Tutor (if enabled) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:flex-grow lg:overflow-hidden">
        {/* Left Column: Input Engine & Solver Tabs — takes the full width when the AI tutor is
            disabled, since there's no right column to share it with. */}
        <div className={`${settings.enableAiTutor ? 'lg:col-span-8' : 'lg:col-span-12'} flex flex-col gap-4 lg:overflow-y-auto lg:pr-1`}>
          {/* Matrix Input & Representation Bento Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>📐</span> Matrix Input Engine (AX = B)
              </h3>
              <span className="text-xs sm:text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                det(A) = {summary.determinant}
              </span>
            </div>

            {/* Input Editors & Equation display */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-50/70 p-4 rounded-xl border border-dashed border-slate-200">
              {/* Matrix A Input */}
              <div className="flex items-center gap-2">
                <span className="text-2xl font-light text-slate-400">[</span>
                <div
                  className="grid gap-2 p-2 bg-white rounded-xl shadow-sm border border-slate-200"
                  style={{
                    gridTemplateColumns: `repeat(${dimension === '2x2' ? 2 : 3}, minmax(0, 1fr))`,
                  }}
                >
                  {matrixStrA.map((row, rIdx) =>
                    row.map((val, cIdx) => (
                      <input
                        key={`${rIdx}-${cIdx}`}
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const copy = matrixStrA.map((r) => [...r]);
                          copy[rIdx][cIdx] = e.target.value;
                          setMatrixStrA(copy);
                        }}
                        className="w-11 h-11 text-center font-bold text-slate-800 border-2 border-indigo-100 rounded-lg focus:border-indigo-500 outline-none text-base sm:text-sm bg-white"
                      />
                    ))
                  )}
                </div>
                <span className="text-2xl font-light text-slate-400">]</span>
              </div>

              <span className="text-lg font-bold text-slate-400">×</span>

              {/* Vector X (Variables) */}
              <div className="flex items-center gap-1">
                <span className="text-2xl font-light text-slate-400">[</span>
                <div className="flex flex-col gap-2 p-2 bg-white rounded-xl shadow-sm border border-slate-200">
                  {system.variables.map((v) => (
                    <div
                      key={v}
                      className="w-11 h-11 flex items-center justify-center font-bold text-indigo-600 bg-indigo-50/80 rounded-lg border border-indigo-100 text-sm"
                    >
                      {v}
                    </div>
                  ))}
                </div>
                <span className="text-2xl font-light text-slate-400">]</span>
              </div>

              <span className="text-lg font-bold text-slate-400">=</span>

              {/* Vector B Input */}
              <div className="flex items-center gap-2">
                <span className="text-2xl font-light text-slate-400">[</span>
                <div className="flex flex-col gap-2 p-2 bg-white rounded-xl shadow-sm border border-slate-200">
                  {vectorStrB.map((val, bIdx) => (
                    <input
                      key={bIdx}
                      type="text"
                      value={val}
                      onChange={(e) => {
                        const copy = [...vectorStrB];
                        copy[bIdx] = e.target.value;
                        setVectorStrB(copy);
                      }}
                      className="w-11 h-11 text-center font-bold text-slate-800 border-2 border-indigo-100 rounded-lg focus:border-indigo-500 outline-none text-base sm:text-sm bg-white"
                    />
                  ))}
                </div>
                <span className="text-2xl font-light text-slate-400">]</span>
              </div>
            </div>

            {/* Live System Equations & Augmented Format */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500">รูปแบบสมการ:</span>
                <SystemDisplay A={system.A} B={system.B} variables={system.variables} className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg" />
              </div>

              {/* Solution Status Banner */}
              <div className="flex items-center gap-2">
                {summary.type === 'unique' && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    มีคำตอบเดียว ({summary.solution?.map((s) => formatFractionOrDec(s)).join(', ')})
                  </span>
                )}
                {summary.type === 'no_solution' && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-lg border border-rose-200">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    ระบบสมการไม่มีคำตอบ
                  </span>
                )}
                {summary.type === 'infinite_solutions' && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                    <Info className="w-3.5 h-3.5 text-amber-600" />
                    มีคำตอบไม่จำกัดจำนวน
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Learning Mode Toggle — sits directly under the example matrix display so students
              see it right where they're already looking, instead of buried in the top toolbar. */}
          <button
            onClick={() => setLearningMode(!learningMode)}
            className={`self-start px-3 py-1.5 min-h-11 sm:min-h-0 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
              learningMode
                ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-sm'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            {learningMode ? 'โหมดโต้ตอบ Active' : 'เปิดโหมดโต้ตอบ'}
          </button>

          {/* Interactive Learning Mode & Hint Box (if enabled) */}
          {learningMode && (
            <div className="bg-amber-50/80 rounded-2xl border border-amber-200 p-4 shadow-sm relative">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  คำถามกระตุ้นการคิด (Learning Mode)
                </h4>
                {settings.enableHints && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setHintLevel((prev) => Math.min(prev + 1, hintsList.length))}
                      className="px-2.5 py-1 min-h-11 sm:min-h-0 bg-white hover:bg-amber-100 text-amber-800 text-xs sm:text-[11px] font-bold rounded-lg border border-amber-300 transition-colors shadow-2xs"
                    >
                      💡 ขอคำใบ้ ({hintLevel}/{hintsList.length})
                    </button>
                  </div>
                )}
              </div>

              <p className="text-xs text-amber-900 font-medium mb-3">
                ในการแก้ระบบสมการด้วยวิธี {activeTab.toUpperCase()} สิ่งแรกที่คุณต้องตรวจสอบคืออะไร?
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  { id: 'A', text: 'หาค่า Determinant det(A) ก่อนเสมอ' },
                  { id: 'B', text: 'คูณ B ด้วย A ทันที' },
                  { id: 'C', text: 'สลับตำแหน่ง x และ y' },
                  { id: 'D', text: 'ไม่สามารถสรุปได้' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setLearningAnswer(opt.id);
                      if (opt.id === 'A') {
                        setLearningFeedback('✓ ถูกต้องที่สุดครับ! ต้องหา det(A) ก่อนเพื่อเช็คว่า det(A) ≠ 0 หรือไม่');
                      } else {
                        setLearningFeedback('ยังไม่ถูกต้องครับ ลองคิดดูว่าเราจะรู้ได้อย่างไรว่าเมทริกซ์มี Inverse หรือไม่?');
                      }
                    }}
                    className={`p-2.5 min-h-11 sm:min-h-0 rounded-xl border text-left font-medium transition-all ${
                      learningAnswer === opt.id
                        ? opt.id === 'A'
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold'
                          : 'bg-rose-100 border-rose-400 text-rose-900 font-bold'
                        : 'bg-white border-amber-200/80 text-amber-950 hover:bg-amber-100/50'
                    }`}
                  >
                    <span className="font-bold mr-2">{opt.id}.</span> {opt.text}
                  </button>
                ))}
              </div>

              {learningFeedback && (
                <div className="mt-3 p-2.5 bg-white/90 rounded-xl border border-amber-300 text-xs font-semibold text-amber-900">
                  {learningFeedback}
                </div>
              )}

              {hintLevel > 0 && (
                <div className="mt-3 space-y-1 bg-amber-100/80 p-2.5 rounded-xl border border-amber-200 text-xs text-amber-900">
                  {hintsList.slice(0, hintLevel).map((h, i) => (
                    <p key={i} className="font-medium">
                      • {h}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Solver Tabs & Method Selection */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div className="grid grid-cols-2 w-full sm:w-auto sm:flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                {[
                  { id: 'inverse', label: '1. Matrix Inverse' },
                  { id: 'cramer', label: "2. Cramer's Rule" },
                  { id: 'gauss', label: '3. Gauss Elimination' },
                  { id: 'compare', label: '📊 เปรียบเทียบ 3 วิธี' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      if (tab.id !== 'compare') recordMethodUse(tab.id as SolvingMethod);
                    }}
                    className={`px-3 py-1.5 min-h-11 sm:min-h-0 rounded-lg text-xs font-bold transition-all ${
                      activeTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <span className="text-xs text-slate-400 font-medium">เลือกวิธีเพื่อดูขั้นตอนทีละ Step</span>
            </div>

            {justEarnedVersatileBadge && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 animate-fade-in">
                🧩 ได้รับตรา "ผู้เชี่ยวชาญรอบด้าน" — ทดลองแก้ระบบสมการครบทั้ง 3 วิธีแล้ว! ทุกวิธีให้คำตอบเดียวกัน
                เลือกใช้วิธีที่เหมาะกับโจทย์ได้เลย
              </div>
            )}

            {/* TAB 1: INVERSE METHOD */}
            {activeTab === 'inverse' && (
              <div className="space-y-4">
                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs text-indigo-900">
                  <p className="font-bold">แนวคิดหลัก (Inverse Method):</p>
                  <p>
                    <RenderTextWithMath text={INVERSE_CONCEPT_TEXT} />
                  </p>
                </div>

                <ModeToggle
                  label="โหมดวิธี Inverse:"
                  mode={inverseMode}
                  onChange={setInverseMode}
                  autoLabel="ดูขั้นตอน (Walkthrough)"
                  manualLabel="ทำด้วยตนเอง (Practice)"
                />

                {inverseMode === 'manual' ? (
                  <div className="space-y-3">
                    <InversePractice
                      key={systemKey}
                      A={system.A}
                      B={system.B}
                      onComplete={() => handlePracticeComplete('inverse')}
                    />
                    {renderPracticeDone('inverse')}
                  </div>
                ) : !inverseData.hasInverse ? (
                  <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-xs font-medium">
                    ⚠️ det(A) = 0 เมทริกซ์นี้ไม่มีตัวผกผัน (Inverse) จึงไม่สามารถใช้วิธี Matrix Inverse Method ได้
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inverseData.steps.map((st) => {
                      const isActive = expandedStep === st.stepNumber;
                      return (
                      <div
                        key={st.stepNumber}
                        className={`border rounded-xl overflow-hidden transition-all ${
                          isActive ? 'border-indigo-300 bg-indigo-50/60 shadow-sm' : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <button
                          onClick={() => {
                            setExpandedStep(expandedStep === st.stepNumber ? null : st.stepNumber);
                            recordMethodUse('inverse');
                          }}
                          className={`w-full px-4 py-3 min-h-11 sm:min-h-0 gap-2 flex items-center justify-between text-left transition-colors ${
                            isActive ? 'bg-indigo-100/70 hover:bg-indigo-100' : 'bg-white hover:bg-slate-50'
                          }`}
                        >
                          <span className={isActive ? 'text-sm font-black text-indigo-900' : 'text-xs font-bold text-slate-800'}>
                            {st.title}
                          </span>
                          {isActive ? (
                            <ChevronUp className="w-4 h-4 text-indigo-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {expandedStep === st.stepNumber && (
                          <div className="p-4 border-t border-indigo-100 bg-white text-xs space-y-3">
                            <p className="text-sm text-slate-700 leading-relaxed font-medium">{st.description}</p>

                            {st.formulaText && (
                              <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 font-mono font-bold text-indigo-800 text-center text-sm">
                                {st.formulaText}
                              </div>
                            )}

                            {st.matrixState && (
                              <div className="flex justify-center my-2">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 inline-flex flex-col items-center">
                                  <div
                                    className="grid gap-2"
                                    style={{
                                      gridTemplateColumns: `repeat(${st.matrixState[0].length}, minmax(0, 1fr))`,
                                    }}
                                  >
                                    {st.matrixState.map((r, ri) =>
                                      r.map((val, ci) => (
                                        <div
                                          key={`${ri}-${ci}`}
                                          className="w-10 h-10 flex items-center justify-center font-bold text-slate-800 bg-white rounded-lg border border-slate-200 text-xs"
                                        >
                                          {formatFractionOrDec(val)}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CRAMER'S RULE */}
            {activeTab === 'cramer' && (
              <div className="space-y-4">
                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs text-indigo-900">
                  <p className="font-bold">แนวคิดหลัก (Cramer's Rule):</p>
                  <p>
                    <RenderTextWithMath text={CRAMER_CONCEPT_TEXT} />
                  </p>
                </div>

                <ModeToggle
                  label="โหมดกฎของคราเมอร์:"
                  mode={cramerMode}
                  onChange={setCramerMode}
                  autoLabel="ดูผลลัพธ์ (Walkthrough)"
                  manualLabel="ทำด้วยตนเอง (Practice)"
                />

                {cramerMode === 'manual' ? (
                  <div className="space-y-3">
                    <CramerPractice
                      key={systemKey}
                      A={system.A}
                      B={system.B}
                      variables={system.variables}
                      onComplete={() => handlePracticeComplete('cramer')}
                    />
                    {renderPracticeDone('cramer')}
                  </div>
                ) : cramerData.detD === 0 ? (
                  <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-xs font-medium">
                    ⚠️ D = det(A) = 0 ไม่สามารถใช้ Cramer's Rule ในการหาคำตอบชุดเดียวได้
                  </div>
                ) : (
                  <div>
                    {/* Select Matrix to view D, Dx, Dy, Dz */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(['D', 'Dx', 'Dy', ...(dimension === '3x3' ? ['Dz'] : [])] as const).map((mKey) => (
                        <button
                          key={mKey}
                          onClick={() => setCramerSelectedMat(mKey)}
                          className={`px-4 py-2 min-h-11 sm:min-h-0 rounded-xl text-xs font-bold transition-all border ${
                            cramerSelectedMat === mKey
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          [{mKey}] Matrix
                        </button>
                      ))}
                    </div>

                    {/* Display Selected Cramer Matrix with highlighted column */}
                    <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-4">
                      <p className="text-xs font-bold text-slate-700">
                        แสดงเมทริกซ์ [{cramerSelectedMat}]
                        {cramerSelectedMat !== 'D' && (
                          <span className="text-indigo-600 ml-1">(เน้นคอลัมน์ที่ถูกแทนที่ด้วยเวกเตอร์ B)</span>
                        )}
                      </p>

                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-light text-slate-300">|</span>
                        <div
                          className="grid gap-2 p-3 bg-white rounded-xl shadow-sm border border-slate-200"
                          style={{
                            gridTemplateColumns: `repeat(${dimension === '2x2' ? 2 : 3}, minmax(0, 1fr))`,
                          }}
                        >
                          {(() => {
                            let activeMat: number[][] = cramerData.matrixD;
                            if (cramerSelectedMat === 'Dx') activeMat = cramerData.matrixDx;
                            if (cramerSelectedMat === 'Dy') activeMat = cramerData.matrixDy;
                            if (cramerSelectedMat === 'Dz' && cramerData.matrixDz) activeMat = cramerData.matrixDz;

                            const replacedColIdx =
                              cramerSelectedMat === 'Dx'
                                ? 0
                                : cramerSelectedMat === 'Dy'
                                ? 1
                                : cramerSelectedMat === 'Dz'
                                ? 2
                                : -1;

                            return activeMat.map((r, ri) =>
                              r.map((val, ci) => (
                                <div
                                  key={`${ri}-${ci}`}
                                  className={`w-12 h-12 flex items-center justify-center font-bold text-sm rounded-lg border transition-all ${
                                    ci === replacedColIdx
                                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm animate-pulse'
                                      : 'bg-slate-50 text-slate-800 border-slate-200'
                                  }`}
                                >
                                  {val}
                                </div>
                              ))
                            );
                          })()}
                        </div>
                        <span className="text-3xl font-light text-slate-300">|</span>
                      </div>

                      {/* Determinant & Value calculated */}
                      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-bold text-slate-800 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs">
                        <span>det(D) = {cramerData.detD}</span>
                        <span>•</span>
                        <span>det(Dx) = {cramerData.detDx}</span>
                        <span>•</span>
                        <span>det(Dy) = {cramerData.detDy}</span>
                        {cramerData.detDz !== undefined && (
                          <>
                            <span>•</span>
                            <span>det(Dz) = {cramerData.detDz}</span>
                          </>
                        )}
                      </div>

                      {/* Final Answers via Cramer */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-md mt-2">
                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                          <p className="text-xs sm:text-[10px] uppercase font-bold text-indigo-400">x = Dx / D</p>
                          <p className="text-lg font-black text-indigo-700">
                            {cramerData.x !== undefined ? formatFractionOrDec(cramerData.x) : '-'}
                          </p>
                        </div>
                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                          <p className="text-xs sm:text-[10px] uppercase font-bold text-indigo-400">y = Dy / D</p>
                          <p className="text-lg font-black text-indigo-700">
                            {cramerData.y !== undefined ? formatFractionOrDec(cramerData.y) : '-'}
                          </p>
                        </div>
                        {dimension === '3x3' && (
                          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                            <p className="text-xs sm:text-[10px] uppercase font-bold text-indigo-400">z = Dz / D</p>
                            <p className="text-lg font-black text-indigo-700">
                              {cramerData.z !== undefined ? formatFractionOrDec(cramerData.z) : '-'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: GAUSS ELIMINATION */}
            {activeTab === 'gauss' && (
              <div className="space-y-4">
                <ModeToggle
                  label="โหมดดำเนินการ Gauss:"
                  mode={gaussMode}
                  onChange={setGaussMode}
                  autoLabel="อัตโนมัติ (Simulation)"
                  manualLabel="ทำด้วยตนเอง (Manual Ops)"
                />

                {gaussMode === 'auto' ? (
                  <div className="space-y-3">
                    {gaussSteps.map((gs) => (
                      <div key={gs.stepIndex} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                            Step {gs.stepIndex}
                          </span>
                          <span className="text-slate-500 font-medium"><RenderTextWithMath text={gs.explanation} /></span>
                        </div>
                        <GaussStepDisplay step={gs} />
                      </div>
                    ))}
                  </div>
                ) : (
                  /* MANUAL ROW OPERATIONS MODE */
                  <div className="space-y-4 bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <h4 className="font-bold text-slate-800">เครื่องมือทดลองดำเนินการตามแถว (Elementary Row Operations)</h4>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleUndoManualOp}
                          disabled={manualHistory.length === 0}
                          className="min-h-11 sm:min-h-0 text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-indigo-600"
                        >
                          <Undo2 className="w-3.5 h-3.5" /> ย้อนกลับ (Undo)
                        </button>
                        <button
                          onClick={handleResetManualGauss}
                          className="min-h-11 sm:min-h-0 text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> รีเซ็ต
                        </button>
                      </div>
                    </div>

                    {/* Full history of every operation applied so far this session, each as its
                        own before -> operation -> after row (or just the starting matrix if no
                        operation has been applied yet) — not just the latest one, so the student
                        can see the whole sequence of steps they've taken. */}
                    <div className="space-y-2">
                      {manualDisplaySteps.map((step) => (
                        <div key={step.stepIndex} className="space-y-1">
                          {step.stepIndex > 0 && (
                            <span className="font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100 text-xs">
                              ขั้นที่ {step.stepIndex}
                            </span>
                          )}
                          <GaussStepDisplay step={step} />
                        </div>
                      ))}
                    </div>

                    {isManualGaussComplete ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold text-center">
                        ✓ ลดรูปครบถ้วนแล้ว! เมทริกซ์อยู่ในรูป Reduced Row Echelon Form
                        {justEarnedLabXp && <span> — ได้รับ +{LAB_WALKTHROUGH_XP} XP!</span>}
                      </div>
                    ) : manualFeedback?.isCorrect ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                        <p className="font-bold text-emerald-800">{manualFeedback.message}</p>
                        <button
                          onClick={() => setManualFeedback(null)}
                          className="px-4 py-1.5 min-h-11 sm:min-h-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-2xs transition-colors flex items-center gap-1.5"
                        >
                          ทำขั้นตอนถัดไป <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      /* Row Operation Builder */
                      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                          <label className="font-bold text-slate-700">ชนิดการดำเนินการ:</label>
                          <select
                            value={opType}
                            onChange={(e) => setOpType(e.target.value as any)}
                            className="w-full sm:w-auto p-1.5 min-h-11 sm:min-h-0 border border-slate-200 rounded-lg text-base sm:text-xs font-semibold outline-none"
                          >
                            <option value="swap">สลับแถว (Ri ↔ Rj)</option>
                            <option value="multiply">คูณด้วยค่าคงที่ (Ri → kRi)</option>
                            <option value="add">บวกด้วยพหุคูณแถวอื่น (Ri → Ri + kRj)</option>
                          </select>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-slate-600">แถวเป้าหมาย (Ri):</span>
                            <select
                              value={opRow1}
                              onChange={(e) => setOpRow1(parseInt(e.target.value))}
                              className="p-1.5 min-h-11 sm:min-h-0 border border-slate-200 rounded-lg text-base sm:text-xs font-bold"
                            >
                              {currentManualAug.map((_, idx) => (
                                <option key={idx} value={idx}>
                                  R{idx + 1}
                                </option>
                              ))}
                            </select>
                          </div>

                          {opType !== 'multiply' && (
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-slate-600">แถวอ้างอิง (Rj):</span>
                              <select
                                value={opRow2}
                                onChange={(e) => setOpRow2(parseInt(e.target.value))}
                                className="p-1.5 min-h-11 sm:min-h-0 border border-slate-200 rounded-lg text-base sm:text-xs font-bold"
                              >
                                {currentManualAug.map((_, idx) => (
                                  <option key={idx} value={idx}>
                                    R{idx + 1}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {opType !== 'swap' && (
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-slate-600">ตัวคูณ (k):</span>
                              <input
                                type="text"
                                value={opK}
                                onChange={(e) => setOpK(e.target.value)}
                                placeholder="เช่น 0.5 หรือ -1/2"
                                className="w-28 sm:w-24 p-1.5 min-h-11 sm:min-h-0 border border-slate-200 rounded-lg text-base sm:text-xs font-bold text-center"
                              />
                            </div>
                          )}

                          <button
                            onClick={handleApplyManualOp}
                            className="w-full sm:w-auto px-4 py-1.5 min-h-11 sm:min-h-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-2xs transition-colors sm:ml-auto"
                          >
                            คำนวณขั้นแถว
                          </button>
                        </div>

                        {manualFeedback && !manualFeedback.isCorrect && (
                          <div className="p-2.5 rounded-lg font-bold text-xs bg-rose-50 text-rose-800 border border-rose-200">
                            {manualFeedback.message}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: METHOD COMPARISON */}
            {activeTab === 'compare' && (
              <div className="space-y-4">
                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs text-indigo-900">
                  <p className="font-bold">ตารางเปรียบเทียบ 3 วิธีแก้ระบบสมการเชิงเส้น:</p>
                  <p>ช่วยให้ผู้เรียนเข้าใจว่าทุกวิธีได้คำตอบเดียวกัน แต่มีความเหมาะสมและขั้นตอนต่างกัน</p>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs bg-white">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Method (วิธี)</th>
                        <th className="p-3">Determinant Requirement</th>
                        <th className="p-3">Calculated Result</th>
                        <th className="p-3">Steps Required</th>
                        <th className="p-3">ความเหมาะสม (Suitability)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      <tr>
                        <td className="p-3 font-bold text-indigo-600">1. Matrix Inverse</td>
                        <td className="p-3">det(A) ≠ 0 ({summary.determinant})</td>
                        <td className="p-3 font-bold">
                          {summary.solution ? summary.solution.map((s) => formatFractionOrDec(s)).join(', ') : 'ไม่มี'}
                        </td>
                        <td className="p-3">{inverseData.steps.length} ขั้นตอน</td>
                        <td className="p-3 text-slate-500">เหมาะกับเมทริกซ์ 2x2 หรือระบบที่มี B เปลี่ยนไปเรื่อยๆ</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-indigo-600">2. Cramer's Rule</td>
                        <td className="p-3">det(A) ≠ 0 ({cramerData.detD})</td>
                        <td className="p-3 font-bold">
                          {cramerData.x !== undefined ? `${cramerData.x}, ${cramerData.y}` : 'ไม่มี'}
                        </td>
                        <td className="p-3">{dimension === '2x2' ? '3 Determinants' : '4 Determinants'}</td>
                        <td className="p-3 text-slate-500">เหมาะกับการหาค่าตัวแปรเฉพาะตัวใดตัวหนึ่งเร็วๆ</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-indigo-600">3. Gauss Elimination</td>
                        <td className="p-3">ใช้ได้ทุกกรณี (แม้ det=0)</td>
                        <td className="p-3 font-bold">
                          {summary.solution ? summary.solution.map((s) => formatFractionOrDec(s)).join(', ') : 'ไม่มี'}
                        </td>
                        <td className="p-3">{gaussSteps.length} ขั้นการลดรูป</td>
                        <td className="p-3 text-slate-500">ยืดหยุ่นที่สุด รองรับระบบสมการขนาดใหญ่ และเช็คไร้คำตอบได้</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Verification Box - Substitute solutions into equations */}
          {showVerificationBox && summary.verifications && summary.verifications.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                การตรวจคำตอบย้อนกลับ (Final Answer Substitution Verification)
              </h3>
              <div className="space-y-2">
                {summary.verifications.map((v, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs"
                  >
                    <span className="font-mono font-medium text-slate-700">
                      สมการ {idx + 1}: {v.equationText}
                    </span>
                    <span className="font-mono font-bold text-emerald-800">
                      แทนค่า: {v.substitutedText} ✓
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Gemini AI Math Tutor — entry point hidden entirely (not just
            disabled) when the teacher has turned off the AI tutor. */}
        {settings.enableAiTutor && (
          <div className="lg:col-span-4 h-[560px] lg:h-full min-h-[500px]">
            <GeminiTutor
              system={system}
              activeMethod={activeTab}
              detA={summary.determinant}
              solutionType={summary.type}
            />
          </div>
        )}
      </div>
    </div>
  );
}
