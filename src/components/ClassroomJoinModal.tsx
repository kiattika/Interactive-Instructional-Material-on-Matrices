import { useState } from 'react';
import { X, Users, Loader2, CheckCircle2 } from 'lucide-react';
import { StudentProgress, saveStudentProgress } from '../lib/learningStore';
import { getClassroomLink, joinClassroom, clearClassroomLink, markOnboardingSeen } from '../lib/classroomSync';

interface ClassroomJoinModalProps {
  progress: StudentProgress;
  onClose: () => void;
}

export function ClassroomJoinModal({ progress, onClose }: ClassroomJoinModalProps) {
  const existingLink = getClassroomLink();
  const [name, setName] = useState(progress.studentName === 'นักเรียนใหม่' ? '' : progress.studentName);
  const [code, setCode] = useState(existingLink?.classCode || '');
  const [status, setStatus] = useState<'idle' | 'joining' | 'error' | 'joined'>('idle');

  const handleSkip = () => {
    markOnboardingSeen();
    onClose();
  };

  const handleSaveNameOnly = () => {
    if (name.trim() && name.trim() !== progress.studentName) {
      saveStudentProgress({ ...progress, studentName: name.trim() });
    }
    markOnboardingSeen();
    onClose();
  };

  const handleJoin = async () => {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      handleSaveNameOnly();
      return;
    }
    setStatus('joining');
    const finalName = name.trim() || progress.studentName;
    const updated = { ...progress, studentName: finalName };
    saveStudentProgress(updated); // local save always succeeds regardless of network
    const ok = await joinClassroom(trimmedCode, updated);
    if (ok) {
      setStatus('joined');
      markOnboardingSeen();
      setTimeout(onClose, 900);
    } else {
      setStatus('error');
    }
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
            <Users className="w-5 h-5" /> เข้าร่วมห้องเรียน (ไม่บังคับ)
          </div>
          <button onClick={handleSkip} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          ใส่ชื่อและรหัสห้องเรียนที่ครูให้ เพื่อให้ครูเห็นความก้าวหน้าของคุณ — ไม่มีรหัสผ่าน ไม่มีบัญชีผู้ใช้
          และไม่บังคับ หากข้ามขั้นตอนนี้ ยังใช้งานทุกฟีเจอร์ได้ตามปกติ
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
          {status === 'error' && (
            <p className="text-xs font-bold text-rose-600">
              ไม่พบรหัสห้องนี้ ตรวจสอบกับครูอีกครั้ง หรือข้ามขั้นตอนนี้ไปก่อนได้
            </p>
          )}
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
          <button
            onClick={handleSkip}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 border border-slate-200"
          >
            ข้ามตอนนี้
          </button>
          <button
            onClick={handleJoin}
            disabled={status === 'joining'}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {status === 'joining' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {code.trim() ? 'เข้าร่วมห้องเรียน' : 'บันทึกชื่อ'}
          </button>
        </div>
      </div>
    </div>
  );
}
