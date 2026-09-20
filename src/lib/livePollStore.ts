// Pure, platform-agnostic logic for the live classroom-poll feature ("ถามชั้นเรียน" quizzes in
// TeacherPresentation.tsx). Mirrors classroomStore.ts's structure and conventions on purpose:
// no filesystem or network access here — that lives in server/livePollFileStore.ts — so this
// module is unit-tested directly (see src/tests/livePollStore.test.ts) and reused unchanged on
// both the client (type-checking payloads) and the server (persistence).

// LessonView.tsx awards +50 XP for completing an entire lesson. A single live-poll question is
// a much smaller unit of effort — this is 1/5 of that, enough to feel rewarding without making
// a quick in-class quiz worth as much as real study.
export const LIVE_POLL_CORRECT_XP = 10;

export interface PollAnswer {
  displayName: string;
  selectedOption: string;
  answeredAt: string; // ISO timestamp
}

export interface LivePoll {
  pollId: string;
  classCode: string;
  question: string;
  options: string[];
  correctAnswer: string;
  status: 'open' | 'closed';
  answers: Record<string, PollAnswer>; // keyed by studentId
  createdAt: string;
  closedAt?: string;
  // studentIds that already pulled and applied their XP award for this poll — prevents a
  // student's device from ever being credited twice for the same correct answer.
  acknowledgedBy: string[];
}

export interface LivePollDB {
  polls: Record<string, LivePoll>;
}

export function createEmptyDB(): LivePollDB {
  return { polls: {} };
}

function generatePollId(existingIds: Iterable<string> = []): string {
  const taken = existingIds instanceof Set ? existingIds : new Set(existingIds);
  let id = '';
  do {
    id = `poll_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  } while (taken.has(id));
  return id;
}

export function createPoll(
  db: LivePollDB,
  classCode: string,
  question: string,
  options: string[],
  correctAnswer: string
): { db: LivePollDB; pollId: string } {
  const pollId = generatePollId(Object.keys(db.polls));
  const poll: LivePoll = {
    pollId,
    classCode,
    question,
    options,
    correctAnswer,
    status: 'open',
    answers: {},
    createdAt: new Date().toISOString(),
    acknowledgedBy: []
  };
  return { db: { polls: { ...db.polls, [pollId]: poll } }, pollId };
}

export function getPoll(db: LivePollDB, pollId: string): LivePoll | null {
  return db.polls[pollId] || null;
}

export type SubmitAnswerResult =
  | { ok: true; db: LivePollDB }
  | { ok: false; error: 'poll_not_found' | 'poll_closed' };

// Overwriting an existing answer from the same studentId is intentional — a student can change
// their mind and re-tap a different option right up until the teacher closes the poll.
export function submitAnswer(
  db: LivePollDB,
  pollId: string,
  studentId: string,
  displayName: string,
  selectedOption: string
): SubmitAnswerResult {
  const poll = db.polls[pollId];
  if (!poll) return { ok: false, error: 'poll_not_found' };
  if (poll.status === 'closed') return { ok: false, error: 'poll_closed' };

  const updatedPoll: LivePoll = {
    ...poll,
    answers: {
      ...poll.answers,
      [studentId]: {
        displayName: displayName.trim() || 'นักเรียนใหม่',
        selectedOption,
        answeredAt: new Date().toISOString()
      }
    }
  };
  return { ok: true, db: { polls: { ...db.polls, [pollId]: updatedPoll } } };
}

export interface PollResults {
  pollId: string;
  question: string;
  options: string[];
  status: 'open' | 'closed';
  totalAnswers: number;
  voteCounts: Record<string, number>;
}

function tallyVotes(poll: LivePoll): Record<string, number> {
  const voteCounts: Record<string, number> = {};
  for (const opt of poll.options) voteCounts[opt] = 0;
  for (const answer of Object.values(poll.answers)) {
    voteCounts[answer.selectedOption] = (voteCounts[answer.selectedOption] ?? 0) + 1;
  }
  return voteCounts;
}

// Deliberately omits `correctAnswer` — this is polled by both the teacher's live view AND the
// student's own poll page (see LivePollPage.tsx), so it must never leak the answer key before
// the teacher closes the poll.
export function getResults(db: LivePollDB, pollId: string): PollResults | null {
  const poll = db.polls[pollId];
  if (!poll) return null;
  return {
    pollId: poll.pollId,
    question: poll.question,
    options: poll.options,
    status: poll.status,
    totalAnswers: Object.keys(poll.answers).length,
    voteCounts: tallyVotes(poll)
  };
}

export interface PollCloseSummary {
  pollId: string;
  question: string;
  correctAnswer: string;
  voteCounts: Record<string, number>;
  correctStudentIds: string[];
  correctDisplayNames: string[];
  totalAnswers: number;
}

export type ClosePollResult =
  | { ok: true; db: LivePollDB; summary: PollCloseSummary }
  | { ok: false; error: 'poll_not_found' };

export function closePoll(db: LivePollDB, pollId: string): ClosePollResult {
  const poll = db.polls[pollId];
  if (!poll) return { ok: false, error: 'poll_not_found' };

  const updatedPoll: LivePoll = { ...poll, status: 'closed', closedAt: new Date().toISOString() };

  const correctStudentIds: string[] = [];
  const correctDisplayNames: string[] = [];
  for (const [studentId, answer] of Object.entries(poll.answers)) {
    if (answer.selectedOption === poll.correctAnswer) {
      correctStudentIds.push(studentId);
      correctDisplayNames.push(answer.displayName);
    }
  }

  return {
    ok: true,
    db: { polls: { ...db.polls, [pollId]: updatedPoll } },
    summary: {
      pollId: poll.pollId,
      question: poll.question,
      correctAnswer: poll.correctAnswer,
      voteCounts: tallyVotes(poll),
      correctStudentIds,
      correctDisplayNames,
      totalAnswers: Object.keys(poll.answers).length
    }
  };
}

// A student's own device is the source of truth for their StudentProgress.xp (localStorage) —
// the server never mutates a classroom roster's xp directly (that value would just be
// overwritten by the student's next real sync anyway). Instead this list is the pull side of a
// pull-and-acknowledge handshake: the student's device asks "did I win anything?", applies the
// XP locally, then acknowledges so it's never granted twice — see AppLayout's
// LivePollAwardWatcher and server.ts's /api/live-poll/pending-awards + /ack routes.
export function getPendingAwardsForStudent(db: LivePollDB, classCode: string, studentId: string): LivePoll[] {
  return Object.values(db.polls).filter(
    (poll) =>
      poll.classCode === classCode &&
      poll.status === 'closed' &&
      poll.answers[studentId]?.selectedOption === poll.correctAnswer &&
      !poll.acknowledgedBy.includes(studentId)
  );
}

export type AckResult = { ok: true; db: LivePollDB } | { ok: false; error: 'poll_not_found' };

export function acknowledgePoll(db: LivePollDB, pollId: string, studentId: string): AckResult {
  const poll = db.polls[pollId];
  if (!poll) return { ok: false, error: 'poll_not_found' };
  if (poll.acknowledgedBy.includes(studentId)) return { ok: true, db }; // idempotent no-op

  const updatedPoll: LivePoll = { ...poll, acknowledgedBy: [...poll.acknowledgedBy, studentId] };
  return { ok: true, db: { polls: { ...db.polls, [pollId]: updatedPoll } } };
}
