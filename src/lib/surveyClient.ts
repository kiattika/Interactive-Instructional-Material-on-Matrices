// Client-side calls for the anonymous satisfaction survey. Deliberately never imports
// classroomSync's getStudentId or reads the student's name: the request body is only the class
// code, the Likert answers and the optional comment (see surveyStore.ts on anonymity).
import type { LikertScore, SurveyAggregate, SurveyQuestionId } from './surveyStore';

export async function submitSurvey(
  classCode: string,
  answers: Record<SurveyQuestionId, LikertScore>,
  comment: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/survey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classCode, answers, comment })
    });
    const data = await res.json();
    return { ok: res.ok, error: data?.error };
  } catch {
    return { ok: false, error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ลองใหม่อีกครั้ง' };
  }
}

/** Aggregate results for one classroom, or all classrooms when classCode is null. */
export async function fetchSurveyResults(classCode: string | null): Promise<SurveyAggregate | null> {
  try {
    const query = classCode ? `?classCode=${encodeURIComponent(classCode)}` : '';
    const res = await fetch(`/api/survey/results${query}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
