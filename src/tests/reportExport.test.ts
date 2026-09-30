import { createHash } from 'crypto';
import { buildReportData, buildResearchMetadata, reportFileName } from '../lib/reportExport';
import { AI_REPORT_PROMPT } from '../lib/aiReportPrompt';
import { defaultTeacherSettings } from '../lib/learningStore';
import { computeEfficiencyStats } from '../lib/efficiencyStats';
import { SURVEY_QUESTION_IDS, SurveyAggregate } from '../lib/surveyStore';
import type { ClassSummary, StudentRecord, SyncedProgress } from '../lib/classroomStore';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

console.log('='.repeat(50));
console.log('  QA: EXPORT REPORT DATA');
console.log('='.repeat(50));

const student = (id: string, p: Partial<SyncedProgress>): StudentRecord => ({
  studentId: id,
  displayName: `name-${id}`,
  lastSyncedAt: '2026-09-01T00:00:00.000Z',
  progress: { preTestCompleted: false, preTestScore: 0, postTestCompleted: false, postTestScore: 0, ...p } as SyncedProgress
});
const survey = (n: number): SurveyAggregate => ({
  n,
  questions: SURVEY_QUESTION_IDS.map((id) => ({ id, mean: n ? 4 : null, sd: null })),
  comments: []
});

const classes: ClassSummary[] = [
  { classCode: 'AAAA', createdAt: '2026-08-01T00:00:00.000Z', active: true, note: 'ม.5/1', studentCount: 2, aiEnabled: true, includeInResearch: true },
  { classCode: 'BBBB', createdAt: '2026-08-02T00:00:00.000Z', active: false, studentCount: 1, aiEnabled: true, includeInResearch: true },
  { classCode: 'CCCC', createdAt: '2026-08-03T00:00:00.000Z', active: true, studentCount: 0, aiEnabled: false, includeInResearch: true },
  // Excluded from the research: listed, but must not touch any statistic.
  { classCode: 'DDDD', createdAt: '2026-08-04T00:00:00.000Z', active: true, note: 'ห้องทดลองใช้', studentCount: 1, aiEnabled: true, includeInResearch: false }
];
const a1 = student('a1', { preTestCompleted: true, preTestScore: 40, postTestCompleted: true, postTestScore: 80, lessonCheckScores: { 1: 90 } });
const a2 = student('a2', { postTestCompleted: true, postTestScore: 70 });
const b1 = student('b1', { preTestCompleted: true, preTestScore: 60, postTestCompleted: true, postTestScore: 90 });
const d1 = student('d1', { preTestCompleted: true, preTestScore: 0, postTestCompleted: true, postTestScore: 100, lessonCheckScores: { 1: 100 } });
const rostersByClass = { AAAA: [a1, a2], BBBB: [b1], DDDD: [d1] }; // CCCC missing = roster 404'd

const report = buildReportData({
  classes,
  rostersByClass,
  surveyAll: survey(3),
  surveyByClass: { AAAA: survey(2), BBBB: survey(1), CCCC: survey(0), DDDD: survey(9) },
  metadata: { title: 'ชื่อเรื่อง', school: 'โรงเรียนทดสอบ' },
  generatedAt: new Date('2026-09-30T05:00:00.000Z')
});

assert(report.generatedAt === '2026-09-30T05:00:00.000Z', 'generatedAt is the ISO timestamp passed in');
assert(report.totals.classroomCount === 4 && report.totals.activeClassroomCount === 3 && report.totals.inactiveClassroomCount === 1,
  'classroom totals split active / inactive');
assert(report.totals.researchClassroomCount === 3 && report.totals.excludedFromResearchClassroomCount === 1,
  'classroom totals split research / excluded');
assert(report.totals.studentCount === 3 && report.totals.excludedFromResearchStudentCount === 1,
  "research student total leaves out the excluded classroom's students");
const dddd = report.classrooms[3];
assert(dddd.includeInResearch === false && dddd.studentCount === 1 && dddd.efficiency === null && dddd.survey === null,
  'an excluded classroom keeps its roster count but has no efficiency or survey figures');
assert(JSON.stringify(report.aggregate.efficiency) === JSON.stringify(computeEfficiencyStats([a1, a2, b1].map((s) => s.progress))),
  'aggregate E1/E2/E.I. is exactly computeEfficiencyStats over every student');
assert(JSON.stringify(report.classrooms[0].efficiency) === JSON.stringify(computeEfficiencyStats([a1.progress, a2.progress])),
  'per-classroom E1/E2/E.I. is exactly computeEfficiencyStats over that roster');
assert(report.classrooms[2].studentCount === 0 && report.classrooms[2].efficiency.e2.value === null,
  'a classroom with no roster exports 0 students and null figures, never fake zeros');
assert(report.classrooms[0].note === 'ม.5/1' && report.classrooms[1].note === null, 'classroom notes exported (null when unset)');
assert(report.classrooms[1].active === false, 'inactive status exported per classroom');
assert(report.aggregate.survey.n === 3 && report.classrooms[1].survey.n === 1, 'survey aggregates passed through unchanged');
assert(report.surveyQuestions.length === SURVEY_QUESTION_IDS.length, 'survey question legend covers every question');
const json = JSON.stringify(report);
assert(!json.includes('name-a1') && !json.includes('"a1"'), 'no student names or ids leak into the export');
assert(report.metadata.title === 'ชื่อเรื่อง' && report.metadata.school === 'โรงเรียนทดสอบ', 'metadata passed through to the export');
assert(report.aiReportPrompt === AI_REPORT_PROMPT, 'aiReportPrompt is the AI_REPORT_PROMPT constant');

// Research metadata: only filled-in fields, trimmed; legacy settings without the fields → {}.
assert(JSON.stringify(buildResearchMetadata(defaultTeacherSettings)) === '{}', 'default (all empty) settings export an empty metadata object');
const legacySettings = { masteryThreshold: 70, enableAiTutor: true, enableHints: true, enableXp: true, enableBadges: true };
assert(JSON.stringify(buildResearchMetadata(legacySettings)) === '{}', 'settings saved before the research fields existed export {}');
const filled = buildResearchMetadata({ ...defaultTeacherSettings, researchAuthor: '  ครูทดสอบ  ', researchSchool: '   ', researchNotes: 'วัตถุประสงค์ 1' });
assert(JSON.stringify(filled) === JSON.stringify({ author: 'ครูทดสอบ', additionalInfo: 'วัตถุประสงค์ 1' }),
  'only non-blank fields are exported, trimmed, under their export keys');

// The prompt is reviewed text pasted verbatim — pin it so it can't drift silently. Update this
// hash only for a deliberate, reviewed revision of src/lib/aiReportPrompt.ts.
assert(createHash('sha256').update(AI_REPORT_PROMPT, 'utf8').digest('hex') === 'a6508b6855b7ec206fda479c52c4729d08944b8523eacee6fde9dc5c1f0eb7bc',
  'AI report prompt is byte-identical to the reviewed version');
assert(reportFileName(new Date(2026, 0, 5)) === 'matrixmaster-report-2026-01-05.json', 'file name uses zero-padded local date');

console.log('='.repeat(50));
console.log('  ALL EXPORT REPORT QA TESTS PASSED!');
console.log('='.repeat(50));
