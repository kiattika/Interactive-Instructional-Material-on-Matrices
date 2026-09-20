import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  BarChart2,
  RotateCcw,
  Wand2,
  Loader2,
  Info
} from 'lucide-react';
import {
  loadStudentProgress,
  saveStudentProgress,
  loadTeacherSettings,
  StudentProgress,
  DIAGNOSTIC_TEST_XP
} from '../lib/learningStore';
import { TopicKey, TOPIC_LABELS } from '../lib/topics';
import { PRE_TEST_QUESTIONS, POST_TEST_QUESTIONS, TOPIC_ADVICE } from '../lib/diagnosticQuestions';
import { shuffleOptions } from '../lib/shuffleOptions';
import { RenderTextWithMath } from '../components/math/MathComponents';
import { getClassroomLink, getStudentId } from '../lib/classroomSync';

interface DiagnosticTestPageProps {
  mode: 'pre' | 'post';
}

// Shared by PreTestPage.tsx and PostTestPage.tsx — same testing/results flow, parameterized by
// which 10-question bank to use and which StudentProgress fields to write. Routing (not an
// in-page toggle) is what distinguishes the two now, so a student can't just flip a tab back to
// re-read Pre-Test answers while sitting on the Post-Test.
export function DiagnosticTestPage({ mode }: DiagnosticTestPageProps) {
  const rawQuestions = mode === 'pre' ? PRE_TEST_QUESTIONS : POST_TEST_QUESTIONS;
  const modeLabel = mode === 'pre' ? 'Pre-Test' : 'Post-Test';

  const [progress, setProgress] = useState<StudentProgress>(loadStudentProgress);

  // 18/20 questions across both banks had the correct answer hardcoded at option index 0 — see
  // shuffleOptions.ts. Seeded by studentId+questionId so it's stable for this student but
  // differs from student to student.
  const questions = useMemo(() => {
    const studentId = getStudentId();
    return rawQuestions.map((q) => {
      const { options, correctIndex } = shuffleOptions(`${studentId}-${q.id}`, q.options, q.correctIndex);
      return { ...q, options, correctIndex };
    });
  }, [rawQuestions]);
  const [masteryThreshold] = useState(() => loadTeacherSettings().masteryThreshold);
  const [currentStep, setCurrentStep] = useState<'intro' | 'testing' | 'results'>('intro');
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [qIndex, setQIndex] = useState(0);
  const [aiTopic, setAiTopic] = useState<TopicKey | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProblemText, setAiProblemText] = useState('');

  const handleGeneratePractice = async (topic: TopicKey) => {
    setAiTopic(topic);
    setAiLoading(true);
    setAiProblemText('');

    const classroomLink = getClassroomLink();
    if (!classroomLink) {
      // Should not happen — joining a classroom is mandatory before reaching this page — but
      // fail with a clear message rather than a silent 403 if it somehow is.
      setAiProblemText('ต้องเข้าร่วมห้องเรียนด้วยรหัสห้องก่อนจึงจะขอโจทย์จาก AI ได้ครับ ลองรีเฟรชหน้านี้');
      setAiLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/ai-practice-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, classCode: classroomLink.classCode, studentId: getStudentId() })
      });
      const data = await res.json();
      setAiProblemText(data.problemText || 'ขออภัยครับ ครูไม่สามารถสร้างโจทย์ได้ในขณะนี้ ลองใหม่อีกครั้ง');
    } catch {
      setAiProblemText('เกิดข้อผิดพลาดในการเชื่อมต่อ AI โปรดตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ครับ');
    } finally {
      setAiLoading(false);
    }
  };

  const activeQuestion = questions[qIndex];

  const handleSelectOption = (optIdx: number) => {
    setUserAnswers((prev) => ({ ...prev, [activeQuestion.id]: optIdx }));
  };

  const handleNextQuestion = () => {
    if (qIndex < questions.length - 1) {
      setQIndex(qIndex + 1);
    } else {
      // Calculate results
      let score = 0;
      const topicScores: Record<string, { correct: number; total: number }> = {};

      questions.forEach((q) => {
        if (!topicScores[q.topic]) topicScores[q.topic] = { correct: 0, total: 0 };
        topicScores[q.topic].total += 1;

        if (userAnswers[q.id] === q.correctIndex) {
          score += 1;
          topicScores[q.topic].correct += 1;
        }
      });

      const finalPercent = Math.round((score / questions.length) * 100);

      const updatedProgress: StudentProgress = { ...progress };
      // Award the one-time completion XP BEFORE flipping *TestCompleted to true, so retaking
      // the test later (preTestCompleted/postTestCompleted already true) can't farm more XP.
      if (mode === 'pre') {
        if (!updatedProgress.preTestCompleted) updatedProgress.xp += DIAGNOSTIC_TEST_XP;
        updatedProgress.preTestCompleted = true;
        updatedProgress.preTestScore = finalPercent;
        updatedProgress.preTestAnswers = userAnswers;
        updatedProgress.preTestDate = new Date().toISOString();
      } else {
        if (!updatedProgress.postTestCompleted) updatedProgress.xp += DIAGNOSTIC_TEST_XP;
        updatedProgress.postTestCompleted = true;
        updatedProgress.postTestScore = finalPercent;
        updatedProgress.postTestAnswers = userAnswers;
        updatedProgress.postTestDate = new Date().toISOString();
      }

      // Update topic mastery
      (Object.entries(topicScores) as [TopicKey, { correct: number; total: number }][]).forEach(
        ([tKey, val]) => {
          const topicRatio = Math.round((val.correct / val.total) * 100);
          updatedProgress.topicMastery[tKey] = topicRatio;
        }
      );

      saveStudentProgress(updatedProgress);
      setProgress(updatedProgress);
      setCurrentStep('results');
    }
  };

  const handleStartTest = () => {
    setUserAnswers({});
    setQIndex(0);
    setCurrentStep('testing');
  };

  const isCompleted = mode === 'pre' ? progress.preTestCompleted : progress.postTestCompleted;
  const ownScore = mode === 'pre' ? progress.preTestScore : progress.postTestScore;

  // Comparison stats — only meaningful once both tests exist, so only shown on the Post-Test
  // page (see below): that's naturally where "how much did I improve" belongs.
  const preScore = progress.preTestScore || 0;
  const postScore = progress.postTestScore || 0;
  const improvement = postScore - preScore;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-400/30 text-indigo-200 text-xs font-bold">
            <BarChart2 className="w-3.5 h-3.5 text-indigo-300" />
            {mode === 'pre' ? 'แบบทดสอบก่อนเรียน (Pre-Test Diagnostic)' : 'แบบทดสอบหลังเรียน (Post-Test Assessment)'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            {mode === 'pre' ? 'ทดสอบความรู้พื้นฐาน' : 'ทดสอบความรู้'} <span className="text-indigo-400">{modeLabel}</span>
          </h1>
          <p className="text-xs sm:text-sm text-indigo-200 max-w-xl">
            {mode === 'pre'
              ? 'ประเมินความรู้พื้นฐานก่อนเริ่มเรียนบทเรียนแรก'
              : 'วัดพัฒนาการหลังเรียนจบหลักสูตร เปรียบเทียบกับผล Pre-Test'}
          </p>
        </div>
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Intro & (for Post-Test) Comparison */}
      {currentStep === 'intro' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 max-w-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">คะแนน {modeLabel}</span>
            <p className="text-3xl font-black text-slate-800">{isCompleted ? `${ownScore}%` : 'ยังไม่ได้ทำ'}</p>
            <button
              onClick={handleStartTest}
              className="w-full mt-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
            >
              {isCompleted ? `ทำแบบทดสอบ ${modeLabel} อีกครั้ง` : `เริ่มทำ ${modeLabel} (+${DIAGNOSTIC_TEST_XP} XP)`}
            </button>
          </div>

          {mode === 'pre' && !progress.preTestCompleted && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-800 leading-relaxed">
                แนะนำให้ทำแบบทดสอบนี้ก่อนเริ่มเรียนบทเรียนแรก เพื่อวัดพื้นฐานความรู้เดิมของคุณ
              </p>
            </div>
          )}

          {mode === 'post' && (
            <>
              {/* Comparison Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    คะแนนก่อนเรียน (Pre-Test)
                  </span>
                  <p className="text-3xl font-black text-slate-800">
                    {progress.preTestCompleted ? `${progress.preTestScore}%` : 'ยังไม่ได้ทำ'}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    คะแนนหลังเรียน (Post-Test)
                  </span>
                  <p className="text-3xl font-black text-indigo-600">
                    {progress.postTestCompleted ? `${progress.postTestScore}%` : 'ยังไม่ได้ทำ'}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-2xl p-5 shadow-sm space-y-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-100">
                    พัฒนาการรวม (Improvement)
                  </span>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-8 h-8 text-emerald-200" />
                    <p className="text-3xl font-black">
                      {improvement >= 0 ? `+${improvement}%` : `${improvement}%`}
                    </p>
                  </div>
                  <p className="text-xs text-emerald-100">
                    {improvement > 0 ? 'ยอดเยี่ยม! มีพัฒนาการเพิ่มขึ้นชัดเจน' : 'เริ่มต้นการเรียนรู้เพื่อเพิ่มพัฒนาการ'}
                  </p>
                </div>
              </div>

              {/* Topic Mastery Analytics */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h3 className="text-base font-extrabold text-slate-800">ระดับความเชี่ยวชาญแยกตามหัวข้อ (Topic Mastery)</h3>
                <div className="space-y-3">
                  {(Object.keys(TOPIC_LABELS) as TopicKey[]).map((key) => {
                    const val = progress.topicMastery[key] || 0;
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span>{TOPIC_LABELS[key]}</span>
                          <span className="text-indigo-600">{val}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              val >= 80 ? 'bg-emerald-500' : val >= 60 ? 'bg-indigo-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${val}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Error Analysis & Recommendations */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <span>จุดที่ควรทบทวน (ต่ำกว่าเกณฑ์ที่ครูตั้งไว้ {masteryThreshold}%)</span>
                </div>
                {(Object.keys(TOPIC_LABELS) as TopicKey[]).filter(
                  (key) => progress.topicMastery[key] < masteryThreshold
                ).length === 0 ? (
                  <p className="text-xs text-amber-900 leading-relaxed">
                    ทุกหัวข้อผ่านเกณฑ์ความเชี่ยวชาญที่ครูตั้งไว้แล้ว เยี่ยมมากครับ!
                  </p>
                ) : (
                  <ul className="text-xs text-amber-900 space-y-3 leading-relaxed">
                    {(Object.keys(TOPIC_LABELS) as TopicKey[])
                      .filter((key) => progress.topicMastery[key] < masteryThreshold)
                      .map((key) => (
                        <li key={key} className="space-y-1.5">
                          <div>
                            <strong>{TOPIC_LABELS[key]}:</strong> {TOPIC_ADVICE[key]}
                          </div>
                          <button
                            onClick={() => handleGeneratePractice(key)}
                            disabled={aiLoading && aiTopic === key}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 text-amber-800 rounded-lg text-[11px] font-bold hover:bg-amber-100 transition-colors disabled:opacity-60"
                          >
                            {aiLoading && aiTopic === key ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Wand2 className="w-3.5 h-3.5" />
                            )}
                            ขอโจทย์ฝึกเพิ่มเติมจาก AI
                          </button>
                          {aiTopic === key && (aiLoading || aiProblemText) && (
                            <div className="bg-white border border-amber-200 rounded-xl p-3 text-slate-700 text-xs leading-relaxed">
                              {aiLoading ? (
                                <span className="text-slate-400">ครูพี่หนุ่มกำลังแต่งโจทย์ให้...</span>
                              ) : (
                                <RenderTextWithMath text={aiProblemText} />
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Testing Step View */}
      {currentStep === 'testing' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-md space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              {modeLabel} • ข้อที่ {qIndex + 1} / {questions.length}
            </span>
            <span className="text-xs font-semibold text-slate-400">{activeQuestion.topicLabel}</span>
          </div>

          <h3 className="text-lg font-bold text-slate-800 leading-snug">
            <RenderTextWithMath text={activeQuestion.text} />
          </h3>

          <div className="space-y-3">
            {activeQuestion.options.map((opt, optIdx) => {
              const isSelected = userAnswers[activeQuestion.id] === optIdx;
              return (
                <button
                  key={optIdx}
                  onClick={() => handleSelectOption(optIdx)}
                  className={`w-full p-4 rounded-xl border text-left text-sm transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-bold shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300'
                  }`}
                >
                  <div>
                    <RenderTextWithMath text={opt} />
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                      isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              disabled={userAnswers[activeQuestion.id] === undefined}
              onClick={handleNextQuestion}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition-colors flex items-center gap-2"
            >
              {qIndex < questions.length - 1 ? 'ข้อถัดไป' : 'ส่งแบบทดสอบ'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Results View */}
      {currentStep === 'results' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-md text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-3xl flex items-center justify-center mx-auto text-2xl font-black shadow-inner">
            ✓
          </div>
          <h2 className="text-2xl font-black text-slate-800">ส่งแบบทดสอบ {modeLabel} เรียบร้อย!</h2>
          <p className="text-sm text-slate-600">
            คะแนนที่คุณได้: <span className="font-extrabold text-indigo-600 text-lg">{ownScore}%</span>
          </p>

          <div className="pt-4 flex justify-center gap-3">
            <button
              onClick={() => setCurrentStep('intro')}
              className="px-6 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> {mode === 'post' ? 'ดูรายงานสรุปผลเปรียบเทียบ' : 'กลับหน้าหลัก'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
