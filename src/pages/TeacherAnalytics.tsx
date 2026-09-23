import { useState, useEffect } from 'react';
import { BarChart, Users, AlertTriangle, RefreshCw, Info, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadTeacherSettings, TeacherSettings } from '../lib/learningStore';
import type { StudentRecord, ClassSummary } from '../lib/classroomStore';
import { StudentRosterRow } from '../components/StudentRosterRow';
import { SurveyResultsPanel } from '../components/SurveyResultsPanel';
import { cn } from '../lib/utils';

export default function TeacherAnalytics() {
  const [settings] = useState<TeacherSettings>(loadTeacherSettings);
  // A teacher can have MULTIPLE classrooms (e.g. one per period) — this used to hardcode to
  // just the single most-recently-created one via getTeacherClassCode(), so a teacher with
  // more than one class could never see any but the first. Fetch the real list instead and let
  // them switch.
  const [allClasses, setAllClasses] = useState<ClassSummary[] | null>(null);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [classCode, setClassCode] = useState<string | null>(null);
  // "All classrooms combined" scope for the aggregate panels (survey results, efficiency stats).
  // The per-student roster always needs one specific class, so it keeps using classCode.
  const [showAllClasses, setShowAllClasses] = useState(false);
  const [roster, setRoster] = useState<StudentRecord[] | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  async function refreshAllClasses() {
    setClassesLoading(true);
    setClassesError(null);
    try {
      const res = await fetch('/api/classroom');
      const data = await res.json();
      const classes = (data.classes as ClassSummary[]) || [];
      setAllClasses(classes);
      // listClasses() returns most-recently-created first — default to that one, but don't
      // clobber a selection the teacher already made.
      setClassCode((prev) => prev ?? classes[0]?.classCode ?? null);
    } catch {
      setClassesError('ไม่สามารถดึงรายชื่อห้องเรียนได้ ลองรีเฟรชอีกครั้ง');
    } finally {
      setClassesLoading(false);
    }
  }

  useEffect(() => {
    refreshAllClasses();
  }, []);

  async function refreshRoster(code: string) {
    setRosterLoading(true);
    setRosterError(null);
    try {
      const res = await fetch(`/api/classroom/${encodeURIComponent(code)}/roster`);
      if (res.status === 404) {
        setRosterError('ไม่พบรหัสห้องนี้ในระบบแล้ว (อาจถูกล้างข้อมูลฝั่งเซิร์ฟเวอร์) ไปสร้างรหัสใหม่ที่หน้าตั้งค่า');
        setRoster(null);
        return;
      }
      const data = await res.json();
      setRoster(data.students as StudentRecord[]);
    } catch {
      setRosterError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ลองรีเฟรชอีกครั้ง');
    } finally {
      setRosterLoading(false);
    }
  }

  useEffect(() => {
    if (classCode) refreshRoster(classCode);
  }, [classCode]);

  const currentClass = allClasses?.find((c) => c.classCode === classCode) || null;
  // Scope for the aggregate panels: null = every classroom combined.
  const aggregateClassCode = showAllClasses ? null : classCode;
  const aggregateScopeLabel =
    aggregateClassCode === null
      ? 'ภาพรวมผู้เรียนทุกห้องเรียน'
      : `ห้อง ${aggregateClassCode}${currentClass?.note ? ` (${currentClass.note})` : ''}`;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl">
        <div className="inline-flex items-center gap-2 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-400/30 text-indigo-200 text-xs font-bold mb-2">
          <BarChart className="w-3.5 h-3.5 text-indigo-300" />
          วิเคราะห์ผลการเรียน (Analytics)
        </div>
        <h1 className="text-2xl sm:text-3xl font-black">
          ความก้าวหน้า <span className="text-indigo-400">ของนักเรียนจริง</span>
        </h1>
        <p className="text-xs sm:text-sm text-indigo-200 mt-1">
          รายชื่อ คะแนน และระดับความเชี่ยวชาญของนักเรียนที่เข้าร่วมห้องเรียนด้วยรหัสห้อง
        </p>
      </div>

      {/* Classroom Selector — a teacher can have multiple classrooms (e.g. one per period) */}
      {allClasses && allClasses.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-slate-500 flex-shrink-0">เลือกห้องเรียน:</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowAllClasses(true)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors',
                showAllClasses
                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
              )}
            >
              ทุกห้องเรียน (ภาพรวม)
            </button>
            {allClasses.map((cls) => (
              <button
                key={cls.classCode}
                onClick={() => {
                  setClassCode(cls.classCode);
                  setShowAllClasses(false);
                }}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors',
                  !showAllClasses && classCode === cls.classCode
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                )}
              >
                {cls.classCode}
                {cls.note ? ` — ${cls.note}` : ''} ({cls.studentCount} คน)
              </button>
            ))}
          </div>
        </div>
      )}
      {classesError && <p className="text-xs font-bold text-rose-600">{classesError}</p>}

      {/* Class Overview Stats — settings-derived + a real roster count once a class exists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-bold">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">เกณฑ์ความเชี่ยวชาญ</p>
            <p className="text-2xl font-black text-slate-800">{settings.masteryThreshold}%</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">นักเรียนในห้อง (จริง)</p>
            <p className="text-2xl font-black text-emerald-600">{roster ? roster.length : '—'}</p>
          </div>
        </div>
      </div>

      {/* Real per-student roster (Phase 2, no-login). Before a class exists, this shows an
          honest empty state pointing to Settings — no fabricated table appears at any point. */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" /> รายชื่อและความก้าวหน้านักเรียน
            {currentClass && !showAllClasses && (
              <span className="text-xs font-bold text-indigo-500">
                — {currentClass.classCode}
                {currentClass.note ? ` (${currentClass.note})` : ''}
              </span>
            )}
          </h3>
          {classCode && (
            <button
              onClick={() => refreshRoster(classCode)}
              disabled={rosterLoading}
              className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', rosterLoading && 'animate-spin')} /> รีเฟรช
            </button>
          )}
        </div>

        {showAllClasses ? (
          <p className="text-xs text-slate-500 leading-relaxed">
            รายชื่อรายคนแสดงทีละห้องเรียน — เลือกห้องเรียนด้านบนเพื่อดูรายชื่อ (ส่วนสรุปผลอื่นในหน้านี้แสดงภาพรวมทุกห้องเรียนอยู่)
          </p>
        ) : classesLoading && !allClasses ? (
          <p className="text-xs text-slate-400 font-medium">กำลังโหลดรายชื่อห้องเรียน...</p>
        ) : !classCode ? (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-500 leading-relaxed">
                ยังไม่มีห้องเรียนใดถูกสร้างเลย — ไปสร้างรหัสห้องเรียนที่หน้าตั้งค่าก่อน แล้วบอกนักเรียน
                ให้พิมพ์รหัสนี้ตอนเข้าเรียนครั้งแรก (ไม่ต้อง login) รายชื่อจริงจะมาปรากฏที่นี่
              </p>
              <Link
                to="/teacher/settings"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                <LinkIcon className="w-3.5 h-3.5" /> ไปที่หน้าตั้งค่าชั้นเรียน
              </Link>
            </div>
          </div>
        ) : (
          <>
            {rosterError && <p className="text-xs font-bold text-rose-600">{rosterError}</p>}

            {roster && roster.length === 0 && !rosterError && (
              <p className="text-xs text-slate-500 leading-relaxed">
                ยังไม่มีนักเรียนเข้าร่วมห้องนี้ — เมื่อนักเรียนพิมพ์รหัสห้องนี้ครั้งแรก รายชื่อและความก้าวหน้า
                จริงจะปรากฏที่นี่โดยอัตโนมัติ
              </p>
            )}

            {roster && roster.length > 0 && (
              <div className="space-y-3">
                {roster.map((s) => (
                  <StudentRosterRow
                    key={s.studentId}
                    student={s}
                    masteryThreshold={settings.masteryThreshold}
                    classCode={classCode!}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Anonymous post-course satisfaction survey — aggregates only (see lib/surveyStore.ts). */}
      <SurveyResultsPanel classCode={aggregateClassCode} scopeLabel={aggregateScopeLabel} />
    </div>
  );
}
