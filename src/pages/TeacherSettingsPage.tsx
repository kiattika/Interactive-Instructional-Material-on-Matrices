import { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Info,
  Plus,
  Loader2,
  RefreshCw,
  Lock,
  LockOpen,
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  X,
  QrCode,
  AlertTriangle
} from 'lucide-react';
import { loadTeacherSettings, saveTeacherSettings, TeacherSettings } from '../lib/learningStore';
import { getTeacherClassCode, setTeacherClassCode, clearTeacherClassCode } from '../lib/classroomSync';
import type { ClassSummary, StudentRecord } from '../lib/classroomStore';
import { StudentRosterRow } from '../components/StudentRosterRow';
import { QRCodeModal } from '../components/QRCodeModal';
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
  const [newClassNote, setNewClassNote] = useState('');
  const [creatingClass, setCreatingClass] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);

  const [allClasses, setAllClasses] = useState<ClassSummary[] | null>(null);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);

  // Inline note editing — one row editable at a time.
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Expandable per-class roster (fetched lazily on first expand, cached after that).
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [rosterByCode, setRosterByCode] = useState<Record<string, StudentRecord[]>>({});
  const [rosterLoadingFor, setRosterLoadingFor] = useState<string | null>(null);
  const [rosterErrorByCode, setRosterErrorByCode] = useState<Record<string, string>>({});

  const [qrModalCode, setQrModalCode] = useState<string | null>(null);

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
      const res = await fetch('/api/classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newClassNote })
      });
      const data = await res.json();
      if (data.classCode) {
        setTeacherClassCode(data.classCode);
        setClassCode(data.classCode);
        setNewClassNote('');
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

  function handleStartEditNote(code: string, currentNote?: string) {
    setEditingNoteFor(code);
    setNoteDraft(currentNote || '');
  }

  async function handleSaveNote(code: string) {
    setSavingNote(true);
    try {
      await fetch(`/api/classroom/${encodeURIComponent(code)}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteDraft })
      });
      await refreshAllClasses();
      setEditingNoteFor(null);
    } finally {
      setSavingNote(false);
    }
  }

  async function fetchRosterFor(code: string) {
    setRosterLoadingFor(code);
    setRosterErrorByCode((prev) => ({ ...prev, [code]: '' }));
    try {
      const res = await fetch(`/api/classroom/${encodeURIComponent(code)}/roster`);
      if (res.status === 404) {
        setRosterErrorByCode((prev) => ({ ...prev, [code]: 'ไม่พบรหัสห้องนี้ในระบบแล้ว' }));
        return;
      }
      const data = await res.json();
      setRosterByCode((prev) => ({ ...prev, [code]: data.students as StudentRecord[] }));
    } catch {
      setRosterErrorByCode((prev) => ({ ...prev, [code]: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ลองใหม่อีกครั้ง' }));
    } finally {
      setRosterLoadingFor(null);
    }
  }

  function handleToggleExpand(code: string) {
    const next = expandedCode === code ? null : code;
    setExpandedCode(next);
    if (next && !rosterByCode[next]) {
      fetchRosterFor(next);
    }
  }

  async function handleRemoveStudent(code: string, studentId: string) {
    await fetch(`/api/classroom/${encodeURIComponent(code)}/student/${encodeURIComponent(studentId)}`, {
      method: 'DELETE'
    });
    await fetchRosterFor(code);
    await refreshAllClasses();
  }

  const currentClassSummary = allClasses?.find((c) => c.classCode === classCode) || null;

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
          ปรับแต่งเกณฑ์ความเชี่ยวชาญ ฟีเจอร์ช่วยสอน และสร้างรหัสห้องเรียน
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
            <div className="space-y-3 flex-grow">
              <p className="text-xs text-slate-500 leading-relaxed">
                แอปนี้ออกแบบให้นักเรียน<strong>เข้าศึกษาได้ทันทีโดยไม่ต้อง login</strong> หากต้องการเห็น
                ความก้าวหน้าจริงของนักเรียนแต่ละคนในหน้า "วิเคราะห์ผลการเรียน" ให้สร้างรหัสห้องเรียนแล้ว
                บอกนักเรียนให้พิมพ์รหัสนี้ (ไม่มีบัญชีผู้ใช้ ไม่มีรหัสผ่าน) ตอนเข้าเรียนครั้งแรก
              </p>
              <input
                type="text"
                value={newClassNote}
                onChange={(e) => setNewClassNote(e.target.value)}
                placeholder="ป้ายชื่อห้อง (ไม่บังคับ) เช่น ม.5/8"
                className="w-full max-w-xs px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-400"
              />
              <div>
                <button
                  onClick={handleCreateClass}
                  disabled={creatingClass}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-60"
                >
                  {creatingClass ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  สร้างรหัสห้องเรียน
                </button>
              </div>
              {classError && <p className="text-xs font-bold text-rose-600">{classError}</p>}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex-wrap">
            <div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">
                รหัสห้องของคุณ
              </span>
              <span className="text-2xl font-black text-indigo-700 tracking-[0.2em]">{classCode}</span>
              {currentClassSummary?.note && (
                <span className="block text-xs font-bold text-indigo-500 mt-0.5">{currentClassSummary.note}</span>
              )}
            </div>
            <button
              onClick={() => setQrModalCode(classCode)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-[11px] font-bold hover:bg-indigo-100 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" /> แสดง QR
            </button>
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
          browser's localStorage happens to remember (see server.ts's GET /api/classroom).
          Each row expands to show the real joined students, and a note can be edited inline
          so classes are easy to tell apart at a glance. */}
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
            {allClasses.map((cls) => {
              const isExpanded = expandedCode === cls.classCode;
              const isEditingNote = editingNoteFor === cls.classCode;
              const roster = rosterByCode[cls.classCode];
              const rosterError = rosterErrorByCode[cls.classCode];

              return (
                <div key={cls.classCode} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between flex-wrap gap-3 p-3">
                    <button
                      onClick={() => handleToggleExpand(cls.classCode)}
                      className="flex items-center gap-2 min-w-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      )}
                      <span className="font-black text-slate-800 tracking-[0.15em] text-sm flex-shrink-0">
                        {cls.classCode}
                      </span>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border flex-shrink-0',
                          cls.active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        )}
                      >
                        {cls.active ? 'ใช้งานอยู่' : 'ปิดใช้งานแล้ว'}
                      </span>
                    </button>

                    {isEditingNote ? (
                      <div className="flex items-center gap-1.5 flex-grow min-w-[10rem]">
                        <input
                          autoFocus
                          type="text"
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="เช่น ม.5/8"
                          className="flex-grow px-2 py-1 border border-indigo-300 rounded-lg text-xs focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveNote(cls.classCode)}
                          disabled={savingNote}
                          className="text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingNoteFor(null)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartEditNote(cls.classCode, cls.note)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-700"
                      >
                        {cls.note ? (
                          <span>{cls.note}</span>
                        ) : (
                          <span className="text-slate-300 italic font-medium">ไม่มีป้ายชื่อ</span>
                        )}
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}

                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                      <span>{cls.studentCount} นักเรียน</span>
                      <span>{new Date(cls.createdAt).toLocaleDateString('th-TH')}</span>
                      <button
                        onClick={() => setQrModalCode(cls.classCode)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <QrCode className="w-3 h-3" /> QR
                      </button>
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

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-3 space-y-2">
                      {rosterLoadingFor === cls.classCode && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลดรายชื่อนักเรียน...
                        </p>
                      )}
                      {rosterError && <p className="text-xs font-bold text-rose-600">{rosterError}</p>}
                      {roster && roster.length === 0 && !rosterError && (
                        <p className="text-xs text-slate-500">ยังไม่มีนักเรียนเข้าร่วมห้องนี้</p>
                      )}
                      {roster &&
                        roster.length > 0 &&
                        roster.map((s) => (
                          <StudentRosterRow
                            key={s.studentId}
                            student={s}
                            masteryThreshold={settings.masteryThreshold}
                            classCode={cls.classCode}
                            onRemove={(studentId) => handleRemoveStudent(cls.classCode, studentId)}
                          />
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
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

      {/* Common Conceptual Errors — general reference notes from teaching experience /
          matrix-education literature, NOT derived from this system's usage data. Moved here
          from the Analytics page, where it sat oddly next to real per-student statistics. */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span>ข้อผิดพลาดเชิงมโนทัศน์ที่พบบ่อยโดยทั่วไป (ข้อมูลอ้างอิงทั่วไป ยังไม่ใช่สถิติจากนักเรียนจริง)</span>
        </div>
        <ul className="text-xs text-amber-950 space-y-2 list-disc list-inside leading-relaxed font-medium">
          <li><strong>Determinant 3x3:</strong> นักเรียนมักสับสนเครื่องหมายบวกลบเมื่อคูณทแยงลงและทแยงขึ้น</li>
          <li><strong>Cramer's Rule:</strong> มีแนวโน้มแทนที่คอลัมน์ B ผิดตำแหน่งตัวแปรในเมทริกซ์ Ay และ Az</li>
          <li><strong>Row Operations (ERO):</strong> มักนำเลข 0 ไปคูณทั้งแถว ซึ่งเป็นการดำเนินการที่ไม่อนุญาต</li>
        </ul>
      </div>

      {qrModalCode && <QRCodeModal classCode={qrModalCode} onClose={() => setQrModalCode(null)} />}
    </div>
  );
}
