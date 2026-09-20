export type Matrix = number[][];
export type Vector = number[];

export type SystemDimension = '2x2' | '3x3' | '4x4';

export type SolutionType = 'unique' | 'no_solution' | 'infinite_solutions';

export interface LinearSystem {
  dimension: SystemDimension;
  A: Matrix;
  B: Vector;
  variables: string[];
}

export interface VerificationResult {
  equationText: string;
  substitutedText: string;
  lhsValue: number;
  rhsValue: number;
  isValid: boolean;
}

export interface SolutionSummary {
  type: SolutionType;
  solution?: Vector; // [x, y] or [x, y, z]
  determinant: number;
  explanation: string;
  verifications?: VerificationResult[];
}

export interface StepDetail {
  stepNumber: number;
  title: string;
  description: string;
  matrixState?: Matrix;
  augmentedState?: Matrix; // [A | B]
  vectorState?: Vector;
  highlightRows?: number[];
  highlightCols?: number[];
  formulaText?: string;
  isExpanded?: boolean;
}

export interface CramerStep {
  matrixD: Matrix;
  detD: number;
  matrixDx: Matrix;
  detDx: number;
  matrixDy: Matrix;
  detDy: number;
  matrixDz?: Matrix;
  detDz?: number;
  x?: number;
  y?: number;
  z?: number;
}

export interface InverseStep {
  detA: number;
  hasInverse: boolean;
  adjugateA?: Matrix;
  inverseA?: Matrix;
  solutionX?: Vector;
  steps: StepDetail[];
}

export interface RowOperation {
  type: 'swap' | 'multiply' | 'add';
  row1: number; // 0-indexed
  row2?: number; // 0-indexed
  k?: number; // multiplier factor
  description: string;
}

export interface GaussStep {
  stepIndex: number;
  beforeMatrix?: (number | string)[][];
  augmentedMatrix: (number | string)[][]; // after matrix [A | B]
  operationPerformed?: string;
  explanation: string;
  highlightRows?: number[];
}

export interface ExerciseQuestion {
  id: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  type: 'representation' | 'determinant' | 'inverse' | 'cramer' | 'gauss_step' | 'solve_system' | 'solution_type';
  title: string;
  instruction: string;
  system: LinearSystem;
  options?: string[];
  correctAnswer: string | number | number[] | number[][];
  explanation: string;
  hints: string[];
}

export interface QuizAttempt {
  exerciseId: string;
  selectedOption?: string;
  numericAnswer?: number;
  isCorrect: boolean;
  timestamp: string;
}

// Real-world Engineering / ICT applied problems (Polya "Problem Encounter" stage)
export type ApplicationField = 'engineering' | 'ict';

export interface AppliedProblem {
  id: string;
  field: ApplicationField;
  fieldLabel: string; // e.g. "วิศวกรรมไฟฟ้า", "ไอซีที: การเข้ารหัส"
  difficulty: 'Easy' | 'Medium' | 'Hard';
  title: string;
  scenario: string; // real-world narrative (open-ended problem statement)
  guidingQuestions: string[]; // Polya Step 1-2 style prompts, never the final numeric answer
  system: LinearSystem;
  variableMeaning: string[]; // what each variable physically represents, aligned to system.variables
  recommendedMethod: 'inverse' | 'cramer' | 'gauss';
  methodRationale: string; // why this method fits the problem (Polya Step 2)
  interpretationNote: string; // how to read the answer back into context (Polya Step 4)
}
