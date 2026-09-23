// Two-strike answering for PRACTICE questions only (lesson check-questions and Exercises MCQs) —
// never Pre/Post-Test, which are assessments and show no per-question feedback by design.
//
// Socratic flow: a first wrong pick shows why THAT option is wrong (not the answer) and lets the
// student try again; a second wrong pick reveals the answer and explanation.
//   - correct on the first try  -> full XP
//   - correct on the second try -> CHECK_QUESTION_SECOND_TRY_XP (half, rounded up)
//   - wrong twice               -> no XP, ever, for that question
//
// Strikes must survive the "reset/try again" buttons and revisiting the page, otherwise they're
// trivially bypassed, so two markers live in StudentProgress:
//   - checkQuestionFirstTryMissed: a first wrong pick happened at some point -> max half XP later
//   - checkQuestionXpAwarded: the question's XP is settled — either paid out, or forfeited because
//     the answer was revealed (closes the old loophole of revealing the answer, pressing "try
//     again", then picking it for full XP)
import {
  StudentProgress,
  CHECK_QUESTION_CORRECT_XP,
  CHECK_QUESTION_SECOND_TRY_XP
} from './learningStore';

export type CheckAttemptOutcome = 'correct' | 'retry' | 'revealed';

export interface CheckAttemptResult {
  progress: StudentProgress; // same object when nothing needed persisting
  outcome: CheckAttemptOutcome;
  xpAwarded: number;
}

/**
 * @param wrongPicksThisSitting wrong picks already made on this question in the current sitting
 *   (0 or 1) — a second wrong pick reveals the answer.
 * @param xpEnabled teacher's enableXp. While off, no XP is paid and a correct answer does not
 *   settle the key (same "pause, don't rewrite" rule as elsewhere); misses and reveals are still
 *   recorded, since they reflect what the student actually saw.
 */
export function resolveCheckAttempt(
  progress: StudentProgress,
  xpKey: string,
  isCorrect: boolean,
  wrongPicksThisSitting: number,
  xpEnabled: boolean
): CheckAttemptResult {
  const settled = progress.checkQuestionXpAwarded.includes(xpKey);
  const missedBefore = wrongPicksThisSitting > 0 || progress.checkQuestionFirstTryMissed.includes(xpKey);
  // First-settle outcome for lesson scoring (E1) — only when the question is settling for the
  // first time, so a practice retry after the answer was revealed can never improve it.
  const withOutcome = (p: StudentProgress, value: number): StudentProgress =>
    settled || xpKey in p.checkQuestionOutcomes
      ? p
      : { ...p, checkQuestionOutcomes: { ...p.checkQuestionOutcomes, [xpKey]: value } };

  if (isCorrect) {
    const recorded = withOutcome(progress, missedBefore ? 0.5 : 1);
    if (settled || !xpEnabled) return { progress: recorded, outcome: 'correct', xpAwarded: 0 };
    const xp = missedBefore ? CHECK_QUESTION_SECOND_TRY_XP : CHECK_QUESTION_CORRECT_XP;
    return {
      progress: { ...recorded, xp: recorded.xp + xp, checkQuestionXpAwarded: [...recorded.checkQuestionXpAwarded, xpKey] },
      outcome: 'correct',
      xpAwarded: xp
    };
  }

  if (wrongPicksThisSitting === 0) {
    const next = progress.checkQuestionFirstTryMissed.includes(xpKey)
      ? progress
      : { ...progress, checkQuestionFirstTryMissed: [...progress.checkQuestionFirstTryMissed, xpKey] };
    return { progress: next, outcome: 'retry', xpAwarded: 0 };
  }

  const revealed = withOutcome(progress, 0);
  const next = settled ? revealed : { ...revealed, checkQuestionXpAwarded: [...revealed.checkQuestionXpAwarded, xpKey] };
  return { progress: next, outcome: 'revealed', xpAwarded: 0 };
}

/**
 * A lesson's formative score, 0-100: the mean of its check-questions' first-settle outcomes
 * (1 / 0.5 / 0) × 100 — exact, no rounding. null unless EVERY question has a recorded outcome
 * (e.g. questions settled before outcomes were tracked), so E1 never uses a partial or guessed score.
 */
export function lessonCheckScore(progress: StudentProgress, lessonId: number, questionCount: number): number | null {
  if (questionCount === 0) return null;
  let total = 0;
  for (let i = 0; i < questionCount; i++) {
    const outcome = progress.checkQuestionOutcomes[`lesson${lessonId}-check${i}`];
    if (outcome === undefined) return null;
    total += outcome;
  }
  return (total / questionCount) * 100;
}
