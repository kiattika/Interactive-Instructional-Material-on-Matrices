import { useState, useMemo } from 'react';
import { generateExercises, solveLinearSystem, formatFractionOrDec } from '../lib/matrixEngine';
import { ENGINEERING_ICT_PROBLEMS } from '../lib/engineeringProblems';
import { ExerciseQuestion, ApplicationField } from '../types';
import { CheckCircle2, XCircle, HelpCircle, Trophy, Sparkles, RefreshCw, Award, Cpu, Cog, Eye, Lightbulb } from 'lucide-react';
import { RenderTextWithMath } from '../components/math/MathComponents';

export default function Exercises() {
  const [tab, setTab] = useState<'mcq' | 'applied'>('mcq');
  const [appliedFilter, setAppliedFilter] = useState<ApplicationField | 'all'>('all');
  const [revealedApplied, setRevealedApplied] = useState<Record<string, boolean>>({});
  const [questions, setQuestions] = useState<ExerciseQuestion[]>(generateExercises);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All');
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [hintsVisible, setHintsVisible] = useState<Record<string, number>>({});
  const [score, setScore] = useState<number>(1250);

  const filteredQuestions = useMemo(() => {
    if (activeFilter === 'All') return questions;
    return questions.filter((q) => q.difficulty === activeFilter);
  }, [questions, activeFilter]);

  const filteredApplied = useMemo(() => {
    if (appliedFilter === 'all') return ENGINEERING_ICT_PROBLEMS;
    return ENGINEERING_ICT_PROBLEMS.filter((p) => p.field === appliedFilter);
  }, [appliedFilter]);

  const handleToggleReveal = (id: string) => {
    setRevealedApplied((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectAnswer = (qId: string, answer: string) => {
    if (submitted[qId]) return;
    setUserAnswers((prev) => ({ ...prev, [qId]: answer }));
  };

  const handleSubmitAnswer = (qId: string) => {
    if (!userAnswers[qId] || submitted[qId]) return;
    setSubmitted((prev) => ({ ...prev, [qId]: true }));

    const q = questions.find((item) => item.id === qId);
    if (q && userAnswers[qId] === q.correctAnswer) {
      setScore((prev) => prev + 25);
    }
  };

  const handleToggleHint = (qId: string) => {
    setHintsVisible((prev) => ({
      ...prev,
      [qId]: ((prev[qId] || 0) % 3) + 1,
    }));
  };

  const handleRefreshQuestions = () => {
    setQuestions(generateExercises());
    setUserAnswers({});
    setSubmitted({});
    setHintsVisible({});
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Score Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">ระบบแบบฝึกหัดทบทวน (Matrix Practice)</h2>
          <p className="text-sm text-slate-500 mt-1">
            ฝึกสุ่มแก้โจทย์ ตรวจคำตอบอัตโนมัติ และสะสมคะแนน XP
          </p>
        </div>

        <div className="flex items-center gap-4 bg-indigo-50 border border-indigo-100 p-3 rounded-xl">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-indigo-400">Total XP Score</p>
            <p className="text-xl font-black text-indigo-900">{score} XP</p>
          </div>
        </div>
      </div>

      {/* Mode Tabs: MCQ vs Applied Engineering/ICT Problems */}
      <div className="flex bg-slate-200/60 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('mcq')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            tab === 'mcq' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="w-3.5 h-3.5" /> แบบฝึกหัดปรนัย
        </button>
        <button
          onClick={() => setTab('applied')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            tab === 'applied' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Cog className="w-3.5 h-3.5" /> โจทย์ประยุกต์วิศวกรรม/ICT
        </button>
      </div>

      {tab === 'mcq' ? (
      <>
      {/* Filter Tabs & Refresh */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex bg-slate-200/60 p-1 rounded-xl">
          {(['All', 'Easy', 'Medium', 'Hard'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setActiveFilter(lvl)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeFilter === lvl
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lvl === 'All' ? 'ทั้งหมด' : `ระดับ ${lvl}`}
            </button>
          ))}
        </div>

        <button
          onClick={handleRefreshQuestions}
          className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-colors shadow-2xs flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5 text-indigo-600" /> สุ่มชุดแบบฝึกหัดใหม่
        </button>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {filteredQuestions.map((q, idx) => {
          const isDone = submitted[q.id];
          const isCorrect = isDone && userAnswers[q.id] === q.correctAnswer;
          const currentHintLevel = hintsVisible[q.id] || 0;

          return (
            <div
              key={q.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 transition-all"
            >
              {/* Question Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">ข้อ {idx + 1}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      q.difficulty === 'Easy'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : q.difficulty === 'Medium'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {q.difficulty}
                  </span>
                  <span className="text-xs font-semibold text-slate-700">{q.title}</span>
                </div>

                <button
                  onClick={() => handleToggleHint(q.id)}
                  className="text-amber-600 hover:text-amber-800 text-xs font-bold flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200"
                >
                  💡 คำใบ้ ({currentHintLevel}/3)
                </button>
              </div>

              {/* Question Body */}
              <div className="text-sm font-bold text-slate-800 leading-relaxed">
                <RenderTextWithMath text={q.instruction} />
              </div>

              {/* Multiple Choice Options */}
              {q.options && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleSelectAnswer(q.id, opt)}
                      disabled={isDone}
                      className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                        userAnswers[q.id] === opt
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <RenderTextWithMath text={opt} />
                    </button>
                  ))}
                </div>
              )}

              {/* Hints Box */}
              {currentHintLevel > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1">
                  {q.hints.slice(0, currentHintLevel).map((h, i) => (
                    <p key={i} className="text-amber-900 font-medium">
                      • <RenderTextWithMath text={h} />
                    </p>
                  ))}
                </div>
              )}

              {/* Action & Explanation */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                {!isDone ? (
                  <button
                    onClick={() => handleSubmitAnswer(q.id)}
                    disabled={!userAnswers[q.id]}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors ml-auto"
                  >
                    ส่งคำตอบ
                  </button>
                ) : (
                  <div className="w-full space-y-2">
                    <div
                      className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                        isCorrect
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {isCorrect ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          คำตอบถูกต้อง! คุณได้รับ +25 XP
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-rose-600" />
                          ยังไม่ถูกต้อง คำตอบที่ถูกต้องคือ: <RenderTextWithMath text={q.correctAnswer} />
                        </>
                      )}
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
                      <p className="font-bold text-slate-800 mb-1">คำอธิบายวิธีทำ:</p>
                      <p><RenderTextWithMath text={q.explanation} /></p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </>
      ) : (
        <>
        {/* Applied Problems Filter */}
        <div className="flex bg-slate-200/60 p-1 rounded-xl w-fit">
          {(['all', 'engineering', 'ict'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setAppliedFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                appliedFilter === f ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f === 'all' && 'ทั้งหมด'}
              {f === 'engineering' && (<><Cog className="w-3.5 h-3.5" /> วิศวกรรม</>)}
              {f === 'ict' && (<><Cpu className="w-3.5 h-3.5" /> ไอซีที</>)}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filteredApplied.map((problem) => {
            const revealed = revealedApplied[problem.id];
            const summary = solveLinearSystem(problem.system);
            return (
              <div key={problem.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                      problem.field === 'engineering'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-teal-50 text-teal-700 border-teal-200'
                    }`}
                  >
                    {problem.fieldLabel}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      problem.difficulty === 'Easy'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : problem.difficulty === 'Medium'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {problem.difficulty}
                  </span>
                  <span className="text-xs font-bold text-slate-800">{problem.title}</span>
                </div>

                <div className="text-sm text-slate-800 leading-relaxed">
                  <RenderTextWithMath text={problem.scenario} />
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1.5">
                  <p className="font-bold text-amber-900 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" /> คำถามช่วยคิด (Polya ขั้น 1-2)
                  </p>
                  {problem.guidingQuestions.map((q, i) => (
                    <p key={i} className="text-amber-900">
                      • <RenderTextWithMath text={q} />
                    </p>
                  ))}
                </div>

                <button
                  onClick={() => handleToggleReveal(problem.id)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" /> {revealed ? 'ซ่อนแนวทางและคำตอบ' : 'ดูแนวทางและคำตอบ'}
                </button>

                {revealed && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-xs">
                      <p className="font-bold text-indigo-900 mb-1 flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5" /> วิธีที่แนะนำ:{' '}
                        {problem.recommendedMethod === 'inverse' && 'Inverse Matrix Method'}
                        {problem.recommendedMethod === 'cramer' && "Cramer's Rule"}
                        {problem.recommendedMethod === 'gauss' && 'Gaussian Elimination'}
                      </p>
                      <p className="text-indigo-900">{problem.methodRationale}</p>
                    </div>

                    {summary.type === 'unique' && summary.solution && (
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs">
                        <p className="font-bold text-emerald-900 mb-1">คำตอบ:</p>
                        <p className="font-mono text-emerald-900">
                          {problem.system.variables
                            .map(
                              (v, i) =>
                                `${v} = ${formatFractionOrDec(summary.solution![i])} (${problem.variableMeaning[i]})`
                            )
                            .join(' , ')}
                        </p>
                      </div>
                    )}

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
                      <p className="font-bold text-slate-800 mb-1">การตีความคำตอบ (Polya ขั้น 4):</p>
                      <p>{problem.interpretationNote}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
