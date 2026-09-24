import { useState, useEffect, useMemo } from 'react';
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
  Award,
  Network
} from 'lucide-react';
import {
  CURRICULUM_LESSONS,
  loadStudentProgress,
  saveStudentProgress,
  loadTeacherSettings,
  StudentProgress,
  CHECK_QUESTION_CORRECT_XP,
  CHECK_QUESTION_SECOND_TRY_XP
} from '../lib/learningStore';
import { resolveCheckAttempt, lessonCheckScore } from '../lib/checkAttempts';
import { formatFractionOrDec } from '../lib/matrixEngine';
import { shuffleOptions } from '../lib/shuffleOptions';
import { getStudentId } from '../lib/classroomSync';
import { withActivity, withEarnedBadges } from '../lib/motivation';
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
  const [settings] = useState(loadTeacherSettings);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  // submitted[q] = the question is settled (answered correctly, or answer revealed after two
  // wrong picks) — which is what the completion gate below counts.
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  // Wrong (shuffled) option indices picked so far on each question in this sitting — see
  // lib/checkAttempts.ts for the two-strike rules.
  const [wrongPicks, setWrongPicks] = useState<Record<number, number[]>>({});
  const [attemptXp, setAttemptXp] = useState<Record<number, number>>({});
  const [completedThisSession, setCompletedThisSession] = useState(false);

  // Reset selected options and submission states automatically when switching lesson
  useEffect(() => {
    setSelectedAnswers({});
    setSubmitted({});
    setWrongPicks({});
    setAttemptXp({});
    setCompletedThisSession(false);
  }, [lessonId]);

  // Shuffle each check-question's options once per (student, question) pair — most of the
  // curriculum's check-questions had the correct answer hardcoded at option index 0, letting
  // students learn to pick the first button instead of the material. Seeding with the
  // student's id keeps a given question's order stable for that student across visits, while
  // still varying from one student to the next (see shuffleOptions.ts).
  const checkQuestions = useMemo(() => {
    if (!lesson) return [];
    const studentId = getStudentId();
    return lesson.checkQuestions.map((q, qIdx) => {
      // Shuffle option+feedback pairs together so each "why wrong" stays with its option. The
      // permutation depends only on the seed and option count, so students keep the same order
      // they saw before whyWrong existed.
      const { options: pairs, correctIndex } = shuffleOptions(
        `${studentId}-lesson${lesson.id}-check${qIdx}`,
        q.options.map((text, i) => ({ text, whyWrong: q.whyWrong[i] })),
        q.correctIndex
      );
      return {
        ...q,
        options: pairs.map((p) => p.text),
        whyWrong: pairs.map((p) => p.whyWrong),
        correctIndex
      };
    });
  }, [lesson]);

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
    const picked = selectedAnswers[qIndex];
    if (picked === undefined) return;
    const isCorrect = picked === checkQuestions[qIndex]?.correctIndex;
    const priorWrong = (wrongPicks[qIndex] || []).length;
    const xpKey = `lesson${lesson.id}-check${qIndex}`;
    const result = resolveCheckAttempt(progress, xpKey, isCorrect, priorWrong, settings.enableXp);

    // Any answer is learning activity for the streak; withActivity returns the same object when
    // nothing changed, so this only saves when there's something to save.
    const updatedProgress = withActivity(result.progress);
    if (updatedProgress !== progress) {
      saveStudentProgress(updatedProgress);
      setProgress(updatedProgress);
    }

    if (!isCorrect) setWrongPicks((prev) => ({ ...prev, [qIndex]: [...(prev[qIndex] || []), picked] }));
    if (result.outcome === 'retry') {
      // First strike: don't reveal — clear the pick so the student chooses again.
      setSelectedAnswers((prev) => {
        const copy = { ...prev };
        delete copy[qIndex];
        return copy;
      });
    } else {
      setSubmitted((prev) => ({ ...prev, [qIndex]: true }));
      setAttemptXp((prev) => ({ ...prev, [qIndex]: result.xpAwarded }));
    }
  };

  const clearKey = <T,>(record: Record<number, T>, key: number): Record<number, T> => {
    const copy = { ...record };
    delete copy[key];
    return copy;
  };

  // Before a question is settled this only clears the current pick — its strike stays, so a reset
  // can't erase a first wrong pick. A settled question restarts fully as practice (its XP is
  // already settled either way).
  const handleResetQuestion = (qIndex: number) => {
    setSelectedAnswers((prev) => clearKey(prev, qIndex));
    if (submitted[qIndex]) {
      setSubmitted((prev) => clearKey(prev, qIndex));
      setWrongPicks((prev) => clearKey(prev, qIndex));
      setAttemptXp((prev) => clearKey(prev, qIndex));
    }
  };

  const handleResetAllQuestions = () => {
    setSelectedAnswers({});
    setWrongPicks((prev) => Object.fromEntries(Object.entries(prev).filter(([q]) => !submitted[Number(q)])));
    setSubmitted({});
    setAttemptXp({});
  };

  const allCheckQuestionsAttempted =
    checkQuestions.length === 0 || checkQuestions.every((_, qIdx) => submitted[qIdx]);

  const handleFinishLesson = () => {
    if (completedThisSession || !allCheckQuestionsAttempted) return;

    const newCompleted = Array.from(new Set([...progress.completedLessons, lesson.id]));
    const updatedProgress: StudentProgress = withActivity({
      ...progress,
      completedLessons: newCompleted,
      xp: settings.enableXp ? progress.xp + 50 : progress.xp,
      lessonScores: { ...progress.lessonScores, [lesson.id]: 100 }
    });

    // Real formative score for this lesson (E1 data, synced to the roster) — only when every
    // check-question has a first-settle outcome, and never overwritten once recorded.
    const checkScore = lessonCheckScore(updatedProgress, lesson.id, lesson.checkQuestions.length);
    if (checkScore !== null && updatedProgress.lessonCheckScores[lesson.id] === undefined) {
      updatedProgress.lessonCheckScores = { ...updatedProgress.lessonCheckScores, [lesson.id]: checkScore };
    }

    // Award badges if applicable (rules in lib/motivation.ts; the method badges also need the
    // matching Matrix Lab walkthrough). Nothing is awarded while badges are disabled, so nothing
    // is retroactively earned the moment a teacher re-enables them.
    const withBadges = withEarnedBadges(updatedProgress, settings.enableBadges);

    saveStudentProgress(withBadges);
    setProgress(withBadges);
    setCompletedThisSession(true);
  };

  const nextLesson = CURRICULUM_LESSONS.find((l) => l.id === lesson.id + 1);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/learning')}
          className="min-h-11 sm:min-h-0 flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors"
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
                className="px-3 py-1.5 min-h-11 sm:min-h-0 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors"
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

      {/* Lesson 12 is framed as this hands-on lab's guided lesson — link straight to it so
          students don't have to hunt for it in the sidebar. */}
      {lesson.id === 12 && (
        <Link
          to="/higher-order-lab"
          className="flex items-center justify-between gap-3 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Network className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <p className="text-sm font-bold">ทดลองแก้ระบบสมการ 4 ตัวแปรจริงได้ที่ Higher-Order Lab</p>
              <p className="text-xs text-indigo-200">ฝึก Gaussian Elimination กับโจทย์วงจรไฟฟ้า 4 ลูป หรือแก้โจทย์ของคุณเอง</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-indigo-300 flex-shrink-0" />
        </Link>
      )}

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
              className="flex items-center gap-1.5 px-3 py-1 min-h-11 sm:min-h-0 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> รีเซ็ตการเลือกคำตอบทั้งหมด
            </button>
          )}
        </div>

        {checkQuestions.map((q, qIdx) => {
          const selectedOption = selectedAnswers[qIdx];
          const isSubmitted = submitted[qIdx];
          const isCorrect = selectedOption === q.correctIndex;
          const strikes = wrongPicks[qIdx] || [];
          const lastWrong = strikes[strikes.length - 1];

          return (
            <div key={qIdx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-bold text-slate-800">
                  {qIdx + 1}. <RenderTextWithMath text={q.question} />
                </div>
                {(selectedOption !== undefined || isSubmitted) && (
                  <button
                    onClick={() => handleResetQuestion(qIdx)}
                    className="min-h-11 sm:min-h-0 text-xs text-slate-400 hover:text-slate-600 font-semibold flex items-center gap-1 flex-shrink-0"
                    title="เลือกลองทำใหม่อีกครั้ง"
                  >
                    <RotateCcw className="w-3 h-3" /> เลือกใหม่
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.options.map((opt, optIdx) => {
                  const isSelected = selectedOption === optIdx;
                  const isStruck = strikes.includes(optIdx);
                  let btnClass = 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300';
                  if (isSelected) {
                    btnClass = 'bg-indigo-50 border-indigo-500 text-indigo-900 font-bold';
                  }
                  // Already-tried wrong options stay marked (and unpickable) while retrying.
                  if (isStruck) {
                    btnClass = 'bg-rose-50 border-rose-300 text-rose-800 line-through decoration-rose-300';
                  }
                  if (isSubmitted) {
                    if (optIdx === q.correctIndex) {
                      btnClass = 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold';
                    } else if (isStruck || (isSelected && !isCorrect)) {
                      btnClass = 'bg-rose-50 border-rose-500 text-rose-900 font-bold';
                    }
                  }

                  return (
                    <button
                      key={optIdx}
                      disabled={isStruck && !isSubmitted}
                      onClick={() => !isSubmitted && !isStruck && handleSelectOption(qIdx, optIdx)}
                      className={`p-3 min-h-12 sm:min-h-0 text-left rounded-xl border text-sm sm:text-xs transition-all ${btnClass}`}
                    >
                      <RenderTextWithMath text={opt} />
                    </button>
                  );
                })}
              </div>

              {/* First strike: explain why the picked option is wrong without revealing the answer. */}
              {!isSubmitted && lastWrong !== undefined && (
                <div className="p-3 rounded-xl text-xs bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                  <p className="font-bold">✕ ยังไม่ถูก — ลองคิดอีกครั้งนะ</p>
                  {q.whyWrong[lastWrong] && (
                    <p>
                      <RenderTextWithMath text={q.whyWrong[lastWrong] as string} />
                    </p>
                  )}
                  <p className="text-amber-700">
                    เลือกคำตอบใหม่ได้อีก 1 ครั้ง
                    {settings.enableXp ? ` (ตอบถูกครั้งนี้ได้ +${CHECK_QUESTION_SECOND_TRY_XP} XP)` : ''}
                  </p>
                </div>
              )}

              {selectedOption !== undefined && !isSubmitted && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleCheckAnswer(qIdx)}
                    className="px-4 py-1.5 min-h-11 sm:min-h-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    ตรวจคำตอบ
                  </button>
                  <button
                    onClick={() => handleResetQuestion(qIdx)}
                    className="px-3 py-1.5 min-h-11 sm:min-h-0 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors"
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
                    <p className="font-bold">
                      {isCorrect
                        ? `✓ ถูกต้อง!${strikes.length > 0 ? ' (ตอบถูกในครั้งที่ 2)' : ''}${attemptXp[qIdx] ? ` +${attemptXp[qIdx]} XP` : ''}`
                        : '✕ ยังไม่ถูกต้องทั้ง 2 ครั้ง — ดูคำตอบที่ถูกต้อง (สีเขียว) และคำอธิบายด้านล่าง'}
                    </p>
                    <button
                      onClick={() => handleResetQuestion(qIdx)}
                      className="inline-flex items-center min-h-11 sm:min-h-0 text-xs font-bold underline hover:no-underline ml-2"
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
            {!completedThisSession && !progress.completedLessons.includes(lesson.id) && !allCheckQuestionsAttempted
              ? `ตอบคำถามเช็กความเข้าใจให้ครบ ${checkQuestions.length} ข้อก่อนบันทึกการเรียนจบบทเรียน`
              : settings.enableXp
              ? 'สะสม +50 XP และบันทึกความก้าวหน้าลงในโปรไฟล์ของคุณ'
              : 'บันทึกความก้าวหน้าลงในโปรไฟล์ของคุณ'}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!completedThisSession && !progress.completedLessons.includes(lesson.id) ? (
            <button
              onClick={handleFinishLesson}
              disabled={!allCheckQuestionsAttempted}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-500 text-slate-950 font-black text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> บันทึกการเรียนจบบทเรียน{settings.enableXp ? ' (+50 XP)' : ''}
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
