import fs from 'fs';
import path from 'path';
import {
  validateSurveySubmission,
  aggregateSurveyResponses,
  interpretLikertMean,
  SURVEY_QUESTION_IDS,
  SURVEY_SECTIONS,
  SurveyResponse,
  LikertScore
} from '../lib/surveyStore';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

console.log('='.repeat(50));
console.log('  QA: ANONYMOUS SATISFACTION SURVEY');
console.log('='.repeat(50));

// --- Question set matches the specified instrument ------------------------------------------------
assert(SURVEY_QUESTION_IDS.length === 11, 'the survey has exactly 11 Likert questions');
assert(SURVEY_SECTIONS.map((s) => s.questions.length).join(',') === '2,2,3,3,1', 'sections hold 2/2/3/3/1 questions as specified');

const allFours = Object.fromEntries(SURVEY_QUESTION_IDS.map((id) => [id, 4]));
const NOW = new Date('2026-09-23T10:42:13.456Z');

// --- Validation + whitelisting (anonymity at the boundary) ----------------------------------------
const hostile = validateSurveySubmission(
  { classCode: ' ab12cd ', answers: allFours, comment: '  ดีมาก  ', studentId: 'stu-123', displayName: 'สมชาย', extra: 1 },
  NOW
);
assert(hostile.ok === true, 'a complete submission validates');
if (hostile.ok) {
  const r = hostile.response;
  assert(JSON.stringify(Object.keys(r).sort()) === JSON.stringify(['answers', 'classCode', 'comment', 'submittedAt']),
    'identity/extra fields a client sends are dropped — only classCode, answers, comment, submittedAt survive');
  assert(!('studentId' in r) && !('displayName' in r), 'no studentId or displayName on the stored shape');
  assert(r.classCode === 'AB12CD', 'class code is trimmed and upper-cased');
  assert(r.comment === 'ดีมาก', 'comment is trimmed');
  assert(r.submittedAt === '2026-09-23', 'submittedAt is day-granularity only (no time that could be matched to a sync)');
  assert(JSON.stringify(Object.keys(r.answers).sort()) === JSON.stringify([...SURVEY_QUESTION_IDS].sort()), 'answers carry only the 11 known question ids');
}

const noComment = validateSurveySubmission({ classCode: 'X1', answers: allFours, comment: '   ' }, NOW);
assert(noComment.ok === true && !('comment' in (noComment as { response: SurveyResponse }).response), 'a blank comment is omitted entirely');

const missing = { ...allFours } as Record<string, unknown>;
delete missing.q7;
assert(validateSurveySubmission({ classCode: 'X1', answers: missing }).ok === false, 'a missing answer is rejected (all 11 required)');
for (const bad of [0, 6, 2.5, '4', null]) {
  assert(validateSurveySubmission({ classCode: 'X1', answers: { ...allFours, q3: bad } }).ok === false, `answer value ${JSON.stringify(bad)} is rejected (must be an integer 1-5)`);
}
assert(validateSurveySubmission({ answers: allFours }).ok === false, 'a submission without a class code is rejected');
assert(validateSurveySubmission({ classCode: 'X1', answers: allFours, comment: 'ก'.repeat(1001) }).ok === false, 'an over-long comment is rejected');

// --- Aggregation ---------------------------------------------------------------------------------
const resp = (scores: Partial<Record<string, number>>, comment?: string): SurveyResponse => ({
  classCode: 'X1',
  answers: { ...allFours, ...scores } as Record<(typeof SURVEY_QUESTION_IDS)[number], LikertScore>,
  comment,
  submittedAt: '2026-09-23'
});
const agg = aggregateSurveyResponses([resp({ q1: 5 }, 'ข'), resp({ q1: 3 }), resp({ q1: 4 }, 'ก')]);
const q1 = agg.questions.find((q) => q.id === 'q1')!;
assert(agg.n === 3, 'n counts every response');
assert(q1.mean === 4 && Math.abs((q1.sd as number) - 1) < 1e-9, 'q1 mean 4.00 and sample S.D. 1.00 for scores 5, 3, 4');
assert(agg.questions.find((q) => q.id === 'q2')!.sd === 0, 'identical scores give S.D. 0');
assert(JSON.stringify(agg.comments) === JSON.stringify(['ก', 'ข']), 'comments are listed sorted (no submission-order signal), blanks dropped');
assert(JSON.stringify(Object.keys(agg).sort()) === JSON.stringify(['comments', 'n', 'questions']), 'the aggregate exposes no raw rows or timestamps');

const empty = aggregateSurveyResponses([]);
assert(empty.n === 0 && empty.questions.every((q) => q.mean === null && q.sd === null), 'no responses gives null means, never NaN');
assert(aggregateSurveyResponses([resp({})]).questions[0].sd === null, 'S.D. is null (not 0 or NaN) when n = 1');

assert(
  [interpretLikertMean(4.51), interpretLikertMean(4.5), interpretLikertMean(3.51), interpretLikertMean(2.51), interpretLikertMean(1.51), interpretLikertMean(1.5)].join(',') ===
    'มากที่สุด,มาก,มาก,ปานกลาง,น้อย,น้อยที่สุด',
  'Likert interpretation cut-offs at 4.51 / 3.51 / 2.51 / 1.51'
);

// --- Static anonymity guard: survey code never touches student identity ----------------------------
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
for (const rel of ['src/lib/surveyStore.ts', 'src/lib/surveyClient.ts', 'server/surveyFileStore.ts', 'src/components/SatisfactionSurvey.tsx']) {
  const code = stripComments(fs.readFileSync(path.join(process.cwd(), rel), 'utf8'));
  assert(!/studentId|displayName|getStudentId|studentName/.test(code), `${rel} contains no reference to student identity`);
}

console.log('='.repeat(50));
console.log('  ALL SURVEY QA TESTS PASSED!');
console.log('='.repeat(50));
