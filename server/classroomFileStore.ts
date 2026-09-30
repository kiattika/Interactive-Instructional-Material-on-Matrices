// Persistence for the classroom sync feature — wraps the pure logic in src/lib/classroomStore.ts.
// Originally a JSON file on local disk (hence the filename); migrated to Firestore because
// Cloud Run's default writable filesystem is memory-backed, per-instance, and not shared across
// instances or persisted across restarts/redeploys/scaling — see FIRESTORE_MIGRATION_NOTES.md.
// The filename is kept as-is so server.ts's import path doesn't need to change.
//
// Schema:
//   classes/{classCode}                    — class-level fields (createdAt, active, note,
//                                               aiEnabled, includeInResearch — the last two are
//                                               absent on classes created before they existed,
//                                               which classroomStore.ts's readers treat as true)
//   classes/{classCode}/students/{studentId} — one doc per roster entry, so syncing one
//                                               student's progress is a single atomic document
//                                               write, never a read-modify-write of the whole
//                                               roster (that race is exactly what the old
//                                               file-lock queue existed to prevent).
import { FieldValue } from '@google-cloud/firestore';
import { getFirestore } from './firestoreClient';
import {
  StudentRecord,
  SyncedProgress,
  ClassSummary,
  ClassFlags,
  generateClassCode,
  isClassAiEnabled,
  isClassIncludedInResearch
} from '../src/lib/classroomStore';

// getFirestore() is called lazily inside each function below (never at module top level).
// ES module imports are evaluated before the importing module's own top-level code runs, so a
// module-level `const db = getFirestore()` here would construct the Firestore client — and
// lock in whatever FIRESTORE_EMULATOR_HOST/FIRESTORE_PROJECT_ID happened to be set at that
// moment — before server.ts's own top-level `dotenv.config()` call ever executes. Deferring the
// call into each function guarantees dotenv has already run by the time it matters.
const classesCollection = () => getFirestore().collection('classes');
const studentsCollection = (classCode: string) => classesCollection().doc(classCode).collection('students');

interface ClassDoc {
  classCode: string;
  createdAt: string;
  active: boolean;
  note?: string;
  aiEnabled?: boolean;
  includeInResearch?: boolean;
}

const FIRESTORE_ALREADY_EXISTS = 6; // google.rpc.Code.ALREADY_EXISTS

export async function createClass(note?: string): Promise<{ classCode: string }> {
  const trimmedNote = note?.trim() || undefined;
  // generateClassCode()'s 6-char alphabet gives ~1.3 billion combinations, so a collision is
  // astronomically unlikely — but rather than reading every existing class code up front (which
  // would reintroduce the whole-collection read this migration is trying to avoid),
  // `.create()` fails atomically if the code is already taken, and we just retry with a fresh
  // one on that rare event.
  for (let attempt = 0; attempt < 5; attempt++) {
    const classCode = generateClassCode();
    const doc: ClassDoc = {
      classCode,
      createdAt: new Date().toISOString(),
      active: true,
      aiEnabled: true,
      includeInResearch: true,
      ...(trimmedNote ? { note: trimmedNote } : {})
    };
    try {
      await classesCollection().doc(classCode).create(doc);
      return { classCode };
    } catch (err: any) {
      if (err?.code === FIRESTORE_ALREADY_EXISTS) continue;
      throw err;
    }
  }
  throw new Error('ไม่สามารถสร้างรหัสห้องเรียนที่ไม่ซ้ำได้ โปรดลองใหม่อีกครั้ง');
}

// Shared by every student- or AI-facing route that must treat a closed class exactly like a
// non-existent one — see classroomStore.ts's isClassActive doc comment (kept here as the same
// semantic contract, just re-checked directly against Firestore instead of a shared pure fn).
export async function isClassUsable(classCode: string): Promise<boolean> {
  const snap = await classesCollection().doc(classCode).get();
  if (!snap.exists) return false;
  return !!(snap.data() as ClassDoc).active;
}

// The AI routes' guard (server.ts's checkClassroomAuthorized): one read answers both "is this
// class usable at all" (same contract as isClassUsable) and "has the teacher turned AI off here".
export async function getAiAccess(classCode: string): Promise<'ok' | 'class_unusable' | 'ai_disabled'> {
  const snap = await classesCollection().doc(classCode).get();
  if (!snap.exists) return 'class_unusable';
  const data = snap.data() as ClassDoc;
  if (!data.active) return 'class_unusable';
  return isClassAiEnabled(data) ? 'ok' : 'ai_disabled';
}

export async function syncStudentProgress(
  classCode: string,
  studentId: string,
  displayName: string,
  progress: SyncedProgress
): Promise<{ ok: true; note?: string; aiEnabled: boolean } | { ok: false; error: 'class_not_found' }> {
  const classRef = classesCollection().doc(classCode);
  return getFirestore().runTransaction(async (tx) => {
    const classSnap = await tx.get(classRef);
    if (!classSnap.exists || !(classSnap.data() as ClassDoc).active) {
      return { ok: false, error: 'class_not_found' } as const;
    }
    const classData = classSnap.data() as ClassDoc;
    const record: StudentRecord = {
      studentId,
      displayName: displayName.trim() || 'นักเรียนใหม่',
      lastSyncedAt: new Date().toISOString(),
      progress
    };
    tx.set(classRef.collection('students').doc(studentId), record);
    // Returned alongside the ack so the client can cache the classroom's current note (see
    // classroomSync.ts's ClassroomLink.note) without a dedicated fetch of its own — this
    // transaction already has the class doc in hand, so it's free.
    // aiEnabled rides along for the same reason: the client hides AI entry points with it.
    return { ok: true, note: classData.note, aiEnabled: isClassAiEnabled(classData) } as const;
  });
}

export async function fetchRoster(classCode: string): Promise<StudentRecord[] | null> {
  const classSnap = await classesCollection().doc(classCode).get();
  if (!classSnap.exists) return null;
  const studentsSnap = await studentsCollection(classCode).get();
  return studentsSnap.docs
    .map((d) => d.data() as StudentRecord)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'th'));
}

async function setActive(
  classCode: string,
  active: boolean
): Promise<{ ok: true } | { ok: false; error: 'class_not_found' }> {
  const classRef = classesCollection().doc(classCode);
  return getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(classRef);
    if (!snap.exists) return { ok: false, error: 'class_not_found' } as const;
    tx.update(classRef, { active });
    return { ok: true } as const;
  });
}

export function closeClass(classCode: string): Promise<{ ok: true } | { ok: false; error: 'class_not_found' }> {
  return setActive(classCode, false);
}

export function reopenClass(classCode: string): Promise<{ ok: true } | { ok: false; error: 'class_not_found' }> {
  return setActive(classCode, true);
}

// count() aggregation queries avoid reading every student document just to size the roster —
// meaningful once a teacher has several classes each with their own roster.
export async function listClasses(): Promise<ClassSummary[]> {
  const classesSnap = await classesCollection().get();
  const summaries = await Promise.all(
    classesSnap.docs.map(async (doc) => {
      const data = doc.data() as ClassDoc;
      const countSnap = await studentsCollection(data.classCode).count().get();
      return {
        classCode: data.classCode,
        createdAt: data.createdAt,
        active: data.active,
        note: data.note,
        studentCount: countSnap.data().count,
        aiEnabled: isClassAiEnabled(data),
        includeInResearch: isClassIncludedInResearch(data)
      };
    })
  );
  return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function setClassFlags(
  classCode: string,
  flags: Partial<ClassFlags>
): Promise<{ ok: true } | { ok: false; error: 'class_not_found' }> {
  const classRef = classesCollection().doc(classCode);
  return getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(classRef);
    if (!snap.exists) return { ok: false, error: 'class_not_found' } as const;
    tx.update(classRef, flags);
    return { ok: true } as const;
  });
}

// Classes that count toward the research: existing AND includeInResearch. The all-classrooms
// survey aggregate keeps only responses from these — so a class the teacher excluded (whose
// responses stay stored; re-including restores them) or DELETED (see deleteClass) never leaks in.
export async function listResearchClassCodes(): Promise<Set<string>> {
  const snap = await classesCollection().get();
  return new Set(
    snap.docs.map((d) => d.data() as ClassDoc).filter(isClassIncludedInResearch).map((c) => c.classCode)
  );
}

// Permanent delete (classroomStore.ts's deleteClass contract): recursiveDelete removes the class
// doc and its whole students/ subcollection, not just marking it inactive like closeClass.
// Anonymous survey responses (surveys/{classCode}) and past live polls are left in place — they
// carry no student identity, and listResearchClassCodes above keeps them out of every aggregate.
export async function deleteClass(classCode: string): Promise<{ ok: true } | { ok: false; error: 'class_not_found' }> {
  const classRef = classesCollection().doc(classCode);
  if (!(await classRef.get()).exists) return { ok: false, error: 'class_not_found' };
  await getFirestore().recursiveDelete(classRef);
  return { ok: true };
}

export async function setClassNote(
  classCode: string,
  note: string
): Promise<{ ok: true } | { ok: false; error: 'class_not_found' }> {
  const classRef = classesCollection().doc(classCode);
  const trimmed = note.trim();
  return getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(classRef);
    if (!snap.exists) return { ok: false, error: 'class_not_found' } as const;
    tx.update(classRef, { note: trimmed ? trimmed : FieldValue.delete() });
    return { ok: true } as const;
  });
}

// Removal is a roster cleanup, not a ban (see classroomStore.ts's removeStudent doc comment) —
// deleting a Firestore doc that doesn't exist is itself already a no-op success, so this stays
// idempotent for free; only a genuinely missing CLASS is an error.
export async function removeStudent(
  classCode: string,
  studentId: string
): Promise<{ ok: true } | { ok: false; error: 'class_not_found' }> {
  const classSnap = await classesCollection().doc(classCode).get();
  if (!classSnap.exists) return { ok: false, error: 'class_not_found' };
  await studentsCollection(classCode).doc(studentId).delete();
  return { ok: true };
}
