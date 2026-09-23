import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, HelpCircle } from 'lucide-react';
import { loadStudentProgress, saveStudentProgress } from '../lib/learningStore';
import { withActivity } from '../lib/motivation';
import { getStudentId } from '../lib/classroomSync';
import { fetchPollResults, submitPollAnswer, LivePollPublicView } from '../lib/livePollClient';

// Refetched often enough that "closed" and vote-count changes feel live, without hammering the
// server — matches the cadence TeacherPresentation.tsx's own live view polls at.
const POLL_REFRESH_MS = 1500;

// Reached by scanning the teacher's QR code (see TeacherPresentation.tsx / QRCodeModal-style
// generation there) or tapping the poll link directly. Joining a classroom is mandatory
// app-wide (see AppLayout.tsx's gates), so by the time a student can reach this route,
// getStudentId() and their display name are already available — this page never asks them to
// type anything to identify themselves, only to pick an answer.
const LivePollPage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const [poll, setPoll] = useState<LivePollPublicView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!pollId) return;
    let cancelled = false;

    async function refresh() {
      const results = await fetchPollResults(pollId!);
      if (cancelled) return;
      if (!results) {
        setNotFound(true);
        return;
      }
      setPoll(results);
    }

    refresh();
    const interval = setInterval(refresh, POLL_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollId]);

  async function handleSelect(option: string) {
    if (!pollId || !poll || poll.status === 'closed' || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const progress = loadStudentProgress();
    const result = await submitPollAnswer(pollId, getStudentId(), progress.studentName, option);
    setSubmitting(false);
    if (result.ok) {
      setSelected(option);
      // Answering a live class question counts toward the daily learning streak.
      const withToday = withActivity(progress);
      if (withToday !== progress) saveStudentProgress(withToday);
    } else {
      setSubmitError(result.error || 'ไม่สามารถส่งคำตอบได้ ลองใหม่อีกครั้ง');
    }
  }

  if (notFound) {
    return (
      <div className="max-w-md mx-auto text-center space-y-3 py-16">
        <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
        <p className="text-base sm:text-sm font-bold text-slate-600">ไม่พบคำถามนี้ หรือคำถามถูกลบไปแล้ว</p>
        <p className="text-sm sm:text-xs text-slate-400">ลองขอ QR หรือลิงก์ใหม่จากครูอีกครั้ง</p>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="max-w-md mx-auto flex justify-center py-16">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4 py-2 sm:py-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">ถามชั้นเรียน (Live)</p>
        <p className="text-lg sm:text-base font-bold text-slate-800 leading-relaxed break-words">{poll.question}</p>

        {poll.status === 'closed' ? (
          <p className="text-base sm:text-sm font-bold text-slate-500 bg-slate-50 rounded-xl p-4 text-center">
            ปิดรับคำตอบแล้ว — รอครูเฉลยหน้าจอครับ
          </p>
        ) : (
          <div className="space-y-3 sm:space-y-2">
            {poll.options.map((opt) => (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                disabled={submitting}
                className={`w-full min-h-14 sm:min-h-0 text-left px-4 py-3.5 sm:py-3 rounded-xl border-2 sm:border text-base sm:text-sm font-bold leading-snug break-words transition-colors active:bg-indigo-50 disabled:opacity-60 ${
                  selected === opt
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {submitError && <p className="text-sm sm:text-xs font-bold text-rose-600">{submitError}</p>}

        {selected && poll.status === 'open' && (
          <p className="text-sm sm:text-xs font-bold text-emerald-600 flex items-start gap-1.5">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0" /> ส่งคำตอบแล้ว รอครูเฉลย (แตะข้อใหม่เพื่อเปลี่ยนคำตอบได้)
          </p>
        )}
      </div>
    </div>
  );
};

export default LivePollPage;
