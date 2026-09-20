// Node-only persistence for the classroom sync feature: wraps the pure logic in
// src/lib/classroomStore.ts with a JSON file on disk. No external database needed —
// classroom sizes here are a handful of students, not a scale where JSON I/O matters.
import { promises as fs } from 'fs';
import path from 'path';
import {
  ClassroomDB,
  StudentRecord,
  SyncedProgress,
  ClassSummary,
  createEmptyDB,
  createClass as createClassPure,
  upsertStudentProgress as upsertPure,
  getRoster as getRosterPure,
  isClassActive,
  closeClass as closeClassPure,
  reopenClass as reopenClassPure,
  listClasses as listClassesPure
} from '../src/lib/classroomStore';

const DB_PATH = path.join(process.cwd(), 'data', 'classroom.json');

// All reads/writes go through this queue so two concurrent requests (e.g. two students
// syncing at once) never interleave a read-modify-write and silently drop one's update.
let writeQueue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn, fn);
  writeQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function readDB(): Promise<ClassroomDB> {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(raw) as ClassroomDB;
  } catch {
    return createEmptyDB();
  }
}

async function writeDB(db: ClassroomDB): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  const tmpPath = `${DB_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
  await fs.rename(tmpPath, DB_PATH);
}

export function createClass(): Promise<{ classCode: string }> {
  return withLock(async () => {
    const db = await readDB();
    const { db: nextDB, classCode } = createClassPure(db);
    await writeDB(nextDB);
    return { classCode };
  });
}

export function syncStudentProgress(
  classCode: string,
  studentId: string,
  displayName: string,
  progress: SyncedProgress
): Promise<{ ok: true } | { ok: false; error: 'class_not_found' }> {
  return withLock(async () => {
    const db = await readDB();
    const result = upsertPure(db, classCode, studentId, displayName, progress);
    if (!result.ok) return result;
    await writeDB(result.db);
    return { ok: true };
  });
}

export async function fetchRoster(classCode: string): Promise<StudentRecord[] | null> {
  const db = await readDB();
  return getRosterPure(db, classCode);
}

// Shared by every student- or AI-facing route (sync is covered inside syncStudentProgress
// itself via the updated pure upsertStudentProgress) that must treat a closed class exactly
// like a non-existent one — see classroomStore.ts's isClassActive doc comment.
export async function isClassUsable(classCode: string): Promise<boolean> {
  const db = await readDB();
  return isClassActive(db, classCode);
}

export function closeClass(classCode: string): Promise<{ ok: true } | { ok: false; error: 'class_not_found' }> {
  return withLock(async () => {
    const db = await readDB();
    const result = closeClassPure(db, classCode);
    if (!result.ok) return result;
    await writeDB(result.db);
    return { ok: true };
  });
}

export function reopenClass(classCode: string): Promise<{ ok: true } | { ok: false; error: 'class_not_found' }> {
  return withLock(async () => {
    const db = await readDB();
    const result = reopenClassPure(db, classCode);
    if (!result.ok) return result;
    await writeDB(result.db);
    return { ok: true };
  });
}

export async function listClasses(): Promise<ClassSummary[]> {
  const db = await readDB();
  return listClassesPure(db);
}
