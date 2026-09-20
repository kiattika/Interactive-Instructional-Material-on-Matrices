import {
  createEmptyDB,
  createClass,
  generateClassCode,
  classExists,
  upsertStudentProgress,
  getRoster,
  SyncedProgress
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

console.log('='.repeat(50));
console.log('  ALL CLASSROOM SYNC TESTS PASSED!');
console.log('='.repeat(50));
