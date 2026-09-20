import { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  AlertTriangle,
  Sliders,
  ToggleLeft,
  ToggleRight,
  BookOpen,
  Info,
  RefreshCw,
  Plus,
  Loader2,
  Wand2
} from 'lucide-react';
import {
  loadTeacherSettings,
  saveTeacherSettings,
  TeacherSettings
} from '../lib/learningStore';
import { getTeacherClassCode, setTeacherClassCode, clearTeacherClassCode } from '../lib/classroomSync';
import { TOPIC_LABELS, TopicKey } from '../lib/topics';
import type { StudentRecord } from '../lib/classroomStore';
import { RenderTextWithMath } from '../components/math/MathComponents';
import { cn } from '../lib/utils';

export default function TeacherDashboard() {
  const [settings, setSettings] = useState<TeacherSettings>(loadTeacherSettings);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [classCode, setClassCode] = useState<string | null>(getTeacherClassCode);
  const [creatingClass, setCreatingClass] = useState(false);
  const [roster, setRoster] = useState<StudentRecord[] | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [aiPanel, setAiPanel] = useState<{ studentId: string; topic: TopicKey } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  const handleSaveSettings = (newSettings: TeacherSettings) => {
    saveTeacherSettings(newSettings);
    setSettings(newSettings);
    setShowSettingsModal(false);
  };

  async function refreshRoster(code: string) {
    setRosterLoading(true);
    setRosterError(null);
    try {
      const res = await fetch(`/api/classroom/${encodeURIComponent(code)}/roster`);
      if (res.status === 404) {
        setRosterError('ไม่พบรหัสห้องนี้ในระบบแล้ว (อาจถูกล้างข้อมูลฝั่งเซิร์ฟเวอร์) ลองสร้างรหัสใหม่');
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

  async function handleCreateClass() {
    setCreatingClass(true);
    try {
      const res = await fetch('/api/classroom', { method: 'POST' });
      const data = await res.json();
      if (data.classCode) {
        setTeacherClassCode(data.classCode);
        setClassCode(data.classCode);
      }
    } catch {
      setRosterError('ไม่สามารถสร้างรหัสห้องเรียนได้ในขณะนี้ ลองใหม่อีกครั้ง');
    } finally {
      setCreatingClass(false);
    }
  }

  function handleResetClassCode() {
    if (!window.confirm('สร้างรหัสห้องใหม่? (รหัสเดิมและนักเรียนที่เข้าร่วมไว้จะไม่แสดงในหน้านี้อีก แต่ข้อมูลเดิมยังอยู่บนเซิร์ฟเวอร์)')) {
      return;
    }
    clearTeacherClassCode();
    setClassCode(null);
    setRoster(null);
    setRosterError(null);
  }

  async function handleGenerateProblem(studentId: string, topic: TopicKey) {
    setAiPanel({ studentId, topic });
    setAiLoading(true);
    setAiText('');
    try {
      const res = await fetch('/api/ai-practice-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      const data = await res.json();
      setAiText(data.problemText || 'ขออภัยครับ ไม่สามารถสร้างโจทย์ได้ในขณะนี้');
    } catch {
      setAiText('เกิดข้อผิดพลาดในการเชื่อมต่อ AI โปรดลองใหม่อีกครั้ง');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-400/30 text-indigo-200 text-xs font-bold mb-2">
            <Users className="w-3.5 h-3.5 text-indigo-300" />
            แผงควบคุมการจัดการชั้นเรียน (Teacher Dashboard)
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            ตั้งค่าการสอน <span className="text-indigo-400">& ปรับแต่งชั้นเรียน</span>
          </h1>
          <p className="text-xs sm:text-sm text-indigo-200 mt-1">
            ปรับแต่งเกณฑ์ความเชี่ยวชาญ ระดับความยากแบบฝึกหัด และฟีเจอร์ช่วยสอน
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex-grow sm:flex-grow-0 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition-colors flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" /> ตั้งค่าการสอน
          </button>
        </div>
      </div>

      {/* Class Overview Stats — settings-derived values, plus a real roster count once a
          class exists (never a placeholder number). */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-bold">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">เกณฑ์ความเชี่ยวชาญ</p>
            <p className="text-2xl font-black text-slate-800">{settings.masteryThreshold}%</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ระดับความยาก</p>
            <p className="text-2xl font-black text-indigo-600">{settings.exerciseDifficulty}</p>
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

      {/* Classroom code + real per-student roster (Phase 2, no-login: class code + name,
          never an account). Before a class exists, this shows an honest empty state and a
          way to create one — no fabricated table or numbers appear at any point. */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" /> รหัสห้องเรียนและความก้าวหน้านักเรียน
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

        {!classCode ? (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div className="space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                แอปนี้ออกแบบให้นักเรียน<strong>เข้าศึกษาได้ทันทีโดยไม่ต้อง login</strong> หากต้องการเห็น
                ความก้าวหน้าจริงของนักเรียนแต่ละคน ให้สร้างรหัสห้องเรียนแล้วบอกนักเรียนให้พิมพ์รหัสนี้
                (ไม่มีบัญชีผู้ใช้ ไม่มีรหัสผ่าน) ตอนเข้าเรียนครั้งแรก
              </p>
              <button
                onClick={handleCreateClass}
                disabled={creatingClass}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-60"
              >
                {creatingClass ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                สร้างรหัสห้องเรียน
              </button>
            </div>
          </div>
        ) : (
          <>
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

            {rosterError && (
              <p className="text-xs font-bold text-rose-600">{rosterError}</p>
            )}

            {roster && roster.length === 0 && !rosterError && (
              <p className="text-xs text-slate-500 leading-relaxed">
                ยังไม่มีนักเรียนเข้าร่วมห้องนี้ — เมื่อนักเรียนพิมพ์รหัสห้องนี้ครั้งแรก รายชื่อและความก้าวหน้า
                จริงจะปรากฏที่นี่โดยอัตโนมัติ
              </p>
            )}

            {roster && roster.length > 0 && (
              <div className="space-y-3">
                {roster.map((s) => {
                  const weakTopics = (Object.keys(TOPIC_LABELS) as TopicKey[]).filter(
                    (k) => s.progress.topicMastery[k] < settings.masteryThreshold
                  );
                  return (
                    <div key={s.studentId} className="border border-slate-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-bold text-slate-800 text-sm">{s.displayName}</span>
                        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 flex-wrap">
                          <span>{s.progress.xp} XP</span>
                          <span>{s.progress.completedLessons.length} บทเรียน</span>
                          <span>Pre {s.progress.preTestCompleted ? `${s.progress.preTestScore}%` : '—'}</span>
                          <span>Post {s.progress.postTestCompleted ? `${s.progress.postTestScore}%` : '—'}</span>
                          <span>{s.progress.earnedBadges.length} Badges</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        อัปเดตล่าสุด: {new Date(s.lastSyncedAt).toLocaleString('th-TH')}
                      </p>

                      {weakTopics.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {weakTopics.map((t) => (
                            <button
                              key={t}
                              onClick={() => handleGenerateProblem(s.studentId, t)}
                              disabled={aiLoading && aiPanel?.studentId === s.studentId && aiPanel.topic === t}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[11px] font-bold hover:bg-amber-100 transition-colors disabled:opacity-60"
                            >
                              <Wand2 className="w-3 h-3" />
                              {TOPIC_LABELS[t]} ({s.progress.topicMastery[t]}%)
                            </button>
                          ))}
                        </div>
                      )}

                      {aiPanel?.studentId === s.studentId && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-slate-700 leading-relaxed">
                          {aiLoading ? (
                            <span className="text-slate-400">กำลังแต่งโจทย์สำหรับนักเรียนคนนี้...</span>
                          ) : (
                            <RenderTextWithMath text={aiText} />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Common Conceptual Errors — general reference notes from teaching
          experience / matrix-education literature, NOT derived from this
          system's usage data (there is none to analyze yet). */}
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

      {/* Teacher Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" /> ตั้งค่าการเรียนการสอน (Teacher Settings)
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-bold text-slate-700">
              {/* Threshold */}
              <div className="space-y-2">
                <label className="block">เกณฑ์ขั้นต่ำความเชี่ยวชาญ (Mastery Threshold): {settings.masteryThreshold}%</label>
                <input
                  type="range"
                  min="50"
                  max="90"
                  step="5"
                  value={settings.masteryThreshold}
                  onChange={(e) =>
                    setSettings({ ...settings, masteryThreshold: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-indigo-600"
                />
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <label className="block">ระดับความยากของแบบฝึกหัด</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Easy', 'Medium', 'Hard'] as const).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setSettings({ ...settings, exerciseDifficulty: diff })}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
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

              {/* Questions Count */}
              <div className="space-y-2">
                <label className="block">จำนวนข้อต่อชุดแบบฝึกหัด</label>
                <div className="grid grid-cols-3 gap-2">
                  {[5, 10, 20].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setSettings({ ...settings, questionsPerSet: count })}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
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

              {/* Feature Toggles */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">เปิด/ปิดฟีเจอร์ช่วยสอน</p>
                {[
                  { key: 'enableAiTutor', label: 'Gemini AI Tutor (ครูผู้ช่วย)' },
                  { key: 'enableHints', label: 'คำใบ้แบบไล่ระดับ (Progressive Hints)' },
                  { key: 'enableXp', label: 'ระบบคะแนนสะสม (XP)' },
                  { key: 'enableBadges', label: 'ระบบตราประทับเกียรติยศ (Badges)' }
                ].map((toggle) => {
                  const val = (settings as any)[toggle.key];
                  return (
                    <div key={toggle.key} className="flex items-center justify-between">
                      <span>{toggle.label}</span>
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, [toggle.key]: !val })}
                        className={`p-1 rounded-full transition-colors ${
                          val ? 'text-indigo-600' : 'text-slate-300'
                        }`}
                      >
                        {val ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => handleSaveSettings(settings)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md transition-colors"
              >
                บันทึกการตั้งค่า
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
