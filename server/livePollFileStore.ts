// Persistence for the live-poll feature — wraps the pure logic in src/lib/livePollStore.ts.
// Originally a JSON file on local disk (hence the filename); migrated to Firestore for the same
// reason as classroomFileStore.ts — see FIRESTORE_MIGRATION_NOTES.md. The filename is kept
// as-is so server.ts's import path doesn't need to change.
//
// Schema:
//   livePolls/{pollId}                          — poll-level fields (classCode, question,
//                                                  options, correctAnswer, status, timestamps)
//   livePolls/{pollId}/answers/{studentId}       — one doc per student answer
//   livePolls/{pollId}/acknowledgedAwards/{studentId} — marker doc once a student has pulled
//                                                  and applied their XP award for this poll
//
// Firestore transactions replace the old file-lock queue exactly where the pure logic depends
// on read-then-write consistency: submitAnswer must not succeed against a poll that closePoll
// is concurrently closing, and closePoll's correctness tally must see a stable snapshot of
// answers at the moment it flips the poll to closed.
import { getFirestore } from './firestoreClient';

// getFirestore() is called lazily inside each function below (never at module top level) — see
// classroomFileStore.ts's identical comment for why: a module-level `const db = getFirestore()`
// would construct the Firestore client before server.ts's own top-level `dotenv.config()` call
// ever runs, since ES module imports are evaluated before the importing module's own code.
const pollsCollection = () => getFirestore().collection('livePolls');

interface PollDoc {
  pollId: string;
  classCode: string;
  question: string;
  options: string[];
  correctAnswer: string;
  status: 'open' | 'closed';
  createdAt: string;
  closedAt?: string;
}

interface AnswerDoc {
  displayName: string;
  selectedOption: string;
  answeredAt: string;
}

const FIRESTORE_ALREADY_EXISTS = 6; // google.rpc.Code.ALREADY_EXISTS

function generatePollId(): string {
  return `poll_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function createPoll(
  classCode: string,
  question: string,
  options: string[],
  correctAnswer: string
): Promise<{ pollId: string }> {
  // Same create()-and-retry-on-collision pattern as classroomFileStore.ts's createClass —
  // the timestamp+random id composition makes a collision effectively impossible, but this
  // avoids ever assuming that rather than reading every existing poll id up front.
  for (let attempt = 0; attempt < 5; attempt++) {
    const pollId = generatePollId();
    const doc: PollDoc = {
      pollId,
      classCode,
      question,
      options,
      correctAnswer,
      status: 'open',
      createdAt: new Date().toISOString()
    };
    try {
      await pollsCollection().doc(pollId).create(doc);
      return { pollId };
    } catch (err: any) {
      if (err?.code === FIRESTORE_ALREADY_EXISTS) continue;
      throw err;
    }
  }
  throw new Error('ไม่สามารถสร้างคำถามสดที่ไม่ซ้ำได้ โปรดลองใหม่อีกครั้ง');
}

// Overwriting an existing answer from the same studentId is intentional — a student can change
// their mind and re-tap a different option right up until the teacher closes the poll. The
// transaction is what makes "reject if closed" race-safe against a concurrent closePoll: both
// this and closePoll touch the same poll document, so Firestore serializes them.
export async function submitAnswer(
  pollId: string,
  studentId: string,
  displayName: string,
  selectedOption: string
): Promise<{ ok: true } | { ok: false; error: 'poll_not_found' | 'poll_closed' }> {
  const pollRef = pollsCollection().doc(pollId);
  return getFirestore().runTransaction(async (tx) => {
    const pollSnap = await tx.get(pollRef);
    if (!pollSnap.exists) return { ok: false, error: 'poll_not_found' } as const;
    if ((pollSnap.data() as PollDoc).status === 'closed') {
      return { ok: false, error: 'poll_closed' } as const;
    }
    const answer: AnswerDoc = {
      displayName: displayName.trim() || 'นักเรียนใหม่',
      selectedOption,
      answeredAt: new Date().toISOString()
    };
    tx.set(pollRef.collection('answers').doc(studentId), answer);
    return { ok: true } as const;
  });
}

function tallyVotes(options: string[], answers: AnswerDoc[]): Record<string, number> {
  const voteCounts: Record<string, number> = {};
  for (const opt of options) voteCounts[opt] = 0;
  for (const answer of answers) {
    voteCounts[answer.selectedOption] = (voteCounts[answer.selectedOption] ?? 0) + 1;
  }
  return voteCounts;
}

export interface FetchedPollResults {
  pollId: string;
  question: string;
  options: string[];
  status: 'open' | 'closed';
  totalAnswers: number;
  voteCounts: Record<string, number>;
}

// Polled every 1-2 seconds by both the teacher's live view AND the student's own poll page —
// deliberately never includes correctAnswer (see livePollStore.ts's getResults doc comment).
export async function fetchResults(pollId: string): Promise<FetchedPollResults | null> {
  const pollRef = pollsCollection().doc(pollId);
  const pollSnap = await pollRef.get();
  if (!pollSnap.exists) return null;
  const poll = pollSnap.data() as PollDoc;
  const answersSnap = await pollRef.collection('answers').get();
  const answers = answersSnap.docs.map((d) => d.data() as AnswerDoc);
  return {
    pollId: poll.pollId,
    question: poll.question,
    options: poll.options,
    status: poll.status,
    totalAnswers: answers.length,
    voteCounts: tallyVotes(poll.options, answers)
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

export async function closePoll(
  pollId: string
): Promise<{ ok: true; summary: PollCloseSummary } | { ok: false; error: 'poll_not_found' }> {
  const pollRef = pollsCollection().doc(pollId);
  return getFirestore().runTransaction(async (tx) => {
    const pollSnap = await tx.get(pollRef);
    if (!pollSnap.exists) return { ok: false, error: 'poll_not_found' } as const;
    const poll = pollSnap.data() as PollDoc;

    const answersSnap = await tx.get(pollRef.collection('answers'));
    const correctStudentIds: string[] = [];
    const correctDisplayNames: string[] = [];
    const answers: AnswerDoc[] = [];
    for (const doc of answersSnap.docs) {
      const answer = doc.data() as AnswerDoc;
      answers.push(answer);
      if (answer.selectedOption === poll.correctAnswer) {
        correctStudentIds.push(doc.id);
        correctDisplayNames.push(answer.displayName);
      }
    }

    const closedAt = new Date().toISOString();
    tx.update(pollRef, { status: 'closed', closedAt });

    return {
      ok: true,
      summary: {
        pollId: poll.pollId,
        question: poll.question,
        correctAnswer: poll.correctAnswer,
        voteCounts: tallyVotes(poll.options, answers),
        correctStudentIds,
        correctDisplayNames,
        totalAnswers: answers.length
      }
    } as const;
  });
}

export interface PendingAward {
  pollId: string;
  question: string;
}

// Pull side of the award handshake — see livePollStore.ts's getPendingAwardsForStudent doc
// comment for why the server never mutates a student's XP directly. Scoped to this classCode's
// polls (a single-field equality filter, always covered by Firestore's automatic indexing, no
// composite index to manage) rather than every poll in existence, then checked per-poll against
// this one student's answer + acknowledgedAwards docs — matches "classroom sizes here are a
// handful of students" from the original file-store comment: a handful of polls per class, not
// a scale where this fans out expensively.
export async function fetchPendingAwards(classCode: string, studentId: string): Promise<PendingAward[]> {
  const closedPollsSnap = await pollsCollection()
    .where('classCode', '==', classCode)
    .where('status', '==', 'closed')
    .get();

  const pending: PendingAward[] = [];
  await Promise.all(
    closedPollsSnap.docs.map(async (pollDoc) => {
      const poll = pollDoc.data() as PollDoc;
      const [answerSnap, ackSnap] = await Promise.all([
        pollDoc.ref.collection('answers').doc(studentId).get(),
        pollDoc.ref.collection('acknowledgedAwards').doc(studentId).get()
      ]);
      if (!answerSnap.exists || ackSnap.exists) return;
      if ((answerSnap.data() as AnswerDoc).selectedOption !== poll.correctAnswer) return;
      pending.push({ pollId: poll.pollId, question: poll.question });
    })
  );
  return pending;
}

export async function acknowledgePoll(
  pollId: string,
  studentId: string
): Promise<{ ok: true } | { ok: false; error: 'poll_not_found' }> {
  const pollRef = pollsCollection().doc(pollId);
  const pollSnap = await pollRef.get();
  if (!pollSnap.exists) return { ok: false, error: 'poll_not_found' };
  // set() (not create()) so re-acknowledging an already-acknowledged poll stays the idempotent
  // no-op success the pure acknowledgePoll documents, rather than an ALREADY_EXISTS error.
  await pollRef.collection('acknowledgedAwards').doc(studentId).set({ acknowledgedAt: new Date().toISOString() });
  return { ok: true };
}
