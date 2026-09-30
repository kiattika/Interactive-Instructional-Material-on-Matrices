// Client-side glue for the no-login classroom sync feature. Everything here is best-effort:
// a student who never enters a class code, or whose sync fails (offline, server down), must
// keep using every feature exactly as before — localStorage stays the source of truth.
import type { StudentProgress, TeacherSettings } from './learningStore';
import type { SyncedProgress } from './classroomStore';

const STUDENT_ID_KEY = 'matrix_master_student_id_v1';
const CLASSROOM_LINK_KEY = 'matrix_master_classroom_link_v1';
const TEACHER_CLASS_CODE_KEY = 'matrix_master_teacher_classcode_v1';
// Which classroom Presentation mode (live polls) targets — chosen explicitly there and kept
// SEPARATE from TEACHER_CLASS_CODE_KEY ("last created"), so creating a classroom can never
// silently repoint an in-use projector at a different room.
const PRESENTATION_CLASS_CODE_KEY = 'matrix_master_presentation_classcode_v1';

export interface ClassroomLink {
  classCode: string;
  joinedAt: string;
  // The classroom's teacher-set note (e.g. "ม.5/9"), cached from the sync/join response so the
  // sidebar (AppLayout.tsx) can show it without a dedicated fetch of its own. Refreshed on every
  // successful sync (see syncProgressToClassroom below), so it stays reasonably current without
  // any extra network round-trip beyond what already happens on every progress save.
  note?: string;
  // The classroom's per-class AI switch (ClassRecord.aiEnabled), cached and refreshed the same
  // way as note. Missing (links saved before this existed, or before the first sync) = enabled.
  // UI-only: the server enforces the flag on every AI request regardless of this cache.
  aiEnabled?: boolean;
}

/**
 * Whether AI entry points (AI Tutor, AI practice problems) should be shown: ONLY when both the
 * teacher's global setting AND the student's current classroom allow it.
 */
export function isAiAvailable(settings: Pick<TeacherSettings, 'enableAiTutor'>): boolean {
  return settings.enableAiTutor && getClassroomLink()?.aiEnabled !== false;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `stu_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function getStudentId(): string {
  try {
    let id = localStorage.getItem(STUDENT_ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(STUDENT_ID_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

export function getClassroomLink(): ClassroomLink | null {
  try {
    const raw = localStorage.getItem(CLASSROOM_LINK_KEY);
    return raw ? (JSON.parse(raw) as ClassroomLink) : null;
  } catch {
    return null;
  }
}

export function setClassroomLink(classCode: string, note?: string, aiEnabled?: boolean): void {
  try {
    localStorage.setItem(
      CLASSROOM_LINK_KEY,
      JSON.stringify({ classCode, joinedAt: new Date().toISOString(), note, aiEnabled })
    );
  } catch {
    // Classroom sync is a convenience, not a requirement — ignore storage failures.
  }
}

// Patches just the note/aiEnabled on an already-joined classroom, without touching
// classCode/joinedAt — called after every successful sync (not just at join time) so a change
// the teacher makes AFTER a student already joined still reaches that student eventually.
function updateClassroomStatus(note: string | undefined, aiEnabled: boolean | undefined): void {
  try {
    const raw = localStorage.getItem(CLASSROOM_LINK_KEY);
    if (!raw) return;
    const link = JSON.parse(raw) as ClassroomLink;
    localStorage.setItem(CLASSROOM_LINK_KEY, JSON.stringify({ ...link, note, aiEnabled }));
  } catch {
    // ignore
  }
}

export function clearClassroomLink(): void {
  try {
    localStorage.removeItem(CLASSROOM_LINK_KEY);
  } catch {
    // ignore
  }
}

export function getTeacherClassCode(): string | null {
  try {
    return localStorage.getItem(TEACHER_CLASS_CODE_KEY);
  } catch {
    return null;
  }
}

export function setTeacherClassCode(classCode: string): void {
  try {
    localStorage.setItem(TEACHER_CLASS_CODE_KEY, classCode);
  } catch {
    // ignore
  }
}

export function clearTeacherClassCode(): void {
  try {
    localStorage.removeItem(TEACHER_CLASS_CODE_KEY);
  } catch {
    // ignore
  }
}

export function getPresentationClassCode(): string | null {
  try {
    return localStorage.getItem(PRESENTATION_CLASS_CODE_KEY);
  } catch {
    return null;
  }
}

export function setPresentationClassCode(classCode: string | null): void {
  try {
    if (classCode) localStorage.setItem(PRESENTATION_CLASS_CODE_KEY, classCode);
    else localStorage.removeItem(PRESENTATION_CLASS_CODE_KEY);
  } catch {
    // ignore
  }
}

/**
 * The classroom Presentation mode should target, given the live class list: the remembered
 * choice if it's still an ACTIVE class; otherwise the only active class if there is exactly one
 * (unambiguous); otherwise null — the teacher must pick. Never falls back to "last created".
 */
export function resolvePresentationClassCode(
  classes: { classCode: string; active: boolean }[],
  remembered: string | null
): string | null {
  const active = classes.filter((c) => c.active);
  if (remembered && active.some((c) => c.classCode === remembered)) return remembered;
  return active.length === 1 ? active[0].classCode : null;
}

function toSyncedProgress(progress: StudentProgress): SyncedProgress {
  return {
    xp: progress.xp,
    completedLessons: progress.completedLessons,
    preTestCompleted: progress.preTestCompleted,
    preTestScore: progress.preTestScore,
    postTestCompleted: progress.postTestCompleted,
    postTestScore: progress.postTestScore,
    topicMastery: progress.topicMastery,
    earnedBadges: progress.earnedBadges,
    lessonCheckScores: progress.lessonCheckScores
  };
}

/**
 * Best-effort push to the teacher's classroom roster. No-ops when the student never
 * joined a class, and never throws — a failed sync must not block local learning.
 */
export async function syncProgressToClassroom(progress: StudentProgress): Promise<void> {
  const link = getClassroomLink();
  if (!link) return;

  try {
    const res = await fetch(`/api/classroom/${encodeURIComponent(link.classCode)}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: getStudentId(),
        displayName: progress.studentName,
        progress: toSyncedProgress(progress)
      })
    });
    if (res.status === 404) {
      // Class code no longer exists on the backend (e.g. server data was reset) — stop retrying.
      clearClassroomLink();
      return;
    }
    if (res.ok) {
      const data = await res.json().catch(() => null);
      updateClassroomStatus(data?.note, data?.aiEnabled);
    }
  } catch {
    // Offline or server unreachable — local progress is unaffected.
  }
}

/** Validates a class code by attempting to join it. Returns true if the code exists. */
export async function joinClassroom(classCode: string, progress: StudentProgress): Promise<boolean> {
  try {
    const res = await fetch(`/api/classroom/${encodeURIComponent(classCode)}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: getStudentId(),
        displayName: progress.studentName,
        progress: toSyncedProgress(progress)
      })
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      setClassroomLink(classCode, data?.note, data?.aiEnabled);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Points this device's classroom identity at an EXISTING studentId instead of the one
// getStudentId() would otherwise have generated/remembered — used by the "recover my progress
// on a new device" flow (see ClassroomJoinModal.tsx) when a student confirms an existing roster
// entry (found via findStudentsByDisplayName in classroomStore.ts) is actually them. Every
// subsequent sync then updates that same roster entry instead of creating a separate one.
export function adoptStudentId(existingStudentId: string): void {
  try {
    localStorage.setItem(STUDENT_ID_KEY, existingStudentId);
  } catch {
    // Best-effort — if this fails, the join still proceeds under the freshly generated id.
  }
}
