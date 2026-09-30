import { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart, Users, AlertTriangle, RefreshCw, Info, Link as LinkIcon, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadTeacherSettings, TeacherSettings } from '../lib/learningStore';
import { isClassIncludedInResearch, StudentRecord, ClassSummary } from '../lib/classroomStore';
import { StudentRosterRow } from '../components/StudentRosterRow';
import { SurveyResultsPanel } from '../components/SurveyResultsPanel';
import { EfficiencyStatsPanel } from '../components/EfficiencyStatsPanel';
import { computeResearchEfficiencyStats, ClassroomEfficiencyInput } from '../lib/efficiencyStats';
import { fetchSurveyResults } from '../lib/surveyClient';
import type { SurveyAggregate } from '../lib/surveyStore';
import { buildReportData, buildResearchMetadata, reportFileName, downloadJsonFile } from '../lib/reportExport';
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

  // Every research classroom's students, for the "all classrooms" E1/E2/E.I. view — fetched via
  // the same per-class roster endpoint (one request per class). Classrooms marked
  // includeInResearch=false are never fetched here. Only the latest fetch may land.
  const [allStudents, setAllStudents] = useState<ClassroomEfficiencyInput[] | null>(null);
  const [allStudentsError, setAllStudentsError] = useState<string | null>(null);
  const allStudentsRequest = useRef(0);

  useEffect(() => {
    if (!showAllClasses || !allClasses) return;
    const requestId = ++allStudentsRequest.current;
    setAllStudents(null);
    setAllStudentsError(null);
    Promise.all(
      allClasses.filter(isClassIncludedInResearch).map(async (cls): Promise<ClassroomEfficiencyInput> => {
        const res = await fetch(`/api/classroom/${encodeURIComponent(cls.classCode)}/roster`);
        if (res.status === 404) return { includeInResearch: cls.includeInResearch, students: [] };
        if (!res.ok) throw new Error(`roster ${cls.classCode}`);
        const students = ((await res.json()).students as StudentRecord[]) || [];
        return { includeInResearch: cls.includeInResearch, students: students.map((s) => s.progress) };
      })
    )
      .then((classrooms) => {
        if (requestId === allStudentsRequest.current) setAllStudents(classrooms);
      })
      .catch(() => {
        if (requestId === allStudentsRequest.current) setAllStudentsError('ไม่สามารถดึงข้อมูลนักเรียนทุกห้องได้ ลองรีเฟรชอีกครั้ง');
      });
  }, [showAllClasses, allClasses]);

  const currentClass = allClasses?.find((c) => c.classCode === classCode) || null;
  // A single selected classroom the teacher excluded from the research shows no research figures
  // at all (E1/E2/E.I. or survey) — a notice replaces them.
  const currentClassExcluded = !showAllClasses && !!currentClass && !isClassIncludedInResearch(currentClass);
  const excludedClassCount = allClasses ? allClasses.filter((c) => !isClassIncludedInResearch(c)).length : 0;

  const efficiencyStats = useMemo(() => {
    if (showAllClasses) return allStudents ? computeResearchEfficiencyStats(allStudents) : null;
    if (!roster || !currentClass) return null;
    return computeResearchEfficiencyStats([
      { includeInResearch: currentClass.includeInResearch, students: roster.map((s) => s.progress) }
    ]);
  }, [showAllClasses, allStudents, roster, currentClass]);

  // Export Report Data: always fetches fresh rosters + survey aggregates for EVERY classroom
  // (independent of the selector scope above), and refuses to write a partial file — a research
  // report silently missing a classroom would be worse than no file.
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExportReport() {
    if (!allClasses || allClasses.length === 0) return;
    setExporting(true);
    setExportError(null);
    try {
      const [rosters, surveyAll, surveys] = await Promise.all([
        Promise.all(
          allClasses.map(async (cls) => {
            const res = await fetch(`/api/classroom/${encodeURIComponent(cls.classCode)}/roster`);
            if (res.status === 404) return [] as StudentRecord[];
            if (!res.ok) throw new Error(`roster ${cls.classCode}`);
            return ((await res.json()).students as StudentRecord[]) || [];
          })
        ),
        // The server's all-classrooms aggregate already leaves out non-research classrooms.
        fetchSurveyResults(null),
        Promise.all(
          allClasses.map((cls) =>
            isClassIncludedInResearch(cls) ? fetchSurveyResults(cls.classCode) : Promise.resolve(null)
          )
        )
      ]);
      if (!surveyAll || surveys.some((sv, i) => !sv && isClassIncludedInResearch(allClasses[i]))) {
        throw new Error('survey');
      }
      const rostersByClass: Record<string, StudentRecord[]> = {};
      const surveyByClass: Record<string, SurveyAggregate> = {};
      allClasses.forEach((cls, i) => {
        rostersByClass[cls.classCode] = rosters[i];
        const survey = surveys[i];
        if (survey) surveyByClass[cls.classCode] = survey;
      });
      const now = new Date();
      downloadJsonFile(
        reportFileName(now),
        buildReportData({
          classes: allClasses,
          rostersByClass,
          surveyAll,
          surveyByClass,
          // Read fresh: the teacher may have edited Settings since this page mounted.
          metadata: buildResearchMetadata(loadTeacherSettings()),
          generatedAt: now
        })
      );
    } catch {
      setExportError('ไม่สามารถดึงข้อมูลครบทุกห้องเรียนเพื่อส่งออกได้ ลองใหม่อีกครั้ง');
    } finally {
      setExporting(false);
    }
  }

  // Scope for the aggregate panels: null = every classroom combined.
  const aggregateClassCode = showAllClasses ? null : classCode;
  const aggregateScopeLabel =
    aggregateClassCode === null
      ? excludedClassCount > 0
        ? `ภาพรวมผู้เรียนทุกห้องเรียน (ไม่รวม ${excludedClassCount} ห้องที่ไม่นับในสถิติวิจัย)`
        : 'ภาพรวมผู้เรียนทุกห้องเรียน'
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
                {!isClassIncludedInResearch(cls) && ' · ไม่นับในสถิติวิจัย'}
              </button>
            ))}
          </div>
        </div>
      )}
      {classesError && <p className="text-xs font-bold text-rose-600">{classesError}</p>}

      {/* Export Report Data — one JSON file (E1/E2/E.I., survey aggregates, roster counts),
          aggregate and per-classroom, for an external research report. */}
      {allClasses && allClasses.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 leading-relaxed">
            ไฟล์ JSON รวม E1/E2/E.I. ผลแบบประเมินความพึงพอใจ และจำนวนนักเรียน — ทั้งภาพรวมและรายห้องเรียน
          </p>
          <button
            onClick={handleExportReport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-11 sm:min-h-0 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Download className={cn('w-4 h-4', exporting && 'animate-pulse')} />
            {exporting ? 'กำลังเตรียมไฟล์...' : 'ส่งออกข้อมูลรายงาน (Export Report Data)'}
          </button>
          {exportError && <p className="w-full text-xs font-bold text-rose-600">{exportError}</p>}
        </div>
      )}

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

      {/* A classroom excluded from the research gets no research figures at all (E1/E2/E.I. and
          the survey below) — see ClassRecord.includeInResearch. */}
      {currentClassExcluded && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-start gap-3">
          <Info className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong>{aggregateScopeLabel}</strong> ถูกตั้งค่าไม่ให้นับรวมในสถิติวิจัย จึงไม่แสดงค่า E1/E2/E.I.
            และผลแบบประเมินความพึงพอใจของห้องนี้ และไม่นำไปรวมในภาพรวมหรือไฟล์ส่งออกรายงาน — เปลี่ยนได้ที่หน้าตั้งค่าชั้นเรียน
          </p>
        </div>
      )}

      {/* E1 / E2 / E.I. — follows the classroom selector above (one class, or all combined). */}
      {(classCode || showAllClasses) && !currentClassExcluded && (
        <EfficiencyStatsPanel
          stats={efficiencyStats}
          scopeLabel={aggregateScopeLabel}
          error={showAllClasses ? allStudentsError : rosterError}
        />
      )}

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
      {!currentClassExcluded && <SurveyResultsPanel classCode={aggregateClassCode} scopeLabel={aggregateScopeLabel} />}
    </div>
  );
}
