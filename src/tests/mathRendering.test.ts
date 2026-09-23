import katex from 'katex';
import { preprocessMathText, formatLatexFraction } from '../components/math/MathComponents';
import { CURRICULUM_LESSONS } from '../lib/learningStore';
import { ENGINEERING_ICT_PROBLEMS } from '../lib/engineeringProblems';
import { generateExercises, getGaussSteps } from '../lib/matrixEngine';
import { PRE_TEST_QUESTIONS, POST_TEST_QUESTIONS } from '../lib/diagnosticQuestions';
import { INVERSE_CONCEPT_TEXT, CRAMER_CONCEPT_TEXT } from '../pages/MatrixLab';
import { CIRCUIT_PROBLEM_TEXT, SYSTEM_HEADING_TEXT } from '../pages/HigherOrderLab';
import { LinearSystem } from '../types';

let failed = false;
function fail(message: string) {
  console.error(`❌ FAIL: ${message}`);
  failed = true;
}

/**
 * Runs the exact same text -> parts splitting used by RenderTextWithMath
 * (src/components/math/MathComponents.tsx), so this test exercises the real
 * rendering pipeline end-to-end rather than re-implementing it differently.
 */
function splitParts(processedText: string) {
  const regex = /\$\$([\s\S]*?)\$\$|\$([\s\S]*?)\$/g;
  const result: { isMath: boolean; content: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(processedText)) !== null) {
    if (match.index > lastIndex) {
      result.push({ isMath: false, content: processedText.substring(lastIndex, match.index) });
    }
    if (match[1] !== undefined) result.push({ isMath: true, content: match[1].trim() });
    else if (match[2] !== undefined) result.push({ isMath: true, content: match[2].trim() });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < processedText.length) {
    result.push({ isMath: false, content: processedText.substring(lastIndex) });
  }
  return result;
}

// A plain-text part containing a raw LaTeX command is the signature of a
// $$...$$ / $...$ block having been torn apart (see PHASE1_UPDATE_NOTES.md,
// "double-wrap" bug: \left[\begin{array}...\end{array}\right] used to split
// into a dangling \left[, raw \begin{array}... text, and a dangling \right]).
const RAW_LATEX_LEAK = /\\(begin|end|left|right|frac|times|implies|det|mid|sum|cdot)\b/;

function checkString(label: string, raw: string | undefined | null) {
  if (!raw) return;
  const processed = preprocessMathText(raw);
  const parts = splitParts(processed);

  for (const p of parts) {
    if (!p.isMath && RAW_LATEX_LEAK.test(p.content)) {
      fail(`[${label}] plain-text segment leaked raw LaTeX (math block was split apart): ${JSON.stringify(p.content)}`);
    }
  }

  for (const p of parts) {
    if (p.isMath) {
      const html = katex.renderToString(p.content, {
        displayMode: true,
        throwOnError: false,
        macros: { '\\arraystretch': '1.5' },
      });
      if (html.includes('katex-error')) {
        fail(`[${label}] KaTeX failed to parse: ${JSON.stringify(p.content)}`);
      }
    }
  }
}

console.log('='.repeat(50));
console.log('  QA: MATH RENDERING PIPELINE (ALL APP CONTENT)');
console.log('='.repeat(50));

// 1. Every lesson's explanations and check-questions
let lessonStrings = 0;
for (const lesson of CURRICULUM_LESSONS) {
  for (const c of lesson.content) {
    checkString(`lesson${lesson.id}-content`, c.explanationText);
    lessonStrings++;
  }
  for (const q of lesson.checkQuestions) {
    checkString(`lesson${lesson.id}-checkq`, q.question);
    checkString(`lesson${lesson.id}-checkq-explanation`, q.explanation);
    for (const opt of q.options) checkString(`lesson${lesson.id}-checkq-option`, opt);
    // Per-option "why wrong" feedback shown after a first wrong pick (null at the answer).
    const whys = q.whyWrong.filter((w): w is string => w !== null);
    for (const w of whys) checkString(`lesson${lesson.id}-checkq-whyWrong`, w);
    lessonStrings += 2 + q.options.length + whys.length;
  }
}
console.log(`✓ Swept ${lessonStrings} lesson strings across ${CURRICULUM_LESSONS.length} lessons`);

// 2. Every engineering/ICT applied problem
let appliedStrings = 0;
for (const p of ENGINEERING_ICT_PROBLEMS) {
  checkString(`applied-${p.id}-scenario`, p.scenario);
  checkString(`applied-${p.id}-methodRationale`, p.methodRationale);
  checkString(`applied-${p.id}-interpretationNote`, p.interpretationNote);
  for (const gq of p.guidingQuestions) checkString(`applied-${p.id}-guidingQ`, gq);
  appliedStrings += 3 + p.guidingQuestions.length;
}
console.log(`✓ Swept ${appliedStrings} strings across ${ENGINEERING_ICT_PROBLEMS.length} applied problems`);

// 3. Every generated MCQ exercise
let mcqStrings = 0;
for (const q of generateExercises()) {
  checkString(`mcq-${q.id}-instruction`, q.instruction);
  checkString(`mcq-${q.id}-explanation`, q.explanation);
  for (const opt of q.options || []) checkString(`mcq-${q.id}-option`, opt);
  for (const h of q.hints) checkString(`mcq-${q.id}-hint`, h);
  const feedback = Object.values(q.optionFeedback || {});
  for (const f of feedback) checkString(`mcq-${q.id}-optionFeedback`, f);
  mcqStrings += 2 + (q.options?.length || 0) + q.hints.length + feedback.length;
}
console.log(`✓ Swept ${mcqStrings} MCQ exercise strings`);

// 4. Pre-Test and Post-Test questions (src/lib/diagnosticQuestions.ts) — two separate, parallel
// 10-question banks (see the Phase 2 split — Post-Test used to just re-render the same
// DIAGNOSTIC_QUESTIONS array as Pre-Test under a different label).
let diagnosticStrings = 0;
for (const [bankLabel, bank] of [
  ['pre-test', PRE_TEST_QUESTIONS],
  ['post-test', POST_TEST_QUESTIONS]
] as const) {
  for (const q of bank) {
    checkString(`${bankLabel}-${q.id}-text`, q.text);
    checkString(`${bankLabel}-${q.id}-explanation`, q.explanation);
    for (const opt of q.options) checkString(`${bankLabel}-${q.id}-option`, opt);
    diagnosticStrings += 2 + q.options.length;
  }
}
console.log(`✓ Swept ${diagnosticStrings} pre-test + post-test strings (20 questions total)`);

// 5. Hardcoded inline JSX strings in page components — these are NOT data-driven like the
// sources above, so nothing else catches them. A "$AX = B$" left unwrapped in MatrixLab.tsx
// or HigherOrderLab.tsx (see the Phase 2 bug report) would render as raw text in the app but
// silently pass every check above, since none of them touch page components at all.
let inlinePageStrings = 0;
for (const [label, text] of [
  ['MatrixLab-inverseConcept', INVERSE_CONCEPT_TEXT],
  ['MatrixLab-cramerConcept', CRAMER_CONCEPT_TEXT],
  ['HigherOrderLab-circuitProblem', CIRCUIT_PROBLEM_TEXT],
  ['HigherOrderLab-systemHeading', SYSTEM_HEADING_TEXT]
] as const) {
  checkString(label, text);
  inlinePageStrings++;
}
console.log(`✓ Swept ${inlinePageStrings} hardcoded inline page-component strings`);

// 6. Gaussian-elimination step operation labels (getGaussSteps()'s operationPerformed) — these
// are raw LaTeX fragments meant for MathView/AugmentedMatrixDisplay directly (see
// GaussStepDisplay.tsx, shared by MatrixLab.tsx and HigherOrderLab.tsx), NOT $...$-delimited
// prose, so they're checked by rendering them straight through KaTeX rather than through
// checkString's preprocessMathText/splitParts path. This is the regression test for the "raw
// LaTeX shows as literal text" bug: a string like "R_{1} \\rightarrow \\frac{1}{2} R_{1}" that
// somehow stopped being valid LaTeX would be caught here.
function checkRawLatex(label: string, latex: string | undefined) {
  if (!latex) return;
  // strict: false — Step 1's operationPerformed is descriptive Thai prose, not LaTeX (see
  // GaussStepDisplay.tsx), which KaTeX renders fine but warns loudly about ("Unicode text
  // character used in math mode") under the default strict:'warn'. Only a real parse failure
  // (katex-error) should fail this check.
  const html = katex.renderToString(latex, { throwOnError: false, strict: false, macros: { '\\arraystretch': '1.5' } });
  if (html.includes('katex-error')) {
    fail(`[${label}] KaTeX failed to parse raw operation LaTeX: ${JSON.stringify(latex)}`);
  }
}

let gaussStepStrings = 0;
const gaussTestSystems: { label: string; system: LinearSystem }[] = [
  { label: '2x2', system: { dimension: '2x2', A: [[2, 1], [1, -1]], B: [5, 1], variables: ['x', 'y'] } },
  // Zero pivot forces a row swap, exercising the R_i \leftrightarrow R_j operation label too.
  { label: '2x2-needs-swap', system: { dimension: '2x2', A: [[0, 1], [1, 1]], B: [2, 3], variables: ['x', 'y'] } },
  { label: '3x3', system: { dimension: '3x3', A: [[1, 1, 1], [2, -1, 1], [3, 1, -1]], B: [6, 3, 2], variables: ['x', 'y', 'z'] } },
  ...ENGINEERING_ICT_PROBLEMS.map((p) => ({ label: `applied-${p.id}`, system: p.system })),
];
for (const { label, system } of gaussTestSystems) {
  for (const step of getGaussSteps(system)) {
    checkRawLatex(`gauss-${label}-step${step.stepIndex}`, step.operationPerformed);
    gaussStepStrings++;
  }
}
console.log(`✓ Swept ${gaussStepStrings} Gaussian-elimination step operation labels across ${gaussTestSystems.length} systems`);

// 7. NaN regression guard. getGaussSteps()/applyRowOperation() can return fraction-STRING cells
// (e.g. "1/2"), and the actual "NaN" rendering bug found in MatrixLab.tsx and HigherOrderLab.tsx
// was calling formatFractionOrDec (which expects a raw JS number) directly on one of those
// strings instead of formatLatexFraction (which correctly handles both numbers and
// fraction-strings) — GaussStepDisplay.tsx now always goes through formatLatexFraction via
// AugmentedMatrixDisplay. This asserts that path never produces NaN/undefined for any cell
// getGaussSteps() can actually emit, across the same representative systems as section 6.
let gaussCellCount = 0;
for (const { label, system } of gaussTestSystems) {
  for (const step of getGaussSteps(system)) {
    for (const row of step.augmentedMatrix) {
      for (const cell of row) {
        const latex = formatLatexFraction(cell);
        if (/NaN|undefined/.test(latex)) {
          fail(`[gauss-${label}-step${step.stepIndex}] formatLatexFraction produced "${latex}" for cell ${JSON.stringify(cell)}`);
        }
        gaussCellCount++;
      }
    }
  }
}
console.log(`✓ Swept ${gaussCellCount} Gaussian-elimination matrix cells for NaN/undefined formatting regressions`);

// 8. Gaussian-elimination step EXPLANATIONS (getGaussSteps()'s explanation field) — this is the
// SECOND occurrence of the raw-LaTeX-leak bug class on this exact codepath: section 6 above
// was added after the first occurrence (a raw LaTeX fragment left unwrapped in
// operationPerformed), and this bug recurred in the DIFFERENT sibling field "explanation" (the
// scale-pivot step's "คูณแถว R1 ด้วย \frac{1}{4} ..." text, reported rendering with a literal
// backslash in HigherOrderLab.tsx). explanation is $...$-delimited prose (unlike
// operationPerformed's raw LaTeX), so it goes through checkString's real
// preprocessMathText/splitParts pipeline, same as any other prose+math string in the app.
let gaussExplanationStrings = 0;
for (const { label, system } of gaussTestSystems) {
  for (const step of getGaussSteps(system)) {
    checkString(`gauss-${label}-step${step.stepIndex}-explanation`, step.explanation);
    gaussExplanationStrings++;
  }
}
console.log(`✓ Swept ${gaussExplanationStrings} Gaussian-elimination step explanations across ${gaussTestSystems.length} systems`);

if (failed) {
  console.error('\n' + '='.repeat(50));
  console.error('  MATH RENDERING QA FAILED — SEE ❌ ABOVE');
  console.error('='.repeat(50));
  process.exit(1);
} else {
  console.log('\n' + '='.repeat(50));
  console.log('  ALL MATH RENDERING QA TESTS PASSED!');
  console.log('='.repeat(50));
}
