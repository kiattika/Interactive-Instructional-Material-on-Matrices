import { defaultStudentProgress, StudentProgress, CURRICULUM_LESSONS } from '../lib/learningStore';
import {
  badgesForLessonCompletion,
  badgeProgress,
  computeLearningStreak,
  getNextBadgeNudge,
  localDateKey,
  withActivity,
  withMethodUsed,
  MAX_ACTIVITY_DAYS,
  VERSATILE_SOLVER_BADGE
} from '../lib/motivation';
import { ALL_BADGES } from '../components/BadgesAndCertificate';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

console.log('='.repeat(50));
console.log('  QA: MOTIVATION (BADGES, NUDGE, STREAK)');
console.log('='.repeat(50));

const fresh = (overrides: Partial<StudentProgress> = {}): StudentProgress => ({
  ...defaultStudentProgress,
  completedLessons: [],
  earnedBadges: [],
  methodsUsed: [],
  activityDates: [],
  ...overrides
});
const BADGE_IDS = ALL_BADGES.map((b) => b.id);

// --- Badge rules stay in sync with badge metadata -------------------------------------------
for (const id of BADGE_IDS) {
  assert(badgeProgress(id, fresh()) !== null, `every badge in ALL_BADGES has a measurable rule (${id})`);
}
assert(BADGE_IDS.includes(VERSATILE_SOLVER_BADGE), 'Versatile Solver is listed in ALL_BADGES');

// --- Lesson badges: same behavior LessonView had before the rules moved here -----------------
assert(
  JSON.stringify(badgesForLessonCompletion(2, [1, 2], [])) === JSON.stringify(['matrix_explorer']),
  'finishing lesson 2 awards matrix_explorer'
);
assert(badgesForLessonCompletion(2, [1, 2], ['matrix_explorer']).length === 0, 'an already-earned lesson badge is not re-awarded');
assert(badgesForLessonCompletion(4, [1, 2, 3, 4], []).length === 0, 'a lesson with no badge awards nothing');
const allLessons = CURRICULUM_LESSONS.map((l) => l.id);
assert(
  badgesForLessonCompletion(12, allLessons, []).includes('matrix_master'),
  'completing every lesson awards matrix_master'
);

// --- Versatile Solver -------------------------------------------------------------------------
let p = fresh();
p = withMethodUsed(p, 'inverse', true);
p = withMethodUsed(p, 'cramer', true);
assert(!p.earnedBadges.includes(VERSATILE_SOLVER_BADGE), 'two of three methods is not enough for Versatile Solver');
const beforeRepeat = p;
assert(withMethodUsed(p, 'cramer', true) === beforeRepeat, 're-using a known method returns the same object (no redundant save)');
p = withMethodUsed(p, 'gauss', true);
assert(p.earnedBadges.includes(VERSATILE_SOLVER_BADGE), 'using all three methods awards Versatile Solver');
assert(p.earnedBadges.filter((b) => b === VERSATILE_SOLVER_BADGE).length === 1, 'Versatile Solver is awarded exactly once');

let disabled = fresh();
for (const m of ['inverse', 'cramer', 'gauss'] as const) disabled = withMethodUsed(disabled, m, false);
assert(disabled.methodsUsed.length === 3, 'method use is still tracked while badges are disabled');
assert(!disabled.earnedBadges.includes(VERSATILE_SOLVER_BADGE), 'no badge is awarded while badges are disabled');

// --- Progress + next-badge nudge ----------------------------------------------------------------
assert(badgeProgress('matrix_explorer', fresh({ completedLessons: [1] })) === 0.5, 'lesson-2 badge is 50% after lesson 1');
assert(badgeProgress(VERSATILE_SOLVER_BADGE, fresh({ methodsUsed: ['gauss'] })) === 1 / 3, 'Versatile Solver progress counts methods used');

const newStudent = getNextBadgeNudge(BADGE_IDS, fresh());
assert(newStudent !== null && newStudent.badgeId === 'matrix_explorer' && newStudent.remainingPercent === 100,
  'a brand-new student is nudged toward the first badge, 100% remaining');

const twoMethods = getNextBadgeNudge(BADGE_IDS, fresh({ completedLessons: [1], methodsUsed: ['inverse', 'cramer'] }));
assert(twoMethods !== null && twoMethods.badgeId === VERSATILE_SOLVER_BADGE && twoMethods.remainingPercent === 34,
  'highest-progress badge wins (2/3 methods = 67% beats lesson-2 at 50%), rounded so remaining is 34%');

const skipEarned = getNextBadgeNudge(BADGE_IDS, fresh({ completedLessons: [1], earnedBadges: ['matrix_explorer'] }));
assert(skipEarned !== null && skipEarned.badgeId !== 'matrix_explorer', 'already-earned badges are never the nudge');

const metWhileDisabled = getNextBadgeNudge(['matrix_explorer'], fresh({ completedLessons: [1, 2] }));
assert(metWhileDisabled === null, 'a badge at 100% but unearned (met while badges were off) is not nudged');

assert(getNextBadgeNudge(BADGE_IDS, fresh({ earnedBadges: BADGE_IDS })) === null, 'no nudge once every badge is earned');

// --- Activity + streak ------------------------------------------------------------------------
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9);
assert(localDateKey(day(2026, 1, 5)) === '2026-01-05', 'date keys are zero-padded local YYYY-MM-DD');

let a = fresh();
a = withActivity(a, day(2026, 9, 20));
const same = withActivity(a, day(2026, 9, 20));
assert(same === a, 'recording the same day twice returns the same object');
a = withActivity(a, day(2026, 9, 18));
assert(JSON.stringify(a.activityDates) === JSON.stringify(['2026-09-18', '2026-09-20']), 'activity dates stay sorted and unique');

let many = fresh();
for (let i = 0; i < MAX_ACTIVITY_DAYS + 20; i++) many = withActivity(many, new Date(2024, 0, 1 + i, 9));
assert(many.activityDates.length === MAX_ACTIVITY_DAYS, 'stored activity days are capped');
assert(many.activityDates[many.activityDates.length - 1] === localDateKey(new Date(2024, 0, MAX_ACTIVITY_DAYS + 20, 9)), 'the cap drops the oldest days, keeping the newest');

const today = day(2026, 3, 2);
assert(computeLearningStreak([], today).current === 0, 'no activity means a 0-day streak');
assert(
  computeLearningStreak(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'], today).current === 4,
  'consecutive days across a month boundary count as one streak'
);
const alive = computeLearningStreak(['2026-02-28', '2026-03-01'], today);
assert(alive.current === 2 && !alive.activeToday, 'a streak ending yesterday is still alive (not yet studied today)');
assert(computeLearningStreak(['2026-02-27', '2026-02-28'], today).current === 0, 'a full missed day breaks the streak');
assert(computeLearningStreak(['2026-02-25', '2026-03-01', '2026-03-02'], today).current === 2, 'only the most recent unbroken run counts');

console.log('='.repeat(50));
console.log('  ALL MOTIVATION QA TESTS PASSED!');
console.log('='.repeat(50));
