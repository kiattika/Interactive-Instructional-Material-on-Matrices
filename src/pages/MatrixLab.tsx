import { useState, useMemo } from 'react';
import {
  LinearSystem,
  SystemDimension,
  RowOperation,
} from '../types';
import {
  det,
  solveLinearSystem,
  getInverseSteps,
  getCramerSteps,
  getGaussSteps,
  applyRowOperation,
  formatFractionOrDec,
} from '../lib/matrixEngine';
import { GeminiTutor } from '../components/GeminiTutor';
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
  BookOpen,
  Info,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

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
  'app_circuit': {
    name: '⚡ ประยุกต์: วงจรไฟฟ้า 2 ลูป (Kirchhoff)',
    dimension: '2x2' as SystemDimension,
    A: [
      [6, -2],
      [-2, 8],
    ],
    B: [10, 4],
  },
  'app_cipher': {
    name: '🔐 ประยุกต์: ถอดรหัส Hill Cipher',
    dimension: '2x2' as SystemDimension,
    A: [
      [3, 5],
      [1, 2],
    ],
    B: [43, 16],
  },
  'app_mixing': {
    name: '🧪 ประยุกต์: ผสมสารละลาย 3 ชนิด',
    dimension: '3x3' as SystemDimension,
    A: [
      [1, 1, 1],
      [0.1, 0.2, 0.5],
      [-2, 0, 1],
    ],
    B: [100, 27, 0],
  },
};

export default function MatrixLab() {
  const [dimension, setDimension] = useState<SystemDimension>('2x2');
  const [matrixStrA, setMatrixStrA] = useState<string[][]>([
    ['2', '1'],
    ['1', '-1'],
  ]);
  const [vectorStrB, setVectorStrB] = useState<string[]>(['5', '1']);

  const [activeTab, setActiveTab] = useState<'inverse' | 'cramer' | 'gauss' | 'compare'>('inverse');
  const [cramerSelectedMat, setCramerSelectedMat] = useState<'D' | 'Dx' | 'Dy' | 'Dz'>('D');
  const [gaussMode, setGaussMode] = useState<'auto' | 'manual'>('auto');

  // Manual Gauss Operation State
  const [manualAug, setManualAug] = useState<number[][] | null>(null);
  const [opType, setOpType] = useState<'swap' | 'multiply' | 'add'>('add');
  const [opRow1, setOpRow1] = useState<number>(1);
  const [opRow2, setOpRow2] = useState<number>(0);
  const [opK, setOpK] = useState<string>('-2');
  const [manualFeedback, setManualFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);

  // Learning Mode & Hints
  const [learningMode, setLearningMode] = useState<boolean>(false);
  const [learningAnswer, setLearningAnswer] = useState<string | null>(null);
  const [learningFeedback, setLearningFeedback] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState<number>(0);

  // Expandable steps control
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  // Dimension Change Handler
  const handleDimensionChange = (newDim: SystemDimension) => {
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
    setManualAug(null);
    setManualFeedback(null);
  };

  // Load Preset
  const handleLoadPreset = (presetKey: keyof typeof PRESETS) => {
    const p = PRESETS[presetKey];
    setDimension(p.dimension);
    setMatrixStrA(p.A.map((r) => r.map((c) => c.toString())));
    setVectorStrB(p.B.map((c) => c.toString()));
    setManualAug(null);
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

  // Solvers calculation
  const summary = useMemo(() => solveLinearSystem(system), [system]);
  const inverseData = useMemo(() => getInverseSteps(system), [system]);
  const cramerData = useMemo(() => getCramerSteps(system), [system]);
  const gaussSteps = useMemo(() => getGaussSteps(system), [system]);

  // Initial manual augmented matrix
  const currentManualAug = useMemo(() => {
    if (manualAug) return manualAug;
    return system.A.map((r, i) => [...r, system.B[i]]);
  }, [manualAug, system]);

  // Handle Manual Row Operation
  const handleApplyManualOp = () => {
    const op: RowOperation = {
      type: opType,
      row1: opRow1,
      row2: opRow2,
      k: parseFloat(opK) || 1,
      description: '',
    };

    const res = applyRowOperation(currentManualAug, op);
    if (!res.isValid) {
      setManualFeedback({ isCorrect: false, message: res.errorMessage || 'การทำงานไม่ถูกต้อง' });
      return;
    }

    setManualAug(res.newMatrix);
    setManualFeedback({
      isCorrect: true,
      message: '✓ คำนวณถูกต้อง! เมทริกซ์แต่งเติมถูกปรับเปลี่ยนเรียบร้อย',
    });
  };

  const handleResetManualGauss = () => {
    setManualAug(null);
    setManualFeedback(null);
  };

  // Hints array
  const hintsList = [
    `คำใบ้ที่ 1: สำหรับระบบสมการนี้ det(A) มีค่าเท่ากับ ${det(system.A)}.`,
    `คำใบ้ที่ 2: หาก det(A) ≠ 0 แสดงว่าระบบสมการนี้มีคำตอบเดียว`,
    `คำใบ้ที่ 3: ใช้สูตร X = A⁻¹B หรือ x = Dx / D ในการหาคำตอบสุดท้าย`,
  ];

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Top Header & Presets Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Interactive Matrix Laboratory</h2>
          <p className="text-xs text-slate-500">ทดลอง แก้สมการ และวิเคราะห์ขั้นตอนด้วยเมทริกซ์</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Dimension Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => handleDimensionChange('2x2')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                dimension === '2x2' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2 × 2
            </button>
            <button
              onClick={() => handleDimensionChange('3x3')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                dimension === '3x3' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3 × 3
            </button>
          </div>

          {/* Quick Presets */}
          <select
            onChange={(e) => e.target.value && handleLoadPreset(e.target.value as any)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 outline-none focus:border-indigo-500"
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

          {/* Learning Mode Toggle */}
          <button
            onClick={() => setLearningMode(!learningMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
              learningMode
                ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-sm'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            {learningMode ? 'โหมดโต้ตอบ Active' : 'เปิดโหมดโต้ตอบ'}
          </button>
        </div>
      </div>

      {/* Main Bento Layout: Left = Matrix Editor & Solvers, Right = Gemini AI Tutor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-grow overflow-hidden">
        {/* Left Column (8 cols): Input Engine & Solver Tabs */}
        <div className="lg:col-span-8 flex flex-col gap-4 overflow-y-auto pr-1">
          {/* Matrix Input & Representation Bento Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>📐</span> Matrix Input Engine (AX = B)
              </h3>
              <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
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
                        className="w-11 h-11 text-center font-bold text-slate-800 border-2 border-indigo-100 rounded-lg focus:border-indigo-500 outline-none text-sm bg-white"
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
                      className="w-11 h-11 text-center font-bold text-slate-800 border-2 border-indigo-100 rounded-lg focus:border-indigo-500 outline-none text-sm bg-white"
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

          {/* Interactive Learning Mode & Hint Box (if enabled) */}
          {learningMode && (
            <div className="bg-amber-50/80 rounded-2xl border border-amber-200 p-4 shadow-sm relative">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  คำถามกระตุ้นการคิด (Learning Mode)
                </h4>
                <div className="flex gap-1">
                  <button
                    onClick={() => setHintLevel((prev) => Math.min(prev + 1, hintsList.length))}
                    className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-300 transition-colors shadow-2xs"
                  >
                    💡 ขอคำใบ้ ({hintLevel}/{hintsList.length})
                  </button>
                </div>
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
                    className={`p-2.5 rounded-xl border text-left font-medium transition-all ${
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
              <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                {[
                  { id: 'inverse', label: '1. Matrix Inverse' },
                  { id: 'cramer', label: "2. Cramer's Rule" },
                  { id: 'gauss', label: '3. Gauss Elimination' },
                  { id: 'compare', label: '📊 เปรียบเทียบ 3 วิธี' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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

            {/* TAB 1: INVERSE METHOD */}
            {activeTab === 'inverse' && (
              <div className="space-y-4">
                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs text-indigo-900">
                  <p className="font-bold">แนวคิดหลัก (Inverse Method):</p>
                  <p>
                    จาก $AX = B$ คูณด้วย $A^{-1}$ ทางซ้าย จะได้ $X = A^{-1}B$ (เงื่อนไขสำคัญ: $det(A) \neq 0$)
                  </p>
                </div>

                {!inverseData.hasInverse ? (
                  <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-xs font-medium">
                    ⚠️ det(A) = 0 เมทริกซ์นี้ไม่มีตัวผกผัน (Inverse) จึงไม่สามารถใช้วิธี Matrix Inverse Method ได้
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inverseData.steps.map((st) => (
                      <div
                        key={st.stepNumber}
                        className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50"
                      >
                        <button
                          onClick={() => setExpandedStep(expandedStep === st.stepNumber ? null : st.stepNumber)}
                          className="w-full px-4 py-3 bg-white hover:bg-slate-50 flex items-center justify-between text-left transition-colors"
                        >
                          <span className="text-xs font-bold text-slate-800">{st.title}</span>
                          {expandedStep === st.stepNumber ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {expandedStep === st.stepNumber && (
                          <div className="p-4 border-t border-slate-100 bg-white text-xs space-y-3">
                            <p className="text-slate-600 leading-relaxed">{st.description}</p>

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
                    ))}
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
                    คำนวณ $D = det(A)$ และแทนคอลัมน์ของตัวแปรด้วยเวกเตอร์ $B$ เพื่อหา $D_x, D_y, D_z$ แล้วใช้ $x =
                    D_x/D$, $y = D_y/D$, $z = D_z/D$
                  </p>
                </div>

                {cramerData.detD === 0 ? (
                  <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-xs font-medium">
                    ⚠️ D = det(A) = 0 ไม่สามารถใช้ Cramer's Rule ในการหาคำตอบชุดเดียวได้
                  </div>
                ) : (
                  <div>
                    {/* Select Matrix to view D, Dx, Dy, Dz */}
                    <div className="flex gap-2 mb-4">
                      {(['D', 'Dx', 'Dy', ...(dimension === '3x3' ? ['Dz'] : [])] as const).map((mKey) => (
                        <button
                          key={mKey}
                          onClick={() => setCramerSelectedMat(mKey)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
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
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-4">
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
                      <div className="flex items-center gap-4 text-xs font-bold text-slate-800 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs">
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
                          <p className="text-[10px] uppercase font-bold text-indigo-400">x = Dx / D</p>
                          <p className="text-lg font-black text-indigo-700">
                            {cramerData.x !== undefined ? formatFractionOrDec(cramerData.x) : '-'}
                          </p>
                        </div>
                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                          <p className="text-[10px] uppercase font-bold text-indigo-400">y = Dy / D</p>
                          <p className="text-lg font-black text-indigo-700">
                            {cramerData.y !== undefined ? formatFractionOrDec(cramerData.y) : '-'}
                          </p>
                        </div>
                        {dimension === '3x3' && (
                          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                            <p className="text-[10px] uppercase font-bold text-indigo-400">z = Dz / D</p>
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
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-700 px-2">โหมดดำเนินการ Gauss:</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setGaussMode('auto')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        gaussMode === 'auto'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      อัตโนมัติ (Simulation)
                    </button>
                    <button
                      onClick={() => setGaussMode('manual')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        gaussMode === 'manual'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ทำด้วยตนเอง (Manual Ops)
                    </button>
                  </div>
                </div>

                {gaussMode === 'auto' ? (
                  <div className="space-y-3">
                    {gaussSteps.map((gs) => (
                      <div key={gs.stepIndex} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                            Step {gs.stepIndex}: {gs.operationPerformed}
                          </span>
                          <span className="text-slate-500 font-medium">{gs.explanation}</span>
                        </div>

                        {/* Augmented Matrix View */}
                        <div className="flex justify-center py-2">
                          <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200 inline-flex items-center gap-3">
                            <span className="text-2xl font-light text-slate-300">[</span>
                            <div
                              className="grid gap-2"
                              style={{
                                gridTemplateColumns: `repeat(${gs.augmentedMatrix[0].length}, minmax(0, 1fr))`,
                              }}
                            >
                              {gs.augmentedMatrix.map((r, ri) =>
                                r.map((val, ci) => (
                                  <div
                                    key={`${ri}-${ci}`}
                                    className={`w-10 h-10 flex items-center justify-center font-bold text-xs rounded-lg border ${
                                      ci === gs.augmentedMatrix[0].length - 1
                                        ? 'bg-amber-50 text-amber-900 border-amber-200 font-black'
                                        : 'bg-slate-50 text-slate-800 border-slate-200'
                                    }`}
                                  >
                                    {formatFractionOrDec(val)}
                                  </div>
                                ))
                              )}
                            </div>
                            <span className="text-2xl font-light text-slate-300">]</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* MANUAL ROW OPERATIONS MODE */
                  <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-800">เครื่องมือทดลองดำเนินการตามแถว (Elementary Row Operations)</h4>
                      <button
                        onClick={handleResetManualGauss}
                        className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> รีเซ็ต
                      </button>
                    </div>

                    {/* Current Manual Augmented Matrix */}
                    <div className="flex justify-center my-2">
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm inline-flex items-center gap-3">
                        <span className="text-3xl font-light text-slate-300">[</span>
                        <div
                          className="grid gap-2"
                          style={{
                            gridTemplateColumns: `repeat(${currentManualAug[0].length}, minmax(0, 1fr))`,
                          }}
                        >
                          {currentManualAug.map((r, ri) =>
                            r.map((val, ci) => (
                              <div
                                key={`${ri}-${ci}`}
                                className={`w-12 h-12 flex items-center justify-center font-bold text-sm rounded-xl border ${
                                  ci === currentManualAug[0].length - 1
                                    ? 'bg-amber-50 text-amber-900 border-amber-200 font-black'
                                    : 'bg-slate-50 text-slate-800 border-slate-200'
                                }`}
                              >
                                {formatFractionOrDec(val)}
                              </div>
                            ))
                          )}
                        </div>
                        <span className="text-3xl font-light text-slate-300">]</span>
                      </div>
                    </div>

                    {/* Row Operation Builders */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center gap-4">
                        <label className="font-bold text-slate-700">ชนิดการดำเนินการ:</label>
                        <select
                          value={opType}
                          onChange={(e) => setOpType(e.target.value as any)}
                          className="p-1.5 border border-slate-200 rounded-lg text-xs font-semibold outline-none"
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
                            className="p-1.5 border border-slate-200 rounded-lg text-xs font-bold"
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
                              className="p-1.5 border border-slate-200 rounded-lg text-xs font-bold"
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
                              className="w-16 p-1.5 border border-slate-200 rounded-lg text-xs font-bold text-center"
                            />
                          </div>
                        )}

                        <button
                          onClick={handleApplyManualOp}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-2xs transition-colors ml-auto"
                        >
                          คำนวณขั้นแถว
                        </button>
                      </div>

                      {manualFeedback && (
                        <div
                          className={`p-2.5 rounded-lg font-bold text-xs ${
                            manualFeedback.isCorrect
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {manualFeedback.message}
                        </div>
                      )}
                    </div>
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
          {summary.verifications && summary.verifications.length > 0 && (
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

        {/* Right Column (4 cols): Gemini AI Math Tutor */}
        <div className="lg:col-span-4 h-full min-h-[500px]">
          <GeminiTutor
            system={system}
            activeMethod={activeTab}
            detA={summary.determinant}
            solutionType={summary.type}
          />
        </div>
      </div>
    </div>
  );
}
