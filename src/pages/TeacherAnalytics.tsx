import { useState, useEffect } from 'react';
import { BarChart, Users, AlertTriangle, RefreshCw, Info, Wand2, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadTeacherSettings, TeacherSettings } from '../lib/learningStore';
import { getTeacherClassCode } from '../lib/classroomSync';
import { TOPIC_LABELS, TopicKey } from '../lib/topics';
import type { StudentRecord } from '../lib/classroomStore';
import { RenderTextWithMath } from '../components/math/MathComponents';
import { cn } from '../lib/utils';

export default function TeacherAnalytics() {
  const [settings] = useState<TeacherSettings>(loadTeacherSettings);
  const [classCode] = useState<string | null>(getTeacherClassCode);
  const [roster, setRoster] = useState<StudentRecord[] | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [aiPanel, setAiPanel] = useState<{ studentId: string; topic: TopicKey } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState('');

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
            <div className="space-y-2">
              <p className="text-xs text-slate-500 leading-relaxed">
                ยังไม่ได้สร้างรหัสห้องเรียนบนเครื่องนี้ — ไปสร้างรหัสห้องเรียนที่หน้าตั้งค่าก่อน แล้วบอกนักเรียน
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

      {/* Common Conceptual Errors — general reference notes from teaching experience /
          matrix-education literature, NOT derived from this system's usage data. */}
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
    </div>
  );
}
