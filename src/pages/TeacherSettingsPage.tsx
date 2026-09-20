import { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  Sliders,
  ToggleLeft,
  ToggleRight,
  BookOpen,
  Info,
  Plus,
  Loader2,
  RefreshCw,
  Lock,
  LockOpen
} from 'lucide-react';
import { loadTeacherSettings, saveTeacherSettings, TeacherSettings } from '../lib/learningStore';
import { getTeacherClassCode, setTeacherClassCode, clearTeacherClassCode } from '../lib/classroomSync';
import type { ClassSummary } from '../lib/classroomStore';
import { cn } from '../lib/utils';

const FEATURE_TOGGLES: { key: keyof TeacherSettings; label: string }[] = [
  { key: 'enableAiTutor', label: 'Gemini AI Tutor (ครูผู้ช่วย)' },
  { key: 'enableHints', label: 'คำใบ้แบบไล่ระดับ (Progressive Hints)' },
  { key: 'enableXp', label: 'ระบบคะแนนสะสม (XP)' },
  { key: 'enableBadges', label: 'ระบบตราประทับเกียรติยศ (Badges)' }
];

export default function TeacherSettingsPage() {
  const [settings, setSettings] = useState<TeacherSettings>(loadTeacherSettings);
  const [classCode, setClassCode] = useState<string | null>(getTeacherClassCode);
  const [creatingClass, setCreatingClass] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);

  const [allClasses, setAllClasses] = useState<ClassSummary[] | null>(null);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);

  function updateSettings(patch: Partial<TeacherSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveTeacherSettings(next);
  }

  async function refreshAllClasses() {
    setClassesLoading(true);
    setClassesError(null);
    try {
      const res = await fetch('/api/classroom');
      const data = await res.json();
      setAllClasses((data.classes as ClassSummary[]) || []);
    } catch {
      setClassesError('ไม่สามารถดึงรายชื่อห้องเรียนได้ ลองรีเฟรชอีกครั้ง');
    } finally {
      setClassesLoading(false);
    }
  }

  useEffect(() => {
    refreshAllClasses();
  }, []);

  async function handleCreateClass() {
    setCreatingClass(true);
    setClassError(null);
    try {
      const res = await fetch('/api/classroom', { method: 'POST' });
      const data = await res.json();
      if (data.classCode) {
        setTeacherClassCode(data.classCode);
        setClassCode(data.classCode);
        refreshAllClasses();
      } else {
        setClassError('ไม่สามารถสร้างรหัสห้องเรียนได้ในขณะนี้ ลองใหม่อีกครั้ง');
      }
    } catch {
      setClassError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ลองใหม่อีกครั้ง');
    } finally {
      setCreatingClass(false);
    }
  }

  function handleResetClassCode() {
    if (
      !window.confirm(
        'สร้างรหัสห้องใหม่? (รหัสเดิมจะไม่แสดงในหน้านี้อีก แต่ข้อมูลนักเรียนที่เข้าร่วมไว้เดิมยังอยู่บนเซิร์ฟเวอร์)'
      )
    ) {
      return;
    }
    clearTeacherClassCode();
    setClassCode(null);
  }

  async function handleToggleActive(code: string, currentlyActive: boolean) {
    setTogglingCode(code);
    try {
      await fetch(`/api/classroom/${encodeURIComponent(code)}/${currentlyActive ? 'close' : 'reopen'}`, {
        method: 'POST'
      });
      await refreshAllClasses();
    } finally {
      setTogglingCode(null);
    }
  }

  return (
    <div className="space-y-6 pb-12 max-w-3xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl">
        <div className="inline-flex items-center gap-2 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-400/30 text-indigo-200 text-xs font-bold mb-2">
          <Settings className="w-3.5 h-3.5 text-indigo-300" />
          ตั้งค่าชั้นเรียน (Teacher Settings)
        </div>
        <h1 className="text-2xl sm:text-3xl font-black">
          ตั้งค่าการสอน <span className="text-indigo-400">& รหัสห้องเรียน</span>
        </h1>
        <p className="text-xs sm:text-sm text-indigo-200 mt-1">
          ปรับแต่งเกณฑ์ความเชี่ยวชาญ ระดับความยากแบบฝึกหัด ฟีเจอร์ช่วยสอน และสร้างรหัสห้องเรียน
        </p>
      </div>

      {/* Classroom code generation (Phase 2, no-login: class code + name, never an account) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" /> รหัสห้องเรียน
        </h3>

        {!classCode ? (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div className="space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                แอปนี้ออกแบบให้นักเรียน<strong>เข้าศึกษาได้ทันทีโดยไม่ต้อง login</strong> หากต้องการเห็น
                ความก้าวหน้าจริงของนักเรียนแต่ละคนในหน้า "วิเคราะห์ผลการเรียน" ให้สร้างรหัสห้องเรียนแล้ว
                บอกนักเรียนให้พิมพ์รหัสนี้ (ไม่มีบัญชีผู้ใช้ ไม่มีรหัสผ่าน) ตอนเข้าเรียนครั้งแรก
              </p>
              <button
                onClick={handleCreateClass}
                disabled={creatingClass}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-60"
              >
                {creatingClass ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                สร้างรหัสห้องเรียน
              </button>
              {classError && <p className="text-xs font-bold text-rose-600">{classError}</p>}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex-wrap">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">รหัสห้องของคุณ</span>
            <span className="text-2xl font-black text-indigo-700 tracking-[0.2em]">{classCode}</span>
            <button
              onClick={handleResetClassCode}
              className="ml-auto text-[11px] text-slate-400 hover:text-rose-500 font-bold"
            >
              สร้างรหัสใหม่
            </button>
          </div>
        )}
      </div>

      {/* All classes this server knows about — not limited to whichever one code this
          browser's localStorage happens to remember (see server.ts's GET /api/classroom). */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-600" /> ห้องเรียนทั้งหมด
          </h3>
          <button
            onClick={refreshAllClasses}
            disabled={classesLoading}
            className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', classesLoading && 'animate-spin')} /> รีเฟรช
          </button>
        </div>

        {classesError && <p className="text-xs font-bold text-rose-600">{classesError}</p>}

        {allClasses && allClasses.length === 0 && !classesError && (
          <p className="text-xs text-slate-500 leading-relaxed">
            ยังไม่มีห้องเรียนใดถูกสร้างบนเซิร์ฟเวอร์นี้เลย
          </p>
        )}

        {allClasses && allClasses.length > 0 && (
          <div className="space-y-2">
            {allClasses.map((cls) => (
              <div
                key={cls.classCode}
                className="flex items-center justify-between flex-wrap gap-3 border border-slate-200 rounded-xl p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-black text-slate-800 tracking-[0.15em] text-sm">{cls.classCode}</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border',
                      cls.active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    )}
                  >
                    {cls.active ? 'ใช้งานอยู่' : 'ปิดใช้งานแล้ว'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                  <span>{cls.studentCount} นักเรียน</span>
                  <span>{new Date(cls.createdAt).toLocaleDateString('th-TH')}</span>
                  <button
                    onClick={() => handleToggleActive(cls.classCode, cls.active)}
                    disabled={togglingCode === cls.classCode}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors disabled:opacity-60',
                      cls.active
                        ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                    )}
                  >
                    {togglingCode === cls.classCode ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : cls.active ? (
                      <Lock className="w-3 h-3" />
                    ) : (
                      <LockOpen className="w-3 h-3" />
                    )}
                    {cls.active ? 'ปิดห้อง' : 'เปิดห้องอีกครั้ง'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Teaching settings */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-600" />
            เกณฑ์ขั้นต่ำความเชี่ยวชาญ (Mastery Threshold): {settings.masteryThreshold}%
          </label>
          <input
            type="range"
            min="50"
            max="90"
            step="5"
            value={settings.masteryThreshold}
            onChange={(e) => updateSettings({ masteryThreshold: parseInt(e.target.value, 10) })}
            className="w-full accent-indigo-600"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            ระดับความยากของแบบฝึกหัด
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['Easy', 'Medium', 'Hard'] as const).map((diff) => (
              <button
                key={diff}
                type="button"
                onClick={() => updateSettings({ exerciseDifficulty: diff })}
                className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                  settings.exerciseDifficulty === diff
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 block">จำนวนข้อต่อชุดแบบฝึกหัด</label>
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 20].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => updateSettings({ questionsPerSet: count })}
                className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                  settings.questionsPerSet === count
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                {count} ข้อ
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">เปิด/ปิดฟีเจอร์ช่วยสอน</p>
          {FEATURE_TOGGLES.map((toggle) => {
            const val = Boolean(settings[toggle.key]);
            return (
              <div key={toggle.key} className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>{toggle.label}</span>
                <button
                  type="button"
                  onClick={() => updateSettings({ [toggle.key]: !val } as Partial<TeacherSettings>)}
                  className={`p-1 rounded-full transition-colors ${val ? 'text-indigo-600' : 'text-slate-300'}`}
                >
                  {val ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
