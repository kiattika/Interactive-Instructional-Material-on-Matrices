// Client-side glue for the no-login classroom sync feature. Everything here is best-effort:
// a student who never enters a class code, or whose sync fails (offline, server down), must
// keep using every feature exactly as before — localStorage stays the source of truth.
import type { StudentProgress } from './learningStore';
import type { SyncedProgress } from './classroomStore';

const STUDENT_ID_KEY = 'matrix_master_student_id_v1';
const CLASSROOM_LINK_KEY = 'matrix_master_classroom_link_v1';
const ONBOARDING_SEEN_KEY = 'matrix_master_onboarding_seen_v1';
const TEACHER_CLASS_CODE_KEY = 'matrix_master_teacher_classcode_v1';

export interface ClassroomLink {
  classCode: string;
  joinedAt: string;
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

export function setClassroomLink(classCode: string): void {
  try {
    localStorage.setItem(
      CLASSROOM_LINK_KEY,
      JSON.stringify({ classCode, joinedAt: new Date().toISOString() })
    );
  } catch {
    // Classroom sync is a convenience, not a requirement — ignore storage failures.
  }
}

export function clearClassroomLink(): void {
  try {
    localStorage.removeItem(CLASSROOM_LINK_KEY);
  } catch {
    // ignore
  }
}

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === '1';
  } catch {
    return true; // fail closed: never re-nag if storage is unavailable
  }
}

export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
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

function toSyncedProgress(progress: StudentProgress): SyncedProgress {
  return {
    xp: progress.xp,
    completedLessons: progress.completedLessons,
    preTestCompleted: progress.preTestCompleted,
    preTestScore: progress.preTestScore,
    postTestCompleted: progress.postTestCompleted,
    postTestScore: progress.postTestScore,
    topicMastery: progress.topicMastery,
    earnedBadges: progress.earnedBadges
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
      setClassroomLink(classCode);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
