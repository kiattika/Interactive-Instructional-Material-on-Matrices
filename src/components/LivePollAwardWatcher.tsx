import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { loadStudentProgress, saveStudentProgress } from '../lib/learningStore';
import { getStudentId } from '../lib/classroomSync';
import { checkPendingAwards, acknowledgeAward } from '../lib/livePollClient';

interface LivePollAwardWatcherProps {
  classCode: string;
}

// Awards aren't time-sensitive (the student already knows they answered a poll) — a low-
// frequency background check is enough, and keeps this from ever feeling like it's hammering
// the server. See livePollStore.ts's getPendingAwardsForStudent doc comment for the design
// rationale (pull-and-acknowledge instead of the server pushing XP into anything directly).
const CHECK_INTERVAL_MS = 20000;

// Rendered only from AppLayout.tsx's normal (post-gate) layout for a joined student — silently
// polls for closed live-poll questions they answered correctly, applies the XP locally, and
// shows a brief celebratory toast. Best-effort throughout: a missed check or a failed
// acknowledgement must never break anything else in the app.
export const LivePollAwardWatcher: React.FC<LivePollAwardWatcherProps> = ({ classCode }) => {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let toastTimeout: ReturnType<typeof setTimeout> | undefined;

    async function checkOnce() {
      const studentId = getStudentId();
      const awards = await checkPendingAwards(classCode, studentId);
      if (cancelled || awards.length === 0) return;

      let totalXp = 0;
      for (const award of awards) {
        const progress = loadStudentProgress();
        saveStudentProgress({ ...progress, xp: progress.xp + award.xp });
        totalXp += award.xp;
        await acknowledgeAward(award.pollId, studentId);
      }

      if (!cancelled && totalXp > 0) {
        setToast(`+${totalXp} XP! ตอบถูกในคำถามสดของครู 🎉`);
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => setToast(null), 5000);
      }
    }

    checkOnce();
    const interval = setInterval(checkOnce, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(toastTimeout);
    };
  }, [classCode]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-sm font-bold animate-fade-in">
      <Sparkles className="w-4 h-4 text-amber-300" /> {toast}
    </div>
  );
};
