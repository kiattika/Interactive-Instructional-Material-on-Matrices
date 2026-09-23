import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  CheckCircle2,
  Lock,
  Play,
  Sparkles,
  Award,
  ArrowRight,
  TrendingUp,
  Target
} from 'lucide-react';
import {
  CURRICULUM_LESSONS,
  loadStudentProgress,
  loadTeacherSettings,
  StudentProgress
} from '../lib/learningStore';
import { BadgesList, CertificateModal, ALL_BADGES } from '../components/BadgesAndCertificate';

export default function LearningPath() {
  const [progress] = useState<StudentProgress>(loadStudentProgress);
  const [settings] = useState(loadTeacherSettings);
  const [showCertificate, setShowCertificate] = useState(false);

  const completedCount = progress.completedLessons.length;
  const progressPercent = Math.round((completedCount / CURRICULUM_LESSONS.length) * 100);

  // Find recommended next lesson
  const nextLesson =
    CURRICULUM_LESSONS.find((l) => !progress.completedLessons.includes(l.id)) ||
    CURRICULUM_LESSONS[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-400/30 text-indigo-200 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            เส้นทางการเรียนรู้ระบบสมการเชิงเส้น
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            ยินดีต้อนรับสู่ <span className="text-indigo-400">MatrixMaster Journey</span>
          </h1>
          <p className="text-xs sm:text-sm text-indigo-200 max-w-xl">
            เรียนรู้ระบบสมการเชิงเส้นครบถ้วน {CURRICULUM_LESSONS.length} บทเรียน ตั้งแต่พื้นฐาน AX = B ไปจนถึง Gaussian Elimination การประยุกต์ใช้งานวิศวกรรม/ไอซีที และระบบสมการขั้นสูง
          </p>
        </div>

        <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl flex items-center gap-4 min-w-[240px]">
          <div className="w-12 h-12 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-black text-lg shadow-inner">
            {progressPercent}%
          </div>
          <div>
            <p className="text-xs sm:text-[10px] font-bold text-indigo-200 uppercase tracking-wider">ความก้าวหน้าหลักสูตร</p>
            <p className="text-sm font-extrabold text-white">เรียนไปแล้ว {completedCount} / {CURRICULUM_LESSONS.length} บทเรียน</p>
            <div className="w-32 h-2 bg-white/20 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Recommended Next Lesson Card */}
      <div className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center border border-indigo-100 flex-shrink-0">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs sm:text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest">
              บทเรียนแนะนำถัดไป
            </span>
            <h3 className="text-lg font-black text-slate-800">{nextLesson.title}</h3>
            <p className="text-xs text-slate-500 mt-1">{nextLesson.subtitle}</p>
          </div>
        </div>
        <Link
          to={`/learning/lesson/${nextLesson.id}`}
          className="w-full sm:w-auto px-6 py-3 min-h-11 sm:min-h-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 flex-shrink-0"
        >
          <Play className="w-4 h-4 fill-white" /> เริ่มเรียนบทเรียนนี้
        </Link>
      </div>

      {/* Curriculum Roadmap */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800">
            แผนผังบทเรียนทั้งหมด ({CURRICULUM_LESSONS.length} Lessons)
          </h2>
          {completedCount >= CURRICULUM_LESSONS.length && (
            <button
              onClick={() => setShowCertificate(true)}
              className="px-4 py-2 min-h-11 sm:min-h-0 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition-colors flex items-center gap-2 shadow-sm"
            >
              <Award className="w-4 h-4" /> รับเกียรติบัตรเรียนจบหลักสูตร
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CURRICULUM_LESSONS.map((lesson) => {
            const isCompleted = progress.completedLessons.includes(lesson.id);
            const isNext = lesson.id === nextLesson.id;
            const hasUnmetPrereq = (lesson.prerequisites || []).some(
              (pId) => !progress.completedLessons.includes(pId)
            );

            return (
              <div
                key={lesson.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                  isCompleted
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : isNext
                    ? 'bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-md'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-500 text-white'
                          : isNext
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : lesson.id}
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800">{lesson.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 leading-snug">{lesson.subtitle}</p>
                    </div>
                  </div>

                  {hasUnmetPrereq && !isCompleted && (
                    <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs sm:text-[10px] font-bold flex items-center gap-1 flex-shrink-0">
                      <Lock className="w-3 h-3" /> แนะนำทบทวนก่อน
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <span className="text-slate-400 font-medium">~{lesson.estimatedMinutes} นาที</span>
                  <Link
                    to={`/learning/lesson/${lesson.id}`}
                    className={`font-bold px-4 py-1.5 min-h-11 sm:min-h-0 rounded-lg transition-colors flex items-center gap-1.5 ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : isNext
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {isCompleted ? 'ทบทวนอีกครั้ง' : 'เข้าเรียนบทนี้'} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Badges Earned Section — hidden entirely (not just disabled) when the teacher has
          turned badges off. New badges also stop being awarded — see LessonView.tsx. */}
      {settings.enableBadges && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">เหรียญตราความสำเร็จ (Badges)</h3>
              <p className="text-xs text-slate-500">ปลดล็อกเหรียญตราเมื่อผ่านหัวข้อการเรียนรู้ต่างๆ</p>
            </div>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              {progress.earnedBadges.length} / {ALL_BADGES.length} Badges
            </span>
          </div>
          <BadgesList progress={progress} />
        </div>
      )}

      {/* Certificate Modal */}
      {showCertificate && (
        <CertificateModal
          progress={progress}
          showXp={settings.enableXp}
          showBadges={settings.enableBadges}
          onCloseCertificate={() => setShowCertificate(false)}
        />
      )}
    </div>
  );
}
