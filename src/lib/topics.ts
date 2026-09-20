// Shared topic vocabulary for StudentProgress.topicMastery, the diagnostic test,
// and AI-generated remediation problems — kept in one place so the three never drift apart.

export type TopicKey =
  | 'matrixNotation'
  | 'determinant'
  | 'inverseMethod'
  | 'cramerRule'
  | 'gaussianElimination'
  | 'solutionTypes';

export const TOPIC_KEYS: TopicKey[] = [
  'matrixNotation',
  'determinant',
  'inverseMethod',
  'cramerRule',
  'gaussianElimination',
  'solutionTypes'
];

export const TOPIC_LABELS: Record<TopicKey, string> = {
  matrixNotation: 'การเขียนระบบสมการในรูป AX = B',
  determinant: 'การหาค่า Determinant',
  inverseMethod: 'การแก้ระบบสมการด้วย Inverse Matrix',
  cramerRule: "กฎของคราเมอร์ (Cramer's Rule)",
  gaussianElimination: 'Gaussian Elimination และ Row Operations (ERO)',
  solutionTypes: 'การจำแนกประเภทคำตอบของระบบสมการ'
};

// Curriculum scope guard (see PHASE1_UPDATE_NOTES.md): Cramer's Rule and the Inverse
// Matrix method are only taught up to 3x3; only Gaussian Elimination extends to 4x4.
export const TOPIC_DIMENSIONS: Record<TopicKey, Array<'2x2' | '3x3' | '4x4'>> = {
  matrixNotation: ['2x2', '3x3'],
  determinant: ['2x2', '3x3'],
  inverseMethod: ['2x2', '3x3'],
  cramerRule: ['2x2', '3x3'],
  gaussianElimination: ['3x3', '4x4'],
  solutionTypes: ['2x2', '3x3']
};

export function isTopicKey(value: string): value is TopicKey {
  return (TOPIC_KEYS as string[]).includes(value);
}
