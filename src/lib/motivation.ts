// Pure logic behind the motivational features: badge award rules, progress-toward-badge (for the
// Dashboard "next badge" nudge) and the daily learning streak. No React/DOM here, so it's unit-
// tested directly in src/tests/motivation.test.ts. Badge display metadata (names, icons) stays in
// components/BadgesAndCertificate.tsx's ALL_BADGES; this module only knows badge ids and rules,
// and is the single source for those rules — LessonView/MatrixLab award with them and the nudge
// measures against them, so the two can't drift apart.
import { CURRICULUM_LESSONS, StudentProgress, SolvingMethod } from './learningStore';

// Completing lesson N earns the badge (lesson content each badge is about).
export const LESSON_COMPLETION_BADGES: Record<number, string> = {
  2: 'matrix_explorer',
  3: 'determinant_master',
  5: 'inverse_solver',
  6: 'cramer_specialist',
  8: 'gaussian_expert'
};
export const MATRIX_MASTER_BADGE = 'matrix_master';

// Earned by trying every solving method in Matrix Lab — rewards breadth rather than any one
// method, since the curriculum treats all three as equally valid for 2x2/3x3 systems.
export const VERSATILE_SOLVER_BADGE = 'versatile_solver';
export const SOLVING_METHODS: readonly SolvingMethod[] = ['inverse', 'cramer', 'gauss'];

/** Badges a lesson completion newly qualifies for (caller skips this while badges are disabled). */
export function badgesForLessonCompletion(lessonId: number, completedLessons: number[], earned: string[]): string[] {
  const out: string[] = [];
  const lessonBadge = LESSON_COMPLETION_BADGES[lessonId];
  if (lessonBadge && !earned.includes(lessonBadge)) out.push(lessonBadge);
  if (completedLessons.length >= CURRICULUM_LESSONS.length && !earned.includes(MATRIX_MASTER_BADGE)) {
    out.push(MATRIX_MASTER_BADGE);
  }
  return out;
}

/**
 * Records that the student used a solving method. Returns the same object when nothing changed
 * (so callers can skip a redundant save/sync). The badge is only granted while badges are
 * enabled — same "never touched while disabled" rule as LessonView's lesson badges.
 */
export function withMethodUsed(progress: StudentProgress, method: SolvingMethod, badgesEnabled: boolean): StudentProgress {
  const methodsUsed = progress.methodsUsed.includes(method) ? progress.methodsUsed : [...progress.methodsUsed, method];
  const qualifies = SOLVING_METHODS.every((m) => methodsUsed.includes(m));
  const award = badgesEnabled && qualifies && !progress.earnedBadges.includes(VERSATILE_SOLVER_BADGE);
  if (methodsUsed === progress.methodsUsed && !award) return progress;
  return {
    ...progress,
    methodsUsed,
    earnedBadges: award ? [...progress.earnedBadges, VERSATILE_SOLVER_BADGE] : progress.earnedBadges
  };
}

/**
 * Fraction (0..1) of the way to earning a badge, or null for a badge with no measurable rule.
 * Lesson badges count lessons 1..N completed out of N — the path is sequential, so that's how
 * far along the student is toward reaching and finishing lesson N.
 */
export function badgeProgress(badgeId: string, progress: StudentProgress): number | null {
  if (badgeId === MATRIX_MASTER_BADGE) {
    return Math.min(1, progress.completedLessons.length / CURRICULUM_LESSONS.length);
  }
  if (badgeId === VERSATILE_SOLVER_BADGE) {
    return SOLVING_METHODS.filter((m) => progress.methodsUsed.includes(m)).length / SOLVING_METHODS.length;
  }
  const entry = Object.entries(LESSON_COMPLETION_BADGES).find(([, id]) => id === badgeId);
  if (!entry) return null;
  const lessonId = Number(entry[0]);
  const done = progress.completedLessons.filter((id) => id <= lessonId).length;
  return Math.min(1, done / lessonId);
}

export interface BadgeNudge {
  badgeId: string;
  remainingPercent: number; // 1..100
}

/**
 * The not-yet-earned badge with the highest progress (ties: earliest in `badgeIds` order), or
 * null if none is left to work toward. Badges already at 100% but unearned (criteria met while
 * a teacher had badges disabled) are skipped — there's no remaining progress to nudge toward.
 */
export function getNextBadgeNudge(badgeIds: string[], progress: StudentProgress): BadgeNudge | null {
  let best: { badgeId: string; value: number } | null = null;
  for (const badgeId of badgeIds) {
    if (progress.earnedBadges.includes(badgeId)) continue;
    const value = badgeProgress(badgeId, progress);
    if (value === null || value >= 1) continue;
    if (!best || value > best.value) best = { badgeId, value };
  }
  if (!best) return null;
  return { badgeId: best.badgeId, remainingPercent: Math.max(1, 100 - Math.floor(best.value * 100)) };
}

// ---------------------------------------------------------------------------------------------
// Learning streak

// Student-local calendar day (not UTC: in Thailand, UTC+7, a UTC key would roll over at 7am).
export function localDateKey(date: Date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

// Bounded so localStorage can't grow forever; far longer than any realistic streak window.
export const MAX_ACTIVITY_DAYS = 400;

/** Marks today as an active learning day. Returns the same object if today is already recorded. */
export function withActivity(progress: StudentProgress, date: Date = new Date()): StudentProgress {
  const key = localDateKey(date);
  if (progress.activityDates.includes(key)) return progress;
  const activityDates = [...progress.activityDates, key].sort().slice(-MAX_ACTIVITY_DAYS);
  return { ...progress, activityDates };
}

export interface LearningStreak {
  current: number; // consecutive active days ending today (or yesterday, see below)
  activeToday: boolean;
}

/**
 * A streak still counts if the last active day was yesterday — the student simply hasn't
 * studied *yet* today, and it only breaks once a whole day passes with no activity.
 */
export function computeLearningStreak(activityDates: string[], today: Date = new Date()): LearningStreak {
  const days = new Set(activityDates);
  // Noon avoids any DST-edge surprises when stepping back one day at a time.
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const activeToday = days.has(localDateKey(cursor));
  if (!activeToday) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (days.has(localDateKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, activeToday };
}
