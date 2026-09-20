import katex from 'katex';
import { preprocessMathText } from '../components/math/MathComponents';
import { CURRICULUM_LESSONS } from '../lib/learningStore';
import { ENGINEERING_ICT_PROBLEMS } from '../lib/engineeringProblems';
import { generateExercises } from '../lib/matrixEngine';
import { DIAGNOSTIC_QUESTIONS } from '../pages/PrePostTest';
import { INVERSE_CONCEPT_TEXT, CRAMER_CONCEPT_TEXT } from '../pages/MatrixLab';
import { CIRCUIT_PROBLEM_TEXT, SYSTEM_HEADING_TEXT } from '../pages/HigherOrderLab';

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
    lessonStrings += 2 + q.options.length;
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
  mcqStrings += 2 + (q.options?.length || 0) + q.hints.length;
}
console.log(`✓ Swept ${mcqStrings} MCQ exercise strings`);

// 4. Diagnostic pre/post-test questions (PrePostTest.tsx) — data-driven but previously not
// swept, unlike the other content sources above.
let diagnosticStrings = 0;
for (const q of DIAGNOSTIC_QUESTIONS) {
  checkString(`diagnostic-${q.id}-text`, q.text);
  checkString(`diagnostic-${q.id}-explanation`, q.explanation);
  for (const opt of q.options) checkString(`diagnostic-${q.id}-option`, opt);
  diagnosticStrings += 2 + q.options.length;
}
console.log(`✓ Swept ${diagnosticStrings} diagnostic pre/post-test strings`);

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
