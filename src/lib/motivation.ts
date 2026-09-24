// Pure logic behind the motivational features: badge award rules, progress-toward-badge (for the
// Dashboard "next badge" nudge) and the daily learning streak. No React/DOM here, so it's unit-
// tested directly in src/tests/motivation.test.ts. Badge display metadata (names, icons) stays in
// components/BadgesAndCertificate.tsx's ALL_BADGES; this module only knows badge ids and rules,
// and is the single source for those rules — LessonView/MatrixLab award with them and the nudge
// measures against them, so the two can't drift apart.
import { CURRICULUM_LESSONS, StudentProgress, SolvingMethod, LabPracticeKey } from './learningStore';

const anyPractice = (p: StudentProgress, keys: LabPracticeKey[]) => keys.some((k) => p.matrixLabPracticeCompleted.includes(k));

// Lesson badges: completing lesson N, plus — for the four method badges, whose descriptions claim
// demonstrated skill ("แก้สมการ ... ได้อย่างถูกต้อง") — the matching hands-on Matrix Lab walkthrough
// completed at least once (any size). Reading the lesson and answering its check-questions alone
// is not enough for those four.
interface LessonBadgeRule {
  lessonId: number;
  labDone?: (p: StudentProgress) => boolean;
}
export const LESSON_BADGE_RULES: Record<string, LessonBadgeRule> = {
  matrix_explorer: { lessonId: 2 },
  // No walkthrough of its own: both the Inverse and Cramer practice have the student compute
  // determinants by hand (the shared InteractiveDeterminant), so either one counts.
  determinant_master: { lessonId: 3, labDone: (p) => anyPractice(p, ['inverse-2x2', 'inverse-3x3', 'cramer-2x2', 'cramer-3x3']) },
  inverse_solver: { lessonId: 5, labDone: (p) => anyPractice(p, ['inverse-2x2', 'inverse-3x3']) },
  cramer_specialist: { lessonId: 6, labDone: (p) => anyPractice(p, ['cramer-2x2', 'cramer-3x3']) },
  gaussian_expert: { lessonId: 8, labDone: (p) => p.matrixLabGaussCompleted }
};
export const MATRIX_MASTER_BADGE = 'matrix_master';

// Earned by trying every solving method in Matrix Lab — rewards breadth rather than any one
// method, since the curriculum treats all three as equally valid for 2x2/3x3 systems.
export const VERSATILE_SOLVER_BADGE = 'versatile_solver';
export const SOLVING_METHODS: readonly SolvingMethod[] = ['inverse', 'cramer', 'gauss'];

/** Whether current progress meets a lesson badge's or Matrix Master's criteria. */
export function qualifiesForBadge(badgeId: string, progress: StudentProgress): boolean {
  if (badgeId === MATRIX_MASTER_BADGE) return progress.completedLessons.length >= CURRICULUM_LESSONS.length;
  const rule = LESSON_BADGE_RULES[badgeId];
  if (!rule) return false;
  return progress.completedLessons.includes(rule.lessonId) && (!rule.labDone || rule.labDone(progress));
}

/**
 * Awards every lesson badge / Matrix Master the student now qualifies for and hasn't earned yet.
 * Called after BOTH kinds of events that can complete a criterion — finishing a lesson
 * (LessonView) and finishing a lab walkthrough (MatrixLab) — since they can happen in either order.
 * Returns the same object when nothing new is earned. Never awards while badges are disabled
 * (nothing retroactive the moment a teacher re-enables them); badges already earned are never revoked.
 */
export function withEarnedBadges(progress: StudentProgress, badgesEnabled: boolean): StudentProgress {
  if (!badgesEnabled) return progress;
  const newlyEarned = [...Object.keys(LESSON_BADGE_RULES), MATRIX_MASTER_BADGE].filter(
    (id) => !progress.earnedBadges.includes(id) && qualifiesForBadge(id, progress)
  );
  return newlyEarned.length ? { ...progress, earnedBadges: [...progress.earnedBadges, ...newlyEarned] } : progress;
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
 * far along the student is toward reaching and finishing lesson N. For the lab-gated method
 * badges that lesson part is half, and the Matrix Lab walkthrough is the other half.
 */
export function badgeProgress(badgeId: string, progress: StudentProgress): number | null {
  if (badgeId === MATRIX_MASTER_BADGE) {
    return Math.min(1, progress.completedLessons.length / CURRICULUM_LESSONS.length);
  }
  if (badgeId === VERSATILE_SOLVER_BADGE) {
    return SOLVING_METHODS.filter((m) => progress.methodsUsed.includes(m)).length / SOLVING_METHODS.length;
  }
  const rule = LESSON_BADGE_RULES[badgeId];
  if (!rule) return null;
  const lessonPart = Math.min(1, progress.completedLessons.filter((id) => id <= rule.lessonId).length / rule.lessonId);
  // Lab-gated badges: the lesson path and the hands-on walkthrough each count for half.
  return rule.labDone ? lessonPart / 2 + (rule.labDone(progress) ? 0.5 : 0) : lessonPart;
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
