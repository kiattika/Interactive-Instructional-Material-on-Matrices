// E1 / E2 / Effectiveness Index (E.I.) — the standard Thai educational-innovation efficiency
// metrics, computed from roster data for TeacherAnalytics. Pure functions, unit-tested in
// src/tests/efficiencyStats.test.ts. Values are returned UNROUNDED; rounding happens only when
// displaying. Each figure carries its own n, because the three are computed over different
// subsets of students and must never be presented as sharing one denominator.
import type { SyncedProgress } from './classroomStore';

export type EfficiencyInput = Pick<SyncedProgress, 'preTestCompleted' | 'preTestScore' | 'postTestCompleted' | 'postTestScore'> & {
  // Optional: roster records synced before this field existed don't have it.
  lessonCheckScores?: Record<number, number>;
};

export interface EfficiencyFigure {
  value: number | null; // null = not enough data (never NaN, never a misleading 0)
  n: number;
}

export interface EffectivenessIndex extends EfficiencyFigure {
  meanPre: number | null;
  meanPost: number | null;
  // Set when paired data exists but E.I. is undefined: every paired student already scored 100 on
  // the Pre-Test, so the denominator (100 - mean pre) is 0.
  preAtCeiling: boolean;
}

export interface EfficiencyStats {
  e1: EfficiencyFigure;
  e2: EfficiencyFigure;
  ei: EffectivenessIndex;
  totalStudents: number;
}

const mean = (values: number[]): number => values.reduce((a, v) => a + v, 0) / values.length;

/**
 * E1 (process efficiency): each student's own average lesson score, then the average of those
 * per-student averages — only students with at least one scored lesson. Already 0-100.
 */
export function computeE1(students: EfficiencyInput[]): EfficiencyFigure {
  const perStudent = students
    .map((s) => Object.values(s.lessonCheckScores || {}).filter((v) => typeof v === 'number' && Number.isFinite(v)))
    .filter((scores) => scores.length > 0)
    .map(mean);
  return { value: perStudent.length ? mean(perStudent) : null, n: perStudent.length };
}

/** E2 (outcome efficiency): mean Post-Test score over students with postTestCompleted. */
export function computeE2(students: EfficiencyInput[]): EfficiencyFigure {
  const scores = students.filter((s) => s.postTestCompleted).map((s) => s.postTestScore);
  return { value: scores.length ? mean(scores) : null, n: scores.length };
}

/**
 * E.I. = (mean post - mean pre) / (100 - mean pre), over the PAIRED subset only (students who
 * completed both tests). Equivalent to the sum form (Σpost - Σpre) / (n·100 - Σpre).
 */
export function computeEffectivenessIndex(students: EfficiencyInput[]): EffectivenessIndex {
  const paired = students.filter((s) => s.preTestCompleted && s.postTestCompleted);
  if (paired.length === 0) return { value: null, n: 0, meanPre: null, meanPost: null, preAtCeiling: false };
  const meanPre = mean(paired.map((s) => s.preTestScore));
  const meanPost = mean(paired.map((s) => s.postTestScore));
  const denominator = 100 - meanPre;
  if (denominator === 0) return { value: null, n: paired.length, meanPre, meanPost, preAtCeiling: true };
  return { value: (meanPost - meanPre) / denominator, n: paired.length, meanPre, meanPost, preAtCeiling: false };
}

export function computeEfficiencyStats(students: EfficiencyInput[]): EfficiencyStats {
  return {
    e1: computeE1(students),
    e2: computeE2(students),
    ei: computeEffectivenessIndex(students),
    totalStudents: students.length
  };
}
