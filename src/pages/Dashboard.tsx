import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Target, Zap, BookOpen, Compass, ArrowRight, Sparkles, CheckCircle2, GraduationCap } from 'lucide-react';
import { loadStudentProgress, loadTeacherSettings, CURRICULUM_LESSONS } from '../lib/learningStore';

export default function Dashboard() {
  const [progress] = useState(loadStudentProgress);
  const [settings] = useState(loadTeacherSettings);
  const completedCount = progress.completedLessons.length;
  const progressPercent = Math.round((completedCount / CURRICULUM_LESSONS.length) * 100);

  const nextLesson =
    CURRICULUM_LESSONS.find((l) => !progress.completedLessons.includes(l.id)) ||
    CURRICULUM_LESSONS[0];

  return (
    <div className="h-full flex flex-col space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">
            ยินดีต้อนรับกลับมา, <span className="text-indigo-600">{progress.studentName}</span>!
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            ติดตามความก้าวหน้าและเรียนรู้ระบบสมการเชิงเส้นโดยใช้เมทริกซ์
          </p>
        </div>
        <Link
          to="/learning"
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <Compass className="w-4 h-4" /> ไปยังเส้นทางการเรียนรู้ ({CURRICULUM_LESSONS.length} บท)
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 auto-rows-min gap-4">
        {/* Stat 1 */}
        <div className="md:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">ความก้าวหน้ารวม</p>
            <p className="text-2xl font-black text-slate-800">{progressPercent}%</p>
            <p className="text-[10px] text-slate-400 font-medium">เรียนจบแล้ว {completedCount} / {CURRICULUM_LESSONS.length} บทเรียน</p>
          </div>
        </div>

        {/* Stat 2 — hidden entirely if both XP and Badges are disabled, since it has nothing
            left worth showing. */}
        {(settings.enableXp || settings.enableBadges) && (
          <div className="md:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div>
              {settings.enableXp && (
                <>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">คะแนนสะสม (XP)</p>
                  <p className="text-2xl font-black text-emerald-600">{progress.xp} XP</p>
                </>
              )}
              {settings.enableBadges && (
                <p
                  className={
                    settings.enableXp
                      ? 'text-[10px] text-slate-400 font-medium'
                      : 'text-2xl font-black text-emerald-600'
                  }
                >
                  {progress.earnedBadges.length} Badges ได้รับแล้ว
                </p>
              )}
            </div>
          </div>
        )}

        {/* Stat 3 */}
        <div className="md:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">คะแนน Pre/Post-Test</p>
            <p className="text-2xl font-black text-slate-800">
              {progress.postTestCompleted
                ? `${progress.postTestScore}%`
                : progress.preTestCompleted
                ? `${progress.preTestScore}% (Pre)`
                : 'ยังไม่ได้ทำ'}
            </p>
            <Link to="/post-test" className="text-[10px] font-bold text-indigo-600 hover:underline">
              ดูผลเปรียบเทียบ ➔
            </Link>
          </div>
        </div>

        {/* Curriculum Progress List — takes the full remaining width when the AI tutor teaser
            (below) is hidden, since there's nothing left to share the row with. */}
        <div className={`${settings.enableAiTutor ? 'md:col-span-7' : 'md:col-span-12'} bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">บทเรียนหลักสูตรปัจจุบัน</h3>
              <span className="text-xs text-indigo-600 font-bold">บทถัดไป: {nextLesson.title}</span>
            </div>

            <div className="space-y-2.5">
              {CURRICULUM_LESSONS.slice(0, 5).map((mod) => {
                const isCompleted = progress.completedLessons.includes(mod.id);
                return (
                  <div
                    key={mod.id}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
                      isCompleted
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isCompleted ? '✓' : mod.id}
                      </div>
                      <span className="font-bold">{mod.title}</span>
                    </div>
                    <Link
                      to={`/learning/lesson/${mod.id}`}
                      className="text-[10px] font-bold text-indigo-600 hover:underline"
                    >
                      {isCompleted ? 'ทบทวน' : 'เรียนรู้'}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">ดูบทเรียนทั้งหมด {CURRICULUM_LESSONS.length} บทเรียน</span>
            <Link to="/learning" className="font-bold text-indigo-600 flex items-center gap-1 hover:underline">
              เปิดแผนผังบทเรียน <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Gemini Math Tutor Container — a teaser for the real AI tutor in MatrixLab.tsx, so it
            follows the same enableAiTutor gate: hidden entirely, not just cosmetically, when
            the teacher has turned the AI tutor off. */}
        {settings.enableAiTutor && (
          <div className="md:col-span-5 bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl shadow-lg p-6 flex flex-col justify-between relative overflow-hidden text-white min-h-[360px]">
            <div className="relative z-10 flex flex-col h-full space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm shadow-inner">
                  ✨
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Gemini Math Assistant</h3>
                  <p className="text-[10px] text-indigo-200">ครูผู้ช่วยวิชาคณิตศาสตร์ (Socratic Guidance)</p>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 text-xs leading-relaxed text-indigo-100 flex-grow">
                "สวัสดี {progress.studentName}! ยินดีต้อนรับสู่บทเรียนระบบสมการเชิงเส้น คุณสามารถถามฉันเรื่องการเขียน AX=B, การหา det(A), Inverse Matrix หรือ Gaussian Elimination ได้ตลอดเวลา!"
              </div>

              <div className="pt-2">
                <Link
                  to={`/learning/lesson/${nextLesson.id}`}
                  className="w-full py-2.5 bg-white text-indigo-950 font-black text-xs rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  เริ่มเรียน {nextLesson.title} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
          </div>
        )}
      </div>

      {/* Creator Attribution Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                ผู้จัดทำสื่อการสอน
              </span>
            </div>
            <h4 className="text-sm font-extrabold text-slate-800 mt-0.5">
              ครูเกียรติศักดิ์ แก้วหล้า
            </h4>
            <p className="text-xs text-slate-500">
              ครูโรงเรียนอุตรดิตถ์ • วิทยฐานะ ครูชำนาญการพิเศษ
            </p>
          </div>
        </div>
        <div className="text-[11px] text-slate-400 font-medium self-end sm:self-center">
          สื่อการเรียนรู้วิชาคณิตศาสตร์ เรื่อง ระบบสมการเชิงเส้นและเมทริกซ์
        </div>
      </div>
    </div>
  );
}
