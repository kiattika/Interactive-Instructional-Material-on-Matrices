// "Export Report Data" for TeacherAnalytics: packs figures the app already computes into one JSON
// file for an external research report. Nothing is recomputed here — E1/E2/E.I. come from
// computeResearchEfficiencyStats() and the survey figures are the server's
// aggregateSurveyResponses() output, passed through unchanged. Classrooms marked
// includeInResearch=false stay listed (roster counts) but contribute to NO statistic. buildReportData() is pure (unit-tested in
// src/tests/reportExport.test.ts); downloadJsonFile() is the only browser-dependent part.
import { ClassSummary, StudentRecord, isClassIncludedInResearch } from './classroomStore';
import { computeResearchEfficiencyStats, EfficiencyStats } from './efficiencyStats';
import { SURVEY_SECTIONS, SurveyAggregate } from './surveyStore';
import type { TeacherSettings } from './learningStore';
import { AI_REPORT_PROMPT } from './aiReportPrompt';

export const REPORT_SCHEMA_VERSION = 3;

// Research metadata (Teacher Settings → ข้อมูลรายงานการวิจัย). One list drives both the settings
// form and the export, so a field can't be added to one and forgotten in the other.
export const RESEARCH_METADATA_FIELDS = [
  { settingsKey: 'researchTitle', exportKey: 'title', label: 'ชื่อเรื่องงานวิจัย' },
  { settingsKey: 'researchAuthor', exportKey: 'author', label: 'ชื่อผู้จัดทำ' },
  { settingsKey: 'researchPosition', exportKey: 'position', label: 'ตำแหน่ง/วิทยฐานะ' },
  { settingsKey: 'researchSchool', exportKey: 'school', label: 'โรงเรียน' },
  { settingsKey: 'researchSubjectLevel', exportKey: 'subjectLevel', label: 'รายวิชา/ระดับชั้น' },
  { settingsKey: 'researchAcademicYear', exportKey: 'academicYearTerm', label: 'ปีการศึกษา/ภาคเรียน' },
  { settingsKey: 'researchNotes', exportKey: 'additionalInfo', label: 'ข้อมูลเพิ่มเติม (เช่น วัตถุประสงค์การวิจัย)' }
] as const;

export type ResearchMetadata = Partial<Record<(typeof RESEARCH_METADATA_FIELDS)[number]['exportKey'], string>>;

/** Only the fields the teacher actually filled in (trimmed) — empty ones are left out entirely. */
export function buildResearchMetadata(settings: TeacherSettings): ResearchMetadata {
  const metadata: ResearchMetadata = {};
  for (const field of RESEARCH_METADATA_FIELDS) {
    const value = (settings[field.settingsKey] || '').trim();
    if (value) metadata[field.exportKey] = value;
  }
  return metadata;
}

export interface ClassroomReport {
  classCode: string;
  note: string | null;
  active: boolean;
  createdAt: string;
  studentCount: number;
  includeInResearch: boolean;
  // null for a classroom excluded from the research — never computed, not merely hidden.
  efficiency: EfficiencyStats | null;
  survey: SurveyAggregate | null;
}

export interface ReportData {
  schemaVersion: number;
  generatedAt: string;
  metadata: ResearchMetadata;
  // Verbatim AI_REPORT_PROMPT, so the file can be handed straight to an AI assistant.
  aiReportPrompt: string;
  // Describes units so the numbers can't be misread once they leave the app.
  notes: string[];
  surveyQuestions: { id: string; section: string; text: string }[];
  totals: {
    classroomCount: number;
    activeClassroomCount: number;
    inactiveClassroomCount: number;
    researchClassroomCount: number;
    excludedFromResearchClassroomCount: number;
    studentCount: number; // students in research classrooms only
    excludedFromResearchStudentCount: number;
  };
  aggregate: {
    efficiency: EfficiencyStats;
    survey: SurveyAggregate;
  };
  classrooms: ClassroomReport[];
}

export interface ReportInput {
  classes: ClassSummary[];
  rostersByClass: Record<string, StudentRecord[]>;
  surveyAll: SurveyAggregate; // must already exclude non-research classrooms (the server does)
  surveyByClass: Record<string, SurveyAggregate>; // research classrooms only; others are ignored
  metadata: ResearchMetadata;
  generatedAt: Date;
}

export function buildReportData({ classes, rostersByClass, surveyAll, surveyByClass, metadata, generatedAt }: ReportInput): ReportData {
  const classrooms = classes.map((cls): ClassroomReport => {
    const roster = rostersByClass[cls.classCode] || [];
    const included = isClassIncludedInResearch(cls);
    return {
      classCode: cls.classCode,
      note: cls.note || null,
      active: cls.active,
      createdAt: cls.createdAt,
      studentCount: roster.length,
      includeInResearch: included,
      efficiency: included ? computeResearchEfficiencyStats([toEfficiencyClassroom(cls, roster)]) : null,
      survey: included ? surveyByClass[cls.classCode] ?? null : null
    };
  });
  const activeCount = classes.filter((c) => c.active).length;
  const researchCount = classrooms.filter((c) => c.includeInResearch).length;
  const researchStudentCount = classrooms.filter((c) => c.includeInResearch).reduce((a, c) => a + c.studentCount, 0);
  const allStudentCount = classrooms.reduce((a, c) => a + c.studentCount, 0);

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    metadata,
    aiReportPrompt: AI_REPORT_PROMPT,
    notes: [
      'E1, E2 and efficiency meanPre/meanPost are percentages (0-100), unrounded.',
      'E.I. (ei.value) is a fraction (0-1), unrounded; null means not enough data.',
      'Each efficiency figure has its own n: E1 = students with >=1 scored lesson, E2 = Post-Test completers, E.I. = students who completed both tests.',
      'Survey is anonymous: per-question mean and sample SD (SD null when n < 2) on a 1-5 Likert scale.',
      'Classrooms with includeInResearch=false are listed for roster counts only: they are excluded from every aggregate and totals.studentCount, and their own efficiency/survey are null.'
    ],
    surveyQuestions: SURVEY_SECTIONS.flatMap((section) =>
      section.questions.map((q) => ({ id: q.id, section: section.title, text: q.text }))
    ),
    totals: {
      classroomCount: classes.length,
      activeClassroomCount: activeCount,
      inactiveClassroomCount: classes.length - activeCount,
      researchClassroomCount: researchCount,
      excludedFromResearchClassroomCount: classes.length - researchCount,
      studentCount: researchStudentCount,
      excludedFromResearchStudentCount: allStudentCount - researchStudentCount
    },
    aggregate: {
      efficiency: computeResearchEfficiencyStats(
        classes.map((cls) => toEfficiencyClassroom(cls, rostersByClass[cls.classCode] || []))
      ),
      survey: surveyAll
    },
    classrooms
  };
}

function toEfficiencyClassroom(cls: ClassSummary, roster: StudentRecord[]) {
  return { includeInResearch: cls.includeInResearch, students: roster.map((s) => s.progress) };
}

/** e.g. matrixmaster-report-2026-09-30.json (local calendar date). */
export function reportFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `matrixmaster-report-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

export function downloadJsonFile(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
