// Persistence for the anonymous satisfaction survey — thin Firestore wrapper around the pure logic
// in src/lib/surveyStore.ts, following classroomFileStore.ts / livePollFileStore.ts. (Named
// *FileStore.ts only to match its siblings; unlike them it never had a JSON-file phase.)
//
// Schema (NEW, additive collection — nothing under classes/ or livePolls/ is read-modified-written
// or reshaped by this module):
//   surveys/{classCode}/responses/{autoId}   — one doc per submitted response; autoId is a
//                                               Firestore-generated id, unrelated to any student
//
// Anonymity: documents are written exactly as validateSurveySubmission() rebuilt them — classCode,
// answers, optional comment, day-granularity submittedAt — with no identity field of any kind.
import { getFirestore } from './firestoreClient';
import type { SurveyResponse } from '../src/lib/surveyStore';

// Lazy, like the sibling stores — getFirestore() must not run at import time (before dotenv).
const surveysCollection = () => getFirestore().collection('surveys');
const RESPONSES_SUBCOLLECTION = 'responses';

export async function submitSurveyResponse(response: SurveyResponse): Promise<void> {
  // .add() = Firestore auto-generated document id.
  await surveysCollection().doc(response.classCode).collection(RESPONSES_SUBCOLLECTION).add(response);
}

/** Responses for one classroom, or across every classroom when classCode is omitted. */
export async function fetchSurveyResponses(classCode?: string): Promise<SurveyResponse[]> {
  if (classCode) {
    const snap = await surveysCollection().doc(classCode).collection(RESPONSES_SUBCOLLECTION).get();
    return snap.docs.map((d) => d.data() as SurveyResponse);
  }
  // Collection-group query over every surveys/{classCode}/responses subcollection. Filtered to the
  // surveys/ root explicitly so a future, unrelated "responses" subcollection elsewhere could never
  // leak into these averages.
  const snap = await getFirestore().collectionGroup(RESPONSES_SUBCOLLECTION).get();
  return snap.docs
    .filter((d) => d.ref.parent.parent?.parent.id === 'surveys')
    .map((d) => d.data() as SurveyResponse);
}
