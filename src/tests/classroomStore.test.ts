import {
  createEmptyDB,
  createClass,
  generateClassCode,
  classExists,
  isClassActive,
  upsertStudentProgress,
  getRoster,
  closeClass,
  reopenClass,
  listClasses,
  setClassNote,
  removeStudent,
  findStudentsByDisplayName,
  SyncedProgress,
  StudentRecord
} from '../lib/classroomStore';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

console.log('='.repeat(50));
console.log('  QA: CLASSROOM SYNC (NO-LOGIN, PHASE 2)');
console.log('='.repeat(50));

const sampleProgress: SyncedProgress = {
  xp: 150,
  completedLessons: [1, 2],
  preTestCompleted: true,
  preTestScore: 40,
  postTestCompleted: false,
  postTestScore: 0,
  topicMastery: {
    matrixNotation: 80,
    determinant: 50,
    inverseMethod: 30,
    cramerRule: 20,
    gaussianElimination: 90,
    solutionTypes: 60
  },
  earnedBadges: ['matrix_explorer']
};

// 1. generateClassCode never collides with the excluded set and has the expected shape
const taken = new Set(['AAAAAA', 'BBBBBB']);
let sawCollision = false;
let sawBadShape = false;
for (let i = 0; i < 500; i++) {
  const code = generateClassCode(taken);
  if (taken.has(code)) sawCollision = true;
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) sawBadShape = true;
}
assert(!sawCollision, 'generated codes must never collide with the excluded set (500 draws)');
assert(!sawBadShape, 'generated codes must always be 6 unambiguous uppercase/digit chars (500 draws)');

// 2. createClass produces a fresh, unique code each time and never mutates the input DB
let db = createEmptyDB();
const { db: dbAfterCreate1, classCode: code1 } = createClass(db);
assert(Object.keys(db.classes).length === 0, 'createClass must not mutate the original DB (immutability)');
assert(classExists(dbAfterCreate1, code1), 'newly created class must exist in the returned DB');

const { db: dbAfterCreate2, classCode: code2 } = createClass(dbAfterCreate1);
assert(code1 !== code2, 'two classes created in sequence must get different codes');
assert(classExists(dbAfterCreate2, code1) && classExists(dbAfterCreate2, code2), 'both classes must coexist');

// 3. upsertStudentProgress fails cleanly against an unknown class code
// (tsconfig here runs without strictNullChecks, which leaves the "ok: false" arm of this
// discriminated union unnarrowed on plain property access — hence the explicit cast below.)
const unknownResult = upsertStudentProgress(dbAfterCreate2, 'NOPE12', 'student-1', 'Somchai', sampleProgress);
assert(unknownResult.ok === false, 'sync against a non-existent class code must fail');
const failureReason = unknownResult.ok
  ? null
  : (unknownResult as { ok: false; error: 'class_not_found' }).error;
assert(failureReason === 'class_not_found', 'failure reason must be class_not_found');

// 4. upsertStudentProgress succeeds against a real class and getRoster reflects it
const joinResult = upsertStudentProgress(dbAfterCreate2, code1, 'student-1', 'Somchai', sampleProgress);
assert(joinResult.ok === true, 'sync against a real class code must succeed');

db = joinResult.ok ? joinResult.db : dbAfterCreate2;
const roster1 = getRoster(db, code1);
assert(roster1 !== null && roster1.length === 1, 'roster must contain exactly the one synced student');
assert(roster1![0].displayName === 'Somchai', 'roster entry must carry the display name sent by the student');
assert(roster1![0].progress.xp === 150, 'roster entry must carry the synced progress fields');

// 5. Re-syncing the same studentId updates in place rather than duplicating
const secondProgress: SyncedProgress = { ...sampleProgress, xp: 300 };
const resync = upsertStudentProgress(db, code1, 'student-1', 'Somchai', secondProgress);
assert(resync.ok === true, 're-syncing an existing student must still succeed');
const rosterAfterResync = getRoster(resync.ok ? resync.db : db, code1);
assert(rosterAfterResync!.length === 1, 're-syncing the same studentId must update in place, not duplicate');
assert(rosterAfterResync![0].progress.xp === 300, 're-synced progress must overwrite the previous snapshot');

// 6. A second student in the same class shows up alongside the first, and the other class stays empty
const withSecondStudent = upsertStudentProgress(
  resync.ok ? resync.db : db,
  code1,
  'student-2',
  'Kanya',
  sampleProgress
);
assert(withSecondStudent.ok === true, 'a second distinct student must be able to join the same class');
const finalRoster = getRoster(withSecondStudent.ok ? withSecondStudent.db : db, code1);
assert(finalRoster!.length === 2, 'roster must now list both students');
const rosterForOtherClass = getRoster(withSecondStudent.ok ? withSecondStudent.db : db, code2);
assert(
  rosterForOtherClass !== null && rosterForOtherClass.length === 0,
  'a class nobody has synced to yet must return an empty roster, not fabricated entries'
);

// 7. getRoster on a class code that was never created returns null (distinct from "empty")
assert(getRoster(db, 'ZZZZZZ') === null, 'an unknown class code must return null, not an empty array');

db = withSecondStudent.ok ? withSecondStudent.db : db;

// 8. New classes are active by default, and classExists/isClassActive agree on a fresh class
assert(classExists(db, code1), 'a freshly created class must exist');
assert(isClassActive(db, code1), 'a freshly created class must be active by default');

// 9. closeClass flips active to false without deleting the class or its roster
const closeResult = closeClass(db, code1);
assert(closeResult.ok === true, 'closing an existing class must succeed');
db = closeResult.ok ? closeResult.db : db;
assert(classExists(db, code1), 'a closed class must still exist (nothing is deleted)');
assert(!isClassActive(db, code1), 'a closed class must report inactive');
assert(getRoster(db, code1)!.length === 2, 'a closed class must keep its existing roster intact');

// 10. upsertStudentProgress against a closed class must behave exactly like class_not_found
const syncAgainstClosed = upsertStudentProgress(db, code1, 'student-3', 'Malee', sampleProgress);
assert(syncAgainstClosed.ok === false, 'syncing progress into a closed class must fail');
const closedFailureReason = syncAgainstClosed.ok
  ? null
  : (syncAgainstClosed as { ok: false; error: 'class_not_found' }).error;
assert(
  closedFailureReason === 'class_not_found',
  'a closed class must report class_not_found, indistinguishable from a non-existent class'
);
assert(
  getRoster(db, code1)!.length === 2,
  'a rejected sync against a closed class must not silently add the student anyway'
);

// 11. reopenClass flips active back to true and syncing works again
const reopenResult = reopenClass(db, code1);
assert(reopenResult.ok === true, 'reopening an existing class must succeed');
db = reopenResult.ok ? reopenResult.db : db;
assert(isClassActive(db, code1), 'a reopened class must report active again');
const syncAfterReopen = upsertStudentProgress(db, code1, 'student-3', 'Malee', sampleProgress);
assert(syncAfterReopen.ok === true, 'syncing progress into a reopened class must succeed again');
db = syncAfterReopen.ok ? syncAfterReopen.db : db;
assert(getRoster(db, code1)!.length === 3, 'the new student must now appear in the reopened class roster');

// 12. closeClass/reopenClass against an unknown class code fail cleanly, same shape as upsert
const closeUnknown = closeClass(db, 'NOPE99');
assert(closeUnknown.ok === false, 'closing a non-existent class must fail');
const reopenUnknown = reopenClass(db, 'NOPE99');
assert(reopenUnknown.ok === false, 'reopening a non-existent class must fail');

// 13. listClasses summarizes every class with the right student counts and active flags
const summaries = listClasses(db);
assert(summaries.length === 2, 'listClasses must list every class in the DB');
const summary1 = summaries.find((s) => s.classCode === code1);
assert(!!summary1 && summary1.active === true, 'reopened class must be listed as active');
assert(!!summary1 && summary1.studentCount === 3, 'listClasses must report the correct student count');
const summary2 = summaries.find((s) => s.classCode === code2);
assert(!!summary2 && summary2.studentCount === 0, 'a class nobody joined must be listed with 0 students');

// 14. createClass accepts an optional note, trims it, and omits it entirely when blank
const { db: dbWithNotedClass, classCode: notedCode } = createClass(db, '  ม.5/8  ');
const notedSummary = listClasses(dbWithNotedClass).find((s) => s.classCode === notedCode);
assert(notedSummary?.note === 'ม.5/8', 'createClass must trim whitespace around a supplied note');

const { db: dbWithBlankNoteClass, classCode: blankNoteCode } = createClass(dbWithNotedClass, '   ');
const blankNoteSummary = listClasses(dbWithBlankNoteClass).find((s) => s.classCode === blankNoteCode);
assert(
  blankNoteSummary?.note === undefined,
  'createClass must treat a whitespace-only note as no note at all'
);

// 15. setClassNote sets, updates, and clears a note on an existing class; fails on unknown code
const noteSet = setClassNote(dbWithBlankNoteClass, code1, 'ห้อง A');
assert(noteSet.ok === true, 'setting a note on an existing class must succeed');
let dbAfterNote = noteSet.ok ? noteSet.db : dbWithBlankNoteClass;
assert(
  listClasses(dbAfterNote).find((s) => s.classCode === code1)?.note === 'ห้อง A',
  'the new note must show up in listClasses'
);

const noteCleared = setClassNote(dbAfterNote, code1, '   ');
assert(noteCleared.ok === true, 'clearing a note (blank input) must still succeed');
dbAfterNote = noteCleared.ok ? noteCleared.db : dbAfterNote;
assert(
  listClasses(dbAfterNote).find((s) => s.classCode === code1)?.note === undefined,
  'a blank note must clear the existing note, not save an empty string'
);

const noteOnUnknown = setClassNote(dbAfterNote, 'NOPE77', 'x');
assert(noteOnUnknown.ok === false, 'setting a note on a non-existent class must fail');

db = dbAfterNote;

// 16. removeStudent drops exactly the targeted student, leaves others untouched, and is a
// no-op success (not an error) when the studentId is already absent — only a missing CLASS
// is a real error, matching REST DELETE semantics.
const rosterBeforeRemoval = getRoster(db, code1);
assert(rosterBeforeRemoval!.length === 3, 'sanity check: class should have 3 students before removal');

const removeResult = removeStudent(db, code1, 'student-2');
assert(removeResult.ok === true, 'removing an existing student must succeed');
db = removeResult.ok ? removeResult.db : db;
const rosterAfterRemoval = getRoster(db, code1);
assert(rosterAfterRemoval!.length === 2, 'removed student must no longer appear in the roster');
assert(
  !rosterAfterRemoval!.some((s) => s.studentId === 'student-2'),
  'the specifically removed studentId must be gone'
);
assert(
  rosterAfterRemoval!.some((s) => s.studentId === 'student-1') &&
    rosterAfterRemoval!.some((s) => s.studentId === 'student-3'),
  'removal must not affect other students in the same class'
);

const removeAgain = removeStudent(db, code1, 'student-2');
assert(
  removeAgain.ok === true,
  'removing an already-absent studentId must be an idempotent success, not an error'
);

const removeFromUnknownClass = removeStudent(db, 'NOPE88', 'student-1');
assert(removeFromUnknownClass.ok === false, 'removing a student from a non-existent class must fail');

// Removal isn't a ban: syncing the same studentId again under the same class code must work
// exactly like a first-time join.
const rejoinAfterRemoval = upsertStudentProgress(db, code1, 'student-2', 'Kanya', sampleProgress);
assert(rejoinAfterRemoval.ok === true, 'a removed student must be able to sync/rejoin normally afterward');

// 17. findStudentsByDisplayName — device-switch recovery matching (see classroomSync.ts's
// getStudentId doc comment). Case-insensitive, trimmed, and self-exclusion via excludeStudentId.
const recoveryRoster: StudentRecord[] = [
  { studentId: 'old-id-1', displayName: 'สมชาย ใจดี', lastSyncedAt: '2026-01-01T00:00:00.000Z', progress: sampleProgress },
  { studentId: 'old-id-2', displayName: '  สมชาย ใจดี  ', lastSyncedAt: '2026-01-02T00:00:00.000Z', progress: sampleProgress },
  { studentId: 'old-id-3', displayName: 'Somchai Jaidee', lastSyncedAt: '2026-01-03T00:00:00.000Z', progress: sampleProgress },
  { studentId: 'unrelated-id', displayName: 'กัญญา', lastSyncedAt: '2026-01-01T00:00:00.000Z', progress: sampleProgress }
];

const noMatches = findStudentsByDisplayName(recoveryRoster, 'ไม่มีใครชื่อนี้');
assert(noMatches.length === 0, 'zero existing records should match an unrelated name');

const singleMatch = findStudentsByDisplayName(recoveryRoster, 'กัญญา');
assert(
  singleMatch.length === 1 && singleMatch[0].studentId === 'unrelated-id',
  'a name with exactly one existing match must return exactly that one record'
);

const bothMatch = findStudentsByDisplayName(recoveryRoster, 'สมชาย ใจดี');
assert(
  bothMatch.length === 2 && bothMatch.some((s) => s.studentId === 'old-id-1') && bothMatch.some((s) => s.studentId === 'old-id-2'),
  'a name matching multiple existing records (here differing only by surrounding whitespace) must return all of them'
);

const caseInsensitive = findStudentsByDisplayName(recoveryRoster, '  SOMCHAI JAIDEE ');
assert(
  caseInsensitive.length === 1 && caseInsensitive[0].studentId === 'old-id-3',
  'matching must be case-insensitive and trim whitespace on both the input name and the stored displayName'
);

const excludingSelf = findStudentsByDisplayName(recoveryRoster, 'สมชาย ใจดี', 'old-id-1');
assert(
  excludingSelf.length === 1 && excludingSelf[0].studentId === 'old-id-2',
  'excludeStudentId must omit that studentId even if its name would otherwise match'
);

const blankNameMatch = findStudentsByDisplayName(recoveryRoster, '   ');
assert(blankNameMatch.length === 0, 'a blank name must never match anything');

console.log('='.repeat(50));
console.log('  ALL CLASSROOM SYNC TESTS PASSED!');
console.log('='.repeat(50));
