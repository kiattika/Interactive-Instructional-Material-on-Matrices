import { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Award,
  ArrowRight,
  Sparkles,
  BarChart2,
  RotateCcw,
  Wand2,
  Loader2
} from 'lucide-react';
import {
  loadStudentProgress,
  saveStudentProgress,
  loadTeacherSettings,
  StudentProgress
} from '../lib/learningStore';
import { TopicKey, TOPIC_LABELS } from '../lib/topics';
import { RenderTextWithMath } from '../components/math/MathComponents';
import { getClassroomLink, getStudentId } from '../lib/classroomSync';

export interface Question {
  id: string;
  topic: TopicKey;
  topicLabel: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

// Deterministic, curriculum-grounded advice per topic — shown alongside (not instead of)
// the on-demand AI-generated practice problem below.
const TOPIC_ADVICE: Record<TopicKey, string> = {
  matrixNotation: 'แนะนำให้ทบทวนบทเรียนที่ 2 เรื่องการแปลงระบบสมการให้อยู่ในรูป AX = B',
  determinant: 'แนะนำให้ทบทวนบทเรียนที่ 3 เรื่องการหาค่า det(A) และกฎเครื่องหมาย',
  inverseMethod: 'แนะนำให้ทบทวนบทเรียนที่ 5 เรื่องการแก้ระบบสมการด้วย A⁻¹B',
  cramerRule: 'ควรระวังการสลับตำแหน่งคอลัมน์ค่าคงที่ B ลงในเมทริกซ์ Ax หรือ Ay',
  gaussianElimination: 'แนะนำให้ฝึกปฏิบัติใน Matrix Lab หัวข้อ Row Operations (ERO)',
  solutionTypes: 'แนะนำให้ทบทวนบทเรียนที่ 10 เรื่องการจำแนกประเภทคำตอบ'
};

export const DIAGNOSTIC_QUESTIONS: Question[] = [
  {
    id: 'q1',
    topic: 'matrixNotation',
    topicLabel: 'การเขียนรูป AX = B',
    text: 'ระบบสมการ 2x + 3y = 7 และ x - 4y = 2 สามารถเขียนในรูปเมทริกซ์ $AX = B$ ได้อย่างไร?',
    options: [
      '$A = \\begin{bmatrix} 2 & 3 \\\\[0.5em] 1 & -4 \\end{bmatrix}, \\quad X = \\begin{bmatrix} x \\\\[0.5em] y \\end{bmatrix}, \\quad B = \\begin{bmatrix} 7 \\\\[0.5em] 2 \\end{bmatrix}$',
      '$A = \\begin{bmatrix} 7 & 2 \\\\[0.5em] 2 & 3 \\end{bmatrix}, \\quad X = \\begin{bmatrix} x \\\\[0.5em] y \\end{bmatrix}, \\quad B = \\begin{bmatrix} 1 \\\\[0.5em] -4 \\end{bmatrix}$',
      '$A = \\begin{bmatrix} 2 & 1 \\\\[0.5em] 3 & -4 \\end{bmatrix}, \\quad X = \\begin{bmatrix} 7 \\\\[0.5em] 2 \\end{bmatrix}, \\quad B = \\begin{bmatrix} x \\\\[0.5em] y \\end{bmatrix}$',
      '$A = \\begin{bmatrix} 3 & 2 \\\\[0.5em] -4 & 1 \\end{bmatrix}, \\quad X = \\begin{bmatrix} x \\\\[0.5em] y \\end{bmatrix}, \\quad B = \\begin{bmatrix} 7 \\\\[0.5em] 2 \\end{bmatrix}$'
    ],
    correctIndex: 0,
    explanation: 'เมทริกซ์ A เก็บสัมปสิทธิ์ [2, 3] และ [1, -4], X เก็บ [x, y] และ B เก็บ [7, 2]'
  },
  {
    id: 'q2',
    topic: 'determinant',
    topicLabel: 'Determinant',
    text: 'ค่าดีเทอร์มิแนนต์ของเมทริกซ์ $A = \\begin{bmatrix} 3 & 1 \\\\ 2 & 4 \\end{bmatrix}$ มีค่าเท่าใด?',
    options: ['10', '14', '12', '8'],
    correctIndex: 0,
    explanation: 'det(A) = (3 × 4) - (1 × 2) = 12 - 2 = 10'
  },
  {
    id: 'q3',
    topic: 'solutionTypes',
    topicLabel: 'ประเภทคำตอบของระบบสมการ',
    text: 'ถ้าระบบสมการมี $\\det(A) = 0$ และเมื่อคูณขยายพบสมการขัดแย้ง $0 = 5$ จะได้คำตอบประเภทใด?',
    options: ['มีคำตอบเดียว', 'ไม่มีคำตอบ (No Solution)', 'มีคำตอบนับไม่ถ้วน (Infinite Solutions)', 'คำนวณไม่ได้'],
    correctIndex: 1,
    explanation: 'ข้อความ 0 = 5 เป็นเท็จ แสดงว่าเส้นตรงขนานกัน ไม่มีจุดตัด จึงไม่มีคำตอบ'
  },
  {
    id: 'q4',
    topic: 'inverseMethod',
    topicLabel: 'Inverse Matrix',
    text: 'ถ้า $A = \\begin{bmatrix} 2 & 1 \\\\ 1 & -1 \\end{bmatrix}$ จะได้ $\\det(A) = -3$ ข้อใดคือเมทริกซ์ $A^{-1}$?',
    options: [
      '$-\\frac{1}{3} \\begin{bmatrix} -1 & -1 \\\\[0.5em] -1 & 2 \\end{bmatrix}$',
      '$-\\frac{1}{3} \\begin{bmatrix} 1 & -1 \\\\[0.5em] -1 & 2 \\end{bmatrix}$',
      '$\\frac{1}{3} \\begin{bmatrix} 2 & 1 \\\\[0.5em] 1 & -1 \\end{bmatrix}$',
      '$\\begin{bmatrix} 1 & 0 \\\\ 0 & 1 \\end{bmatrix}$'
    ],
    correctIndex: 0,
    explanation: 'A⁻¹ = 1/det(A) × [[d, -b], [-c, a]] = -1/3 × [[-1, -1], [-1, 2]]'
  },
  {
    id: 'q5',
    topic: 'cramerRule',
    topicLabel: 'กฎของคราเมอร์',
    text: 'ในการหาค่า $x$ ของระบบสมการด้วยกฎของคราเมอร์ เมทริกซ์ $A_x$ คือข้อใด?',
    options: [
      'เมทริกซ์ A ที่เอาคอลัมน์ B แทนที่คอลัมน์ที่ 1',
      'เมทริกซ์ A ที่เอาคอลัมน์ B แทนที่คอลัมน์ที่ 2',
      'เมทริกซ์ A คูณด้วย B',
      'เมทริกซ์ผกผันของ A'
    ],
    correctIndex: 0,
    explanation: 'Ax สื่อถึงการนำคอลัมน์ค่าคงที่ B ไปแทนที่คอลัมน์สัมปสิทธิ์ตัวแปร x (คอลัมน์ที่ 1)'
  },
  {
    id: 'q6',
    topic: 'gaussianElimination',
    topicLabel: 'Gaussian Elimination',
    text: 'เป้าหมายหลักของการทำ Elementary Row Operations ใน Gaussian Elimination คืออะไร?',
    options: [
      'ทำให้เมทริกซ์ A กลายเป็นเมทริกซ์สามเหลี่ยมบน (Row Echelon Form)',
      'ทำให้ค่า $\\det(A)$ เพิ่มขึ้นเป็นสองเท่า',
      'สลับค่าคงที่ B ทั้งหมดให้กลายเป็น 0',
      'หาค่าเฉลี่ยของทุกแถว'
    ],
    correctIndex: 0,
    explanation: 'การแปลงเป็นสามเหลี่ยมบนช่วยให้สามารถแก้หาตัวแปรย้อนกลับ (Back-substitution) ได้รวดเร็ว'
  }
];


export default function PrePostTest() {
  const [progress, setProgress] = useState<StudentProgress>(loadStudentProgress);
  const [masteryThreshold] = useState(() => loadTeacherSettings().masteryThreshold);
  const [activeMode, setActiveMode] = useState<'pre' | 'post'>('pre');
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

  const activeQuestion = DIAGNOSTIC_QUESTIONS[qIndex];

  const handleSelectOption = (optIdx: number) => {
    setUserAnswers((prev) => ({ ...prev, [activeQuestion.id]: optIdx }));
  };

  const handleNextQuestion = () => {
    if (qIndex < DIAGNOSTIC_QUESTIONS.length - 1) {
      setQIndex(qIndex + 1);
    } else {
      // Calculate results
      let score = 0;
      const topicScores: Record<string, { correct: number; total: number }> = {};

      DIAGNOSTIC_QUESTIONS.forEach((q) => {
        if (!topicScores[q.topic]) topicScores[q.topic] = { correct: 0, total: 0 };
        topicScores[q.topic].total += 1;

        if (userAnswers[q.id] === q.correctIndex) {
          score += 1;
          topicScores[q.topic].correct += 1;
        }
      });

      const finalPercent = Math.round((score / DIAGNOSTIC_QUESTIONS.length) * 100);

      const updatedProgress: StudentProgress = { ...progress };
      if (activeMode === 'pre') {
        updatedProgress.preTestCompleted = true;
        updatedProgress.preTestScore = finalPercent;
        updatedProgress.preTestAnswers = userAnswers;
        updatedProgress.preTestDate = new Date().toISOString();
      } else {
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

  const handleStartTest = (mode: 'pre' | 'post') => {
    setActiveMode(mode);
    setUserAnswers({});
    setQIndex(0);
    setCurrentStep('testing');
  };

  // Compute stats comparison
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
            แบบทดสอบประเมินผลการเรียนรู้ (Diagnostic Assessment)
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            Pre-Test & Post-Test <span className="text-indigo-400">Comparison</span>
          </h1>
          <p className="text-xs sm:text-sm text-indigo-200 max-w-xl">
            ประเมินความรู้พื้นฐานก่อนเรียน (Pre-test) และวัดพัฒนาการหลังเรียนจบหลักสูตร (Post-test)
          </p>
        </div>
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Intro & Summary Comparison */}
      {currentStep === 'intro' && (
        <div className="space-y-6">
          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                คะแนนก่อนเรียน (Pre-Test)
              </span>
              <p className="text-3xl font-black text-slate-800">
                {progress.preTestCompleted ? `${progress.preTestScore}%` : 'ยังไม่ได้ทำ'}
              </p>
              <button
                onClick={() => handleStartTest('pre')}
                className="w-full mt-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-colors border border-indigo-200"
              >
                {progress.preTestCompleted ? 'ทำแบบทดสอบ Pre-test อีกครั้ง' : 'เริ่มทำ Pre-Test'}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                คะแนนหลังเรียน (Post-Test)
              </span>
              <p className="text-3xl font-black text-indigo-600">
                {progress.postTestCompleted ? `${progress.postTestScore}%` : 'ยังไม่ได้ทำ'}
              </p>
              <button
                onClick={() => handleStartTest('post')}
                className="w-full mt-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
              >
                {progress.postTestCompleted ? 'ทำแบบทดสอบ Post-test อีกครั้ง' : 'เริ่มทำ Post-Test'}
              </button>
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
        </div>
      )}

      {/* Testing Step View */}
      {currentStep === 'testing' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-md space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              {activeMode === 'pre' ? 'Pre-Test Diagnostic' : 'Post-Test Assessment'} • ข้อที่ {qIndex + 1} / {DIAGNOSTIC_QUESTIONS.length}
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
              {qIndex < DIAGNOSTIC_QUESTIONS.length - 1 ? 'ข้อถัดไป' : 'ส่งแบบทดสอบ'} <ArrowRight className="w-4 h-4" />
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
          <h2 className="text-2xl font-black text-slate-800">
            ส่งแบบทดสอบ {activeMode === 'pre' ? 'Pre-Test' : 'Post-Test'} เรียบร้อย!
          </h2>
          <p className="text-sm text-slate-600">
            คะแนนที่คุณได้: <span className="font-extrabold text-indigo-600 text-lg">
              {activeMode === 'pre' ? progress.preTestScore : progress.postTestScore}%
            </span>
          </p>

          <div className="pt-4 flex justify-center gap-3">
            <button
              onClick={() => setCurrentStep('intro')}
              className="px-6 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> ดูรายงานสรุปผลเปรียบเทียบ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
