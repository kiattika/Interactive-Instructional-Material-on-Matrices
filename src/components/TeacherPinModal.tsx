import { useState, FormEvent } from 'react';
import { Lock, Loader2, ArrowLeft } from 'lucide-react';
import { verifyTeacherPin } from '../lib/teacherAuth';

interface TeacherPinModalProps {
  onSuccess: () => void;
  onCancel: () => void;
  cancelLabel?: string;
}

export function TeacherPinModal({ onSuccess, onCancel, cancelLabel = 'กลับไปหน้านักเรียน' }: TeacherPinModalProps) {
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await verifyTeacherPin(pin.trim());
    setSubmitting(false);
    // NOTE: this project's tsconfig has no strictNullChecks, under which TypeScript fails to
    // narrow the "false" side of a boolean-discriminated union (if/else AND ternary both) —
    // an explicit cast is the reliable workaround regardless of which control-flow form is used.
    if (result.ok) {
      onSuccess();
    } else {
      const failure = result as { ok: false; error: string };
      setError(failure.error);
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 p-6 space-y-5">
        <div className="flex items-center gap-2 text-slate-800 font-black text-sm">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          เข้าสู่โหมดครูผู้สอน
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          กรุณาใส่ PIN ของครูผู้สอนเพื่อเข้าใช้งาน Presentation, วิเคราะห์ผลการเรียน และตั้งค่าชั้นเรียน
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN ครูผู้สอน"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm tracking-widest font-bold text-center focus:outline-none focus:border-indigo-400"
          />
          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 border border-slate-200 flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> {cancelLabel}
            </button>
            <button
              type="submit"
              disabled={submitting || !pin.trim()}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              เข้าสู่ระบบ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
