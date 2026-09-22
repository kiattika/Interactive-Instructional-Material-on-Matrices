import { useState } from 'react';
import { X, Users, Loader2, CheckCircle2, GraduationCap, UserCheck } from 'lucide-react';
import { StudentProgress, saveStudentProgress } from '../lib/learningStore';
import { getClassroomLink, joinClassroom, clearClassroomLink, getStudentId, adoptStudentId } from '../lib/classroomSync';
import { findStudentsByDisplayName, StudentRecord } from '../lib/classroomStore';

interface ClassroomJoinModalProps {
  progress: StudentProgress;
  onClose: () => void;
  // Only offered when this modal is acting as the mandatory join gate (see AppLayout.tsx) —
  // opens the Teacher PIN prompt instead of the name/code form.
  onOpenTeacherLogin?: () => void;
  // Pre-fills the code field from a `?code=` URL param (e.g. from scanning the teacher's QR
  // code — see QRCodeModal.tsx) so the student only has to type their name, not the code too.
  // Never auto-submits — they still review/confirm before joining.
  prefillCode?: string;
}

export function ClassroomJoinModal({ progress, onClose, onOpenTeacherLogin, prefillCode }: ClassroomJoinModalProps) {
  const existingLink = getClassroomLink();
  // Joining is mandatory for a student who hasn't joined yet — this is NOT a dismissible
  // onboarding step, it's the access gate itself (see the Phase 2 access-control brief).
  // Once existingLink is set, this same component is reused as a voluntary, closable
  // "view/change my classroom" panel instead.
  const canDismiss = !!existingLink;
  const [name, setName] = useState(progress.studentName === 'นักเรียนใหม่' ? '' : progress.studentName);
  const [code, setCode] = useState(existingLink?.classCode || prefillCode || '');
  const [status, setStatus] = useState<'idle' | 'checking' | 'confirm-recovery' | 'joining' | 'error' | 'joined'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  // Populated when the name+code the student is about to join with already matches an existing
  // roster entry under a DIFFERENT studentId — almost certainly the same student switching
  // devices/browsers (see classroomSync.ts's getStudentId doc comment). Held here until the
  // student either adopts one of these as "me" or explicitly starts fresh.
  const [recoveryMatches, setRecoveryMatches] = useState<StudentRecord[]>([]);
  const [pendingJoin, setPendingJoin] = useState<{ code: string; name: string } | null>(null);

  const handleSaveNameOnly = () => {
    if (name.trim() && name.trim() !== progress.studentName) {
      saveStudentProgress({ ...progress, studentName: name.trim() });
    }
    onClose();
  };

  const completeJoin = async (trimmedCode: string, finalName: string) => {
    setStatus('joining');
    const updated = { ...progress, studentName: finalName };
    saveStudentProgress(updated); // local save always succeeds regardless of network
    const ok = await joinClassroom(trimmedCode, updated);
    if (ok) {
      setStatus('joined');
      setTimeout(onClose, 900);
    } else {
      setStatus('error');
      setErrorMessage('ไม่พบรหัสห้องนี้ หรือห้องเรียนนี้ถูกปิดใช้งานแล้ว ตรวจสอบกับครูอีกครั้ง');
    }
  };

  const handleJoin = async () => {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      if (canDismiss) {
        handleSaveNameOnly();
      } else {
        setStatus('error');
        setErrorMessage('กรุณาใส่รหัสห้องเรียนที่ครูให้ก่อนจึงจะเริ่มเรียนได้');
      }
      return;
    }
    const finalName = name.trim() || progress.studentName;

    // Best-effort device-switch recovery check: does this name already exist in this class
    // under a different studentId? Never blocks the common case (first-time join on the same
    // device throughout) — any failure here just falls through to a normal join attempt.
    setStatus('checking');
    let matches: StudentRecord[] = [];
    try {
      const res = await fetch(`/api/classroom/${encodeURIComponent(trimmedCode)}/roster`);
      if (res.ok) {
        const data = await res.json();
        matches = findStudentsByDisplayName((data.students as StudentRecord[]) || [], finalName, getStudentId());
      }
    } catch {
      // Offline or server unreachable — proceed to the normal join, which will surface its own
      // clear error if the class code itself turns out to be invalid.
    }

    if (matches.length > 0) {
      setRecoveryMatches(matches);
      setPendingJoin({ code: trimmedCode, name: finalName });
      setStatus('confirm-recovery');
      return;
    }

    await completeJoin(trimmedCode, finalName);
  };

  const handleAdoptMatch = async (match: StudentRecord) => {
    if (!pendingJoin) return;
    // Point this device at the EXISTING studentId going forward, and pull that record's synced
    // progress fields onto this device — local-only fields (lessonScores, answer logs, etc.)
    // stay whatever they currently are here, which is an accepted gap for this lightweight
    // recovery path (not a full account system).
    adoptStudentId(match.studentId);
    const merged: StudentProgress = { ...progress, ...match.progress, studentName: pendingJoin.name };
    saveStudentProgress(merged);
    await completeJoin(pendingJoin.code, pendingJoin.name);
  };

  const handleStartFresh = async () => {
    if (!pendingJoin) return;
    await completeJoin(pendingJoin.code, pendingJoin.name);
  };

  const handleLeaveClass = () => {
    clearClassroomLink();
    setCode('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-indigo-700 font-black text-sm">
            <Users className="w-5 h-5" /> {canDismiss ? 'ห้องเรียนของฉัน' : 'เข้าร่วมห้องเรียนเพื่อเริ่มเรียน'}
          </div>
          {canDismiss && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {status === 'confirm-recovery' ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              {recoveryMatches.length === 1 ? (
                <>
                  พบชื่อนี้ในห้องเรียนนี้แล้ว (เข้าร่วมล่าสุด{' '}
                  <strong className="text-slate-800">
                    {new Date(recoveryMatches[0].lastSyncedAt).toLocaleString('th-TH')}
                  </strong>
                  ) ต้องการดึงข้อมูลเดิมกลับมาใช้ต่อไหม?
                </>
              ) : (
                'พบชื่อนี้ในห้องเรียนนี้มากกว่าหนึ่งคน เลือกว่าคนไหนคือคุณ (หรือเริ่มใหม่ถ้าไม่ใช่ทั้งคู่):'
              )}
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {recoveryMatches.map((m) => (
                <button
                  key={m.studentId}
                  onClick={() => handleAdoptMatch(m)}
                  className="w-full text-left p-3 bg-indigo-50 border border-indigo-100 rounded-xl hover:border-indigo-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" /> ใช่ นี่คือฉัน
                    </span>
                    <span className="text-[11px] font-bold text-indigo-600">{m.progress.xp} XP</span>
                  </div>
                  <p className="text-[10px] text-indigo-500 mt-1">
                    เข้าร่วมล่าสุด {new Date(m.lastSyncedAt).toLocaleString('th-TH')} · เรียนจบ{' '}
                    {m.progress.completedLessons.length} บทเรียน · {m.progress.earnedBadges.length} Badges
                  </p>
                </button>
              ))}
            </div>

            <button
              onClick={handleStartFresh}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 border border-slate-200"
            >
              {recoveryMatches.length > 1 ? 'ไม่ใช่ฉันทั้งคู่ เริ่มใหม่' : 'ไม่ใช่ เริ่มใหม่'}
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500 leading-relaxed">
              {canDismiss
                ? 'แก้ไขชื่อที่แสดงให้ครูเห็น หรือดูรหัสห้องเรียนปัจจุบันของคุณได้ที่นี่'
                : 'ใส่ชื่อและรหัสห้องเรียนที่ครูให้เพื่อเริ่มเรียน — ไม่มีรหัสผ่าน ไม่มีบัญชีผู้ใช้ ครูจะเห็นความก้าวหน้าของคุณผ่านรหัสห้องนี้เท่านั้น'}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  ชื่อที่แสดงให้ครูเห็น
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น สมชาย ใจดี"
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  รหัสห้องเรียน (จากครู)
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="เช่น A7K3M9"
                  maxLength={8}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm tracking-widest font-bold focus:outline-none focus:border-indigo-400"
                />
              </div>
              {status === 'error' && <p className="text-xs font-bold text-rose-600">{errorMessage}</p>}
              {status === 'joined' && (
                <p className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> เข้าร่วมห้องเรียนสำเร็จ!
                </p>
              )}
              {existingLink && status === 'idle' && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
                  <span>
                    ตอนนี้เชื่อมกับห้อง <strong className="text-slate-700">{existingLink.classCode}</strong> อยู่
                  </span>
                  <button onClick={handleLeaveClass} className="text-rose-500 font-bold hover:underline">
                    ยกเลิก
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              {canDismiss && (
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 border border-slate-200"
                >
                  ปิด
                </button>
              )}
              <button
                onClick={handleJoin}
                disabled={status === 'joining' || status === 'checking'}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {(status === 'joining' || status === 'checking') && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {!canDismiss || code.trim() ? 'เข้าร่วมห้องเรียน' : 'บันทึกชื่อ'}
              </button>
            </div>
          </>
        )}

        {!canDismiss && onOpenTeacherLogin && (
          <button
            onClick={onOpenTeacherLogin}
            className="w-full text-center text-[11px] text-slate-400 hover:text-slate-600 font-bold flex items-center justify-center gap-1.5 pt-1"
          >
            <GraduationCap className="w-3.5 h-3.5" /> ครูผู้สอน? เข้าสู่ระบบที่นี่
          </button>
        )}
      </div>
    </div>
  );
}
