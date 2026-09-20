// Pure, platform-agnostic logic for the no-login classroom sync feature (Phase 2).
// No filesystem or network access here on purpose — that lives in server/classroomFileStore.ts
// — so this module can be unit-tested directly (see src/tests/classroomStore.test.ts) and
// reused unchanged on both the client (type-checking payloads) and the server (persistence).
import type { StudentProgress } from './learningStore';

export type SyncedProgress = Pick<
  StudentProgress,
  | 'xp'
  | 'completedLessons'
  | 'preTestCompleted'
  | 'preTestScore'
  | 'postTestCompleted'
  | 'postTestScore'
  | 'topicMastery'
  | 'earnedBadges'
>;

export interface StudentRecord {
  studentId: string;
  displayName: string;
  lastSyncedAt: string; // ISO timestamp
  progress: SyncedProgress;
}

export interface ClassRecord {
  classCode: string;
  createdAt: string;
  active: boolean;
  students: Record<string, StudentRecord>; // keyed by studentId
}

export interface ClassroomDB {
  classes: Record<string, ClassRecord>;
}

export function createEmptyDB(): ClassroomDB {
  return { classes: {} };
}

// Excludes visually ambiguous characters (0/O, 1/I) since students copy this by hand off a board.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateClassCode(existingCodes: Iterable<string> = []): string {
  const taken = existingCodes instanceof Set ? existingCodes : new Set(existingCodes);
  let code = '';
  do {
    code = Array.from(
      { length: CODE_LENGTH },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    ).join('');
  } while (taken.has(code));
  return code;
}

export function createClass(db: ClassroomDB): { db: ClassroomDB; classCode: string } {
  const classCode = generateClassCode(Object.keys(db.classes));
  const record: ClassRecord = {
    classCode,
    createdAt: new Date().toISOString(),
    active: true,
    students: {}
  };
  return {
    db: { classes: { ...db.classes, [classCode]: record } },
    classCode
  };
}

export function classExists(db: ClassroomDB, classCode: string): boolean {
  return Object.prototype.hasOwnProperty.call(db.classes, classCode);
}

// The single check every write/read path that "belongs" to students or the AI endpoints must
// use: a class that was closed by the teacher must behave exactly like class_not_found
// everywhere, not just block new joins. Teacher-only paths (roster, close/reopen, listing)
// intentionally use classExists directly instead, since a teacher must still be able to see
// and reopen a class they closed.
export function isClassActive(db: ClassroomDB, classCode: string): boolean {
  const cls = db.classes[classCode];
  return !!cls && cls.active;
}

export type ClassMutationResult = { ok: true; db: ClassroomDB } | { ok: false; error: 'class_not_found' };
export type UpsertResult = ClassMutationResult;

export function upsertStudentProgress(
  db: ClassroomDB,
  classCode: string,
  studentId: string,
  displayName: string,
  progress: SyncedProgress
): UpsertResult {
  const cls = db.classes[classCode];
  if (!cls || !cls.active) return { ok: false, error: 'class_not_found' };

  const record: StudentRecord = {
    studentId,
    displayName: displayName.trim() || 'นักเรียนใหม่',
    lastSyncedAt: new Date().toISOString(),
    progress
  };

  const updatedClass: ClassRecord = {
    ...cls,
    students: { ...cls.students, [studentId]: record }
  };

  return { ok: true, db: { classes: { ...db.classes, [classCode]: updatedClass } } };
}

export function getRoster(db: ClassroomDB, classCode: string): StudentRecord[] | null {
  const cls = db.classes[classCode];
  if (!cls) return null;
  return Object.values(cls.students).sort((a, b) => a.displayName.localeCompare(b.displayName, 'th'));
}

function setActive(db: ClassroomDB, classCode: string, active: boolean): ClassMutationResult {
  const cls = db.classes[classCode];
  if (!cls) return { ok: false, error: 'class_not_found' };
  const updatedClass: ClassRecord = { ...cls, active };
  return { ok: true, db: { classes: { ...db.classes, [classCode]: updatedClass } } };
}

export function closeClass(db: ClassroomDB, classCode: string): ClassMutationResult {
  return setActive(db, classCode, false);
}

export function reopenClass(db: ClassroomDB, classCode: string): ClassMutationResult {
  return setActive(db, classCode, true);
}

export interface ClassSummary {
  classCode: string;
  createdAt: string;
  active: boolean;
  studentCount: number;
}

export function listClasses(db: ClassroomDB): ClassSummary[] {
  return Object.values(db.classes)
    .map((cls) => ({
      classCode: cls.classCode,
      createdAt: cls.createdAt,
      active: cls.active,
      studentCount: Object.keys(cls.students).length
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
