import {
  createEmptyDB,
  createPoll,
  submitAnswer,
  getResults,
  closePoll,
  getPoll,
  getPendingAwardsForStudent,
  acknowledgePoll,
  LIVE_POLL_CORRECT_XP
} from '../lib/livePollStore';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

console.log('='.repeat(50));
console.log('  QA: LIVE CLASSROOM POLLS (ASK THE CLASS)');
console.log('='.repeat(50));

const QUESTION = 'det(A) ของเมทริกซ์นี้เท่ากับเท่าใด?';
const OPTIONS = ['A. -3', 'B. 3', 'C. 0', 'D. 1'];
const CORRECT = 'A. -3';

// 1. createPoll produces a fresh id, defaults to open, and never mutates the input DB
let db = createEmptyDB();
const { db: dbAfterCreate, pollId } = createPoll(db, 'ABC123', QUESTION, OPTIONS, CORRECT);
assert(Object.keys(db.polls).length === 0, 'createPoll must not mutate the original DB (immutability)');
const created = getPoll(dbAfterCreate, pollId);
assert(created !== null && created.status === 'open', 'a freshly created poll must be open');
assert(created !== null && created.classCode === 'ABC123', 'poll must remember which class it belongs to');
db = dbAfterCreate;

// 2. submitAnswer records an answer and getResults tallies it correctly, without leaking
// the correct answer (results are polled by students too — see getResults's doc comment)
const answer1 = submitAnswer(db, pollId, 'student-1', 'Somchai', 'A. -3');
assert(answer1.ok === true, 'submitting an answer to an open poll must succeed');
db = answer1.ok ? answer1.db : db;

const resultsAfterOne = getResults(db, pollId);
assert(resultsAfterOne !== null, 'getResults must find an existing poll');
assert(resultsAfterOne!.totalAnswers === 1, 'getResults must count exactly one answer so far');
assert(resultsAfterOne!.voteCounts['A. -3'] === 1, 'the vote must be tallied under the chosen option');
assert(
  !('correctAnswer' in resultsAfterOne!),
  'getResults must never include the correct answer — it is polled by students too'
);

// 3. A student can change their answer while the poll is still open — overwrite, not duplicate
const answer1Changed = submitAnswer(db, pollId, 'student-1', 'Somchai', 'B. 3');
assert(answer1Changed.ok === true, 'changing an answer before close must succeed');
db = answer1Changed.ok ? answer1Changed.db : db;
const resultsAfterChange = getResults(db, pollId);
assert(resultsAfterChange!.totalAnswers === 1, 'changing an answer must not create a second entry');
assert(resultsAfterChange!.voteCounts['A. -3'] === 0, 'the old vote must be removed when changed');
assert(resultsAfterChange!.voteCounts['B. 3'] === 1, 'the new vote must be tallied instead');

// Revert student-1 back to the correct answer for the closing tests below
const answer1Reverted = submitAnswer(db, pollId, 'student-1', 'Somchai', CORRECT);
db = answer1Reverted.ok ? answer1Reverted.db : db;

const answer2 = submitAnswer(db, pollId, 'student-2', 'Kanya', 'C. 0');
db = answer2.ok ? answer2.db : db;

// 4. submitAnswer against an unknown poll fails cleanly
const unknownPollAnswer = submitAnswer(db, 'nope', 'student-3', 'Malee', CORRECT);
assert(unknownPollAnswer.ok === false, 'submitting to a non-existent poll must fail');

// 5. closePoll flips status, computes vote breakdown and correct-answer credit, and rejects
// any further answers as poll_closed
const closeResult = closePoll(db, pollId);
assert(closeResult.ok === true, 'closing an existing poll must succeed');
db = closeResult.ok ? closeResult.db : db;
const summary = closeResult.ok ? closeResult.summary : null;
assert(summary !== null, 'closePoll must return a summary');
assert(summary!.totalAnswers === 2, 'close summary must count every answer received');
assert(
  summary!.correctStudentIds.length === 1 && summary!.correctStudentIds[0] === 'student-1',
  'close summary must correctly identify which studentIds answered correctly'
);
assert(
  summary!.correctDisplayNames[0] === 'Somchai',
  'close summary must carry the display name alongside the studentId'
);
assert(summary!.voteCounts['C. 0'] === 1, 'close summary vote counts must match submitted answers');

const closedPoll = getPoll(db, pollId);
assert(closedPoll !== null && closedPoll.status === 'closed', 'the poll record itself must now be closed');

const answerAfterClose = submitAnswer(db, pollId, 'student-3', 'Malee', CORRECT);
assert(answerAfterClose.ok === false, 'submitting an answer after close must fail');
const closedFailureReason = answerAfterClose.ok
  ? null
  : (answerAfterClose as { ok: false; error: 'poll_not_found' | 'poll_closed' }).error;
assert(closedFailureReason === 'poll_closed', 'the failure reason for a closed poll must be poll_closed, not poll_not_found');

// 6. closePoll against an unknown poll fails cleanly
const closeUnknown = closePoll(db, 'nope');
assert(closeUnknown.ok === false, 'closing a non-existent poll must fail');

// 7. Pending-awards / acknowledge handshake: only the correct, closed, not-yet-acknowledged
// answer for the RIGHT classCode shows up, and acknowledging removes it from future checks
const pendingForStudent1 = getPendingAwardsForStudent(db, 'ABC123', 'student-1');
assert(pendingForStudent1.length === 1 && pendingForStudent1[0].pollId === pollId, 'student-1 (correct) must have one pending award');

const pendingForStudent2 = getPendingAwardsForStudent(db, 'ABC123', 'student-2');
assert(pendingForStudent2.length === 0, 'student-2 (incorrect) must have no pending award');

const pendingWrongClass = getPendingAwardsForStudent(db, 'ZZZZZZ', 'student-1');
assert(pendingWrongClass.length === 0, 'a pending-award check under the wrong classCode must find nothing');

const ackResult = acknowledgePoll(db, pollId, 'student-1');
assert(ackResult.ok === true, 'acknowledging a real poll must succeed');
db = ackResult.ok ? ackResult.db : db;

const pendingAfterAck = getPendingAwardsForStudent(db, 'ABC123', 'student-1');
assert(pendingAfterAck.length === 0, 'after acknowledging, the same poll must not be offered again');

const ackAgain = acknowledgePoll(db, pollId, 'student-1');
assert(ackAgain.ok === true, 're-acknowledging an already-acknowledged poll must be an idempotent success');

const ackUnknownPoll = acknowledgePoll(db, 'nope', 'student-1');
assert(ackUnknownPoll.ok === false, 'acknowledging a non-existent poll must fail');

// 8. An open poll (not yet closed) never appears as a pending award, even for a correct answer
const { db: dbWithOpenPoll, pollId: openPollId } = createPoll(db, 'ABC123', QUESTION, OPTIONS, CORRECT);
const openAnswer = submitAnswer(dbWithOpenPoll, openPollId, 'student-1', 'Somchai', CORRECT);
const dbWithOpenAnswer = openAnswer.ok ? openAnswer.db : dbWithOpenPoll;
const pendingWhileOpen = getPendingAwardsForStudent(dbWithOpenAnswer, 'ABC123', 'student-1');
assert(pendingWhileOpen.length === 0, 'an open poll must never be offered as a pending award, even if answered correctly');

// 9. LIVE_POLL_CORRECT_XP stays a small, sane fraction of a full lesson's +50 XP (LessonView.tsx)
assert(
  LIVE_POLL_CORRECT_XP > 0 && LIVE_POLL_CORRECT_XP < 50,
  'a single live-poll question must be worth noticeably less than a full lesson (+50 XP)'
);

console.log('='.repeat(50));
console.log('  ALL LIVE POLL TESTS PASSED!');
console.log('='.repeat(50));
