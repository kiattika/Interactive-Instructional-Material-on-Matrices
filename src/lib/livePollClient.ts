// Client-side glue for the live classroom-poll feature. Mirrors classroomSync.ts's style:
// thin fetch wrappers, best-effort where appropriate, no UI concerns.
import type { PollResults, PollCloseSummary } from './livePollStore';

export type LivePollPublicView = PollResults;
export type PollCloseSummaryClient = PollCloseSummary;

export async function createLivePoll(
  classCode: string,
  question: string,
  options: string[],
  correctAnswer: string
): Promise<{ pollId: string } | null> {
  try {
    const res = await fetch('/api/live-poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classCode, question, options, correctAnswer })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchPollResults(pollId: string): Promise<LivePollPublicView | null> {
  try {
    const res = await fetch(`/api/live-poll/${encodeURIComponent(pollId)}/results`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function submitPollAnswer(
  pollId: string,
  studentId: string,
  displayName: string,
  selectedOption: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/live-poll/${encodeURIComponent(pollId)}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, displayName, selectedOption })
    });
    const data = await res.json();
    return { ok: res.ok, error: data?.error };
  } catch {
    return { ok: false, error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ลองใหม่อีกครั้ง' };
  }
}

export async function closeLivePoll(pollId: string): Promise<PollCloseSummaryClient | null> {
  try {
    const res = await fetch(`/api/live-poll/${encodeURIComponent(pollId)}/close`, { method: 'POST' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface PendingAward {
  pollId: string;
  question: string;
  xp: number;
}

/** Best-effort — never throws. A missed award check must not break anything else in the app. */
export async function checkPendingAwards(classCode: string, studentId: string): Promise<PendingAward[]> {
  try {
    const res = await fetch(
      `/api/live-poll/pending-awards?classCode=${encodeURIComponent(classCode)}&studentId=${encodeURIComponent(studentId)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.awards as PendingAward[]) || [];
  } catch {
    return [];
  }
}

/** Best-effort — a failed ack just means the award is offered again next check, which is safe
 * (applying it is idempotent from the caller's side as long as it only runs once per success). */
export async function acknowledgeAward(pollId: string, studentId: string): Promise<void> {
  try {
    await fetch(`/api/live-poll/${encodeURIComponent(pollId)}/ack?studentId=${encodeURIComponent(studentId)}`, {
      method: 'POST'
    });
  } catch {
    // ignore
  }
}
