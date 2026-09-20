import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Sparkles,
  ArrowRight,
  HelpCircle,
  RotateCcw,
  Award
} from 'lucide-react';
import {
  CURRICULUM_LESSONS,
  loadStudentProgress,
  saveStudentProgress,
  StudentProgress
} from '../lib/learningStore';
import { formatFractionOrDec } from '../lib/matrixEngine';
import {
  SystemDisplay,
  MatrixEquationDisplay,
  RenderTextWithMath
} from '../components/math/MathComponents';

export default function LessonView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const lessonId = parseInt(id || '1', 10);

  const lesson = CURRICULUM_LESSONS.find((l) => l.id === lessonId);
  const [progress, setProgress] = useState<StudentProgress>(loadStudentProgress);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [completedThisSession, setCompletedThisSession] = useState(false);

  // Reset selected options and submission states automatically when switching lesson
  useEffect(() => {
    setSelectedAnswers({});
    setSubmitted({});
    setCompletedThisSession(false);
  }, [lessonId]);

  if (!lesson) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-800">ไม่พบบทเรียนที่ต้องการ</h2>
        <Link to="/learning" className="mt-4 inline-block text-indigo-600 font-bold hover:underline">
          กลับสู่เส้นทางการเรียนรู้
        </Link>
      </div>
    );
  }

  // Check Prerequisites
  const uncompletedPrereqs = (lesson.prerequisites || []).filter(
    (pId) => !progress.completedLessons.includes(pId)
  );

  const handleSelectOption = (qIndex: number, optionIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [qIndex]: optionIndex }));
  };

  const handleCheckAnswer = (qIndex: number) => {
    setSubmitted((prev) => ({ ...prev, [qIndex]: true }));
  };

  const handleResetQuestion = (qIndex: number) => {
    setSelectedAnswers((prev) => {
      const copy = { ...prev };
      delete copy[qIndex];
      return copy;
    });
    setSubmitted((prev) => {
      const copy = { ...prev };
      delete copy[qIndex];
      return copy;
    });
  };

  const handleResetAllQuestions = () => {
    setSelectedAnswers({});
    setSubmitted({});
  };

  const handleFinishLesson = () => {
    if (completedThisSession) return;

    const newCompleted = Array.from(new Set([...progress.completedLessons, lesson.id]));
    const updatedProgress: StudentProgress = {
      ...progress,
      completedLessons: newCompleted,
      xp: progress.xp + 50,
      lessonScores: { ...progress.lessonScores, [lesson.id]: 100 }
    };

    // Award badges if applicable
    if (lesson.id === 2 && !updatedProgress.earnedBadges.includes('matrix_explorer')) {
      updatedProgress.earnedBadges.push('matrix_explorer');
    }
    if (lesson.id === 3 && !updatedProgress.earnedBadges.includes('determinant_master')) {
      updatedProgress.earnedBadges.push('determinant_master');
    }
    if (lesson.id === 5 && !updatedProgress.earnedBadges.includes('inverse_solver')) {
      updatedProgress.earnedBadges.push('inverse_solver');
    }
    if (lesson.id === 6 && !updatedProgress.earnedBadges.includes('cramer_specialist')) {
      updatedProgress.earnedBadges.push('cramer_specialist');
    }
    if (lesson.id === 8 && !updatedProgress.earnedBadges.includes('gaussian_expert')) {
      updatedProgress.earnedBadges.push('gaussian_expert');
    }
    if (newCompleted.length >= 10 && !updatedProgress.earnedBadges.includes('matrix_master')) {
      updatedProgress.earnedBadges.push('matrix_master');
    }

    saveStudentProgress(updatedProgress);
    setProgress(updatedProgress);
    setCompletedThisSession(true);
  };

  const nextLesson = CURRICULUM_LESSONS.find((l) => l.id === lesson.id + 1);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/learning')}
          className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> กลับสู่เส้นทางการเรียนรู้
        </button>
        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
          ระยะเวลาเรียน ~{lesson.estimatedMinutes} นาที
        </span>
      </div>

      {/* Prerequisite Alert Banner */}
      {uncompletedPrereqs.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-4">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-grow">
            <h4 className="text-sm font-bold text-amber-900">ข้อแนะนำก่อนเริ่มบทเรียนนี้</h4>
            <p className="text-xs text-amber-800 mt-0.5">
              บทเรียนนี้จำเป็นต้องอาศัยความรู้จากบทเรียนก่อนหน้า (บทที่ {uncompletedPrereqs.join(', ')}) เพื่อให้เข้าใจเนื้อหาได้อย่างสมบูรณ์
            </p>
            <div className="mt-3 flex gap-2">
              <Link
                to={`/learning/lesson/${uncompletedPrereqs[0]}`}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                ทบทวนบทเรียน {uncompletedPrereqs[0]}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Lesson Banner */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-300">
            Lesson {lesson.id} of 10
          </span>
          <h1 className="text-2xl sm:text-3xl font-black mt-2">{lesson.title}</h1>
          <p className="text-sm text-indigo-200 mt-2 max-w-2xl leading-relaxed">{lesson.subtitle}</p>
        </div>
        <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Lesson Sections */}
      <div className="space-y-6">
        {lesson.content.map((section, sIdx) => (
          <div key={sIdx} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-extrabold text-slate-800">
              <RenderTextWithMath text={section.sectionTitle} />
            </h3>
            <div className="text-sm text-slate-700 leading-relaxed">
              <RenderTextWithMath text={section.explanationText} />
            </div>

            {/* Matrix Visual Sample if available */}
            {section.exampleSystem && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 my-3">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">ตัวอย่างระบบสมการ</p>
                <div className="flex flex-wrap items-center gap-6">
                  <SystemDisplay A={section.exampleSystem.A} B={section.exampleSystem.B} variables={['x', 'y']} className="text-sm font-bold" />
                  <span className="text-slate-400 text-xs font-bold">➔ รูป AX = B ➔</span>
                  <MatrixEquationDisplay A={section.exampleSystem.A} B={section.exampleSystem.B} variables={['x', 'y']} className="text-sm font-bold" />
                </div>
              </div>
            )}

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs font-semibold text-indigo-900">
                <span className="font-bold">ข้อสรุปสำคัญ:</span> <RenderTextWithMath text={section.keyTakeaway} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Check Questions Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-extrabold text-slate-800">คำถามเช็กความเข้าใจท้ายบท</h3>
          </div>
          {Object.keys(selectedAnswers).length > 0 && (
            <button
              onClick={handleResetAllQuestions}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> รีเซ็ตการเลือกคำตอบทั้งหมด
            </button>
          )}
        </div>

        {lesson.checkQuestions.map((q, qIdx) => {
          const selectedOption = selectedAnswers[qIdx];
          const isSubmitted = submitted[qIdx];
          const isCorrect = selectedOption === q.correctIndex;

          return (
            <div key={qIdx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-bold text-slate-800">
                  {qIdx + 1}. <RenderTextWithMath text={q.question} />
                </div>
                {selectedOption !== undefined && (
                  <button
                    onClick={() => handleResetQuestion(qIdx)}
                    className="text-xs text-slate-400 hover:text-slate-600 font-semibold flex items-center gap-1 flex-shrink-0"
                    title="เลือกลองทำใหม่อีกครั้ง"
                  >
                    <RotateCcw className="w-3 h-3" /> เลือกใหม่
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.options.map((opt, optIdx) => {
                  const isSelected = selectedOption === optIdx;
                  let btnClass = 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300';
                  if (isSelected) {
                    btnClass = 'bg-indigo-50 border-indigo-500 text-indigo-900 font-bold';
                  }
                  if (isSubmitted) {
                    if (optIdx === q.correctIndex) {
                      btnClass = 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold';
                    } else if (isSelected && !isCorrect) {
                      btnClass = 'bg-rose-50 border-rose-500 text-rose-900 font-bold';
                    }
                  }

                  return (
                    <button
                      key={optIdx}
                      onClick={() => !isSubmitted && handleSelectOption(qIdx, optIdx)}
                      className={`p-3 text-left rounded-xl border text-xs transition-all ${btnClass}`}
                    >
                      <RenderTextWithMath text={opt} />
                    </button>
                  );
                })}
              </div>

              {selectedOption !== undefined && !isSubmitted && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleCheckAnswer(qIdx)}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    ตรวจคำตอบ
                  </button>
                  <button
                    onClick={() => handleResetQuestion(qIdx)}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                  >
                    รีเซ็ตคำตอบ
                  </button>
                </div>
              )}

              {isSubmitted && (
                <div
                  className={`p-3 rounded-xl text-xs ${
                    isCorrect
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{isCorrect ? '✓ ถูกต้อง!' : '✕ ยังไม่ถูกต้อง'}</p>
                    <button
                      onClick={() => handleResetQuestion(qIdx)}
                      className="text-xs font-bold underline hover:no-underline ml-2"
                    >
                      ลองตอบใหม่อีกครั้ง
                    </button>
                  </div>
                  <div className="mt-1">
                    <RenderTextWithMath text={q.explanation} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completion & Next Lesson */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-bold">สำเร็จบทเรียนที่ {lesson.id}?</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            สะสม +50 XP และบันทึกความก้าวหน้าลงในโปรไฟล์ของคุณ
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!completedThisSession && !progress.completedLessons.includes(lesson.id) ? (
            <button
              onClick={handleFinishLesson}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> บันทึกการเรียนจบบทเรียน (+50 XP)
            </button>
          ) : (
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs bg-emerald-900/40 px-3 py-2 rounded-xl border border-emerald-700">
              <CheckCircle2 className="w-4 h-4" /> เรียนจบบทเรียนนี้แล้ว
            </div>
          )}

          {nextLesson && (
            <Link
              to={`/learning/lesson/${nextLesson.id}`}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              บทเรียนถัดไป <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
