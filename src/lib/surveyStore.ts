// Pure, platform-agnostic logic for the anonymous post-course satisfaction survey
// (แบบประเมินความพึงพอใจ). Mirrors livePollStore.ts / classroomStore.ts on purpose: no filesystem
// or network access here — persistence lives in server/surveyFileStore.ts — so this module is
// unit-tested directly (src/tests/surveyStore.test.ts) and shared by client and server.
//
// ANONYMITY IS A DESIGN REQUIREMENT, not an omission: responses carry no student identifier or
// display name anywhere — not in this shape, not in the stored Firestore document, not in the
// document id (Firestore auto-ids). This is a deliberate research-validity choice to reduce
// response bias; don't add identity later. Supporting measures:
//   - validateSurveySubmission() rebuilds the response from whitelisted fields only, so extra
//     fields a client might send can never be persisted.
//   - submittedAt is stored at DAY granularity: a to-the-second timestamp could be matched
//     against the roster's lastSyncedAt (written when the student's Post-Test result syncs).
//   - aggregateSurveyResponses() returns only averages, counts and comment text — never raw
//     rows or timestamps — and sorts comments so their order carries no submission-order signal.

export type LikertScore = 1 | 2 | 3 | 4 | 5;

export const LIKERT_LABELS: Record<LikertScore, string> = {
  1: 'น้อยที่สุด',
  2: 'น้อย',
  3: 'ปานกลาง',
  4: 'มาก',
  5: 'มากที่สุด'
};

export interface SurveySection {
  title: string;
  questions: { id: SurveyQuestionId; text: string }[];
}

export type SurveyQuestionId = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7' | 'q8' | 'q9' | 'q10' | 'q11';

export const SURVEY_SECTIONS: SurveySection[] = [
  {
    title: 'ด้านเนื้อหา (Content)',
    questions: [
      { id: 'q1', text: 'เนื้อหาบทเรียนมีความเหมาะสมกับระดับความรู้ของฉัน' },
      { id: 'q2', text: 'คำอธิบายและตัวอย่างในบทเรียนเข้าใจง่าย' }
    ]
  },
  {
    title: 'ด้านการออกแบบและการใช้งาน (Design & Usability)',
    questions: [
      { id: 'q3', text: 'หน้าจอและเมนูต่างๆ ใช้งานง่าย ไม่สับสน' },
      { id: 'q4', text: 'สมการและเมทริกซ์แสดงผลชัดเจน อ่านง่าย' }
    ]
  },
  {
    title: 'ด้านการมีปฏิสัมพันธ์และแรงจูงใจ (Interactivity & Motivation)',
    questions: [
      { id: 'q5', text: 'ระบบคะแนนสะสม (XP) และตราสัญลักษณ์ (Badge) ทำให้ฉันอยากเรียนต่อ' },
      { id: 'q6', text: '"ครูพี่หนุ่ม AI" ช่วยให้ฉันเข้าใจวิธีแก้โจทย์มากขึ้น' },
      { id: 'q7', text: 'ห้องปฏิบัติการเมทริกซ์ (Matrix Lab) ช่วยให้ฉันฝึกฝนได้ด้วยตนเอง' }
    ]
  },
  {
    title: 'ด้านประโยชน์ที่ได้รับ (Perceived Benefit)',
    questions: [
      { id: 'q8', text: 'หลังใช้สื่อการสอนนี้ ฉันเข้าใจเรื่องเมทริกซ์มากขึ้นกว่าก่อนเรียน' },
      { id: 'q9', text: 'ฉันมั่นใจในการแก้โจทย์ระบบสมการเชิงเส้นมากขึ้น' },
      { id: 'q10', text: 'ฉันสามารถนำความรู้เรื่องเมทริกซ์ไปประยุกต์ใช้ในสถานการณ์อื่นได้' }
    ]
  },
  {
    title: 'ภาพรวม (Overall)',
    questions: [{ id: 'q11', text: 'โดยรวมฉันพึงพอใจกับสื่อการสอนนี้' }]
  }
];

export const SURVEY_QUESTION_IDS: SurveyQuestionId[] = SURVEY_SECTIONS.flatMap((s) => s.questions.map((q) => q.id));

export const SURVEY_COMMENT_MAX_LENGTH = 1000;

// Deliberately no studentId / displayName field (see the header comment).
export interface SurveyResponse {
  classCode: string;
  answers: Record<SurveyQuestionId, LikertScore>;
  comment?: string;
  submittedAt: string; // "YYYY-MM-DD" (UTC day), see header comment
}

export type SurveyValidation =
  | { ok: true; response: SurveyResponse }
  | { ok: false; error: 'missing_class_code' | 'invalid_answers' | 'comment_too_long' };

function isLikertScore(v: unknown): v is LikertScore {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;
}

/**
 * Validates an untrusted submission body and rebuilds it from whitelisted fields only — any other
 * property (e.g. a studentId a modified client adds) is dropped, never persisted.
 */
export function validateSurveySubmission(body: unknown, now: Date = new Date()): SurveyValidation {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const classCode = typeof b.classCode === 'string' ? b.classCode.trim().toUpperCase() : '';
  if (!classCode) return { ok: false, error: 'missing_class_code' };

  const rawAnswers = (b.answers && typeof b.answers === 'object' ? b.answers : {}) as Record<string, unknown>;
  const answers = {} as Record<SurveyQuestionId, LikertScore>;
  for (const id of SURVEY_QUESTION_IDS) {
    const v = rawAnswers[id];
    if (!isLikertScore(v)) return { ok: false, error: 'invalid_answers' };
    answers[id] = v;
  }

  const rawComment = typeof b.comment === 'string' ? b.comment.trim() : '';
  if (rawComment.length > SURVEY_COMMENT_MAX_LENGTH) return { ok: false, error: 'comment_too_long' };

  const response: SurveyResponse = { classCode, answers, submittedAt: now.toISOString().slice(0, 10) };
  if (rawComment) response.comment = rawComment;
  return { ok: true, response };
}

export interface SurveyQuestionStat {
  id: SurveyQuestionId;
  mean: number | null; // null when n = 0
  sd: number | null; // sample standard deviation; null when n < 2
}

export interface SurveyAggregate {
  n: number;
  questions: SurveyQuestionStat[];
  comments: string[];
}

/** Averages only — never returns raw rows, timestamps or anything per-response besides comment text. */
export function aggregateSurveyResponses(responses: SurveyResponse[]): SurveyAggregate {
  const questions = SURVEY_QUESTION_IDS.map((id): SurveyQuestionStat => {
    const values = responses.map((r) => r.answers[id]).filter(isLikertScore);
    if (values.length === 0) return { id, mean: null, sd: null };
    const mean = values.reduce((a, v) => a + v, 0) / values.length;
    const sd =
      values.length < 2 ? null : Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1));
    return { id, mean, sd };
  });
  const comments = responses
    .map((r) => (r.comment || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'th'));
  return { n: responses.length, questions, comments };
}

/**
 * Common Thai 5-level interpretation of a Likert mean: 4.51-5.00 มากที่สุด, 3.51-4.50 มาก,
 * 2.51-3.50 ปานกลาง, 1.51-2.50 น้อย, 1.00-1.50 น้อยที่สุด. (Some reports use equal-width 0.80
 * bands instead, e.g. 4.21-5.00 — change the cut-offs here if the report must follow that one.)
 */
export function interpretLikertMean(mean: number): string {
  if (mean > 4.5) return LIKERT_LABELS[5];
  if (mean > 3.5) return LIKERT_LABELS[4];
  if (mean > 2.5) return LIKERT_LABELS[3];
  if (mean > 1.5) return LIKERT_LABELS[2];
  return LIKERT_LABELS[1];
}
