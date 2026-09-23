import React from 'react';
import { GaussStep } from '../types';
import { ArrowDown } from 'lucide-react';
import { AugmentedMatrixDisplay, MathView } from './math/MathComponents';

interface GaussStepDisplayProps {
  step: GaussStep;
  className?: string;
}

function splitAugmented(mat: (number | string)[][]): { A: (number | string)[][]; B: (number | string)[] } {
  return {
    A: mat.map((row) => row.slice(0, -1)),
    B: mat.map((row) => row[row.length - 1])
  };
}

// Shared "before -> operation -> after" visual for one Gaussian-elimination step — standard
// textbook row-reduction notation, used by both MatrixLab.tsx's Gauss Elimination tab and
// HigherOrderLab.tsx's 4x4 walkthrough (previously each page rendered its own single
// highlighted-cells matrix instead).
//
// Deliberately reuses AugmentedMatrixDisplay's own cell formatting (which already handles
// fraction-string cells like "1/2" correctly via formatLatexFraction) rather than reformatting
// GaussStep's already-correct values a second time. That re-formatting — calling
// formatFractionOrDec (which expects a raw JS number) directly on an already-formatted fraction
// STRING from getGaussSteps()/applyRowOperation() — was exactly the "NaN" rendering bug found in
// both pages: the underlying math was always correct, only the display layer was recomputing it
// incorrectly.
//
// operationPerformed is raw LaTeX (e.g. "R_{1} \\rightarrow \\frac{1}{2} R_{1}"), passed straight
// into AugmentedMatrixDisplay's rowOperation prop (itself just forwarded to KaTeX's
// \xrightarrow{...}) — never through RenderTextWithMath's $...$-delimited text pipeline, which
// is for prose with embedded math, not a bare LaTeX fragment.
export const GaussStepDisplay: React.FC<GaussStepDisplayProps> = ({ step, className = '' }) => {
  const after = splitAugmented(step.augmentedMatrix);

  if (!step.beforeMatrix) {
    // Initial state (Step 1) — nothing to compare against yet, and operationPerformed here is
    // descriptive Thai prose ("เริ่มสร้าง Augmented Matrix..."), not a LaTeX fragment, so it's
    // never fed through AugmentedMatrixDisplay/KaTeX.
    return (
      <div className={`flex justify-center-safe py-2 overflow-x-auto ${className}`}>
        <AugmentedMatrixDisplay A={after.A} B={after.B} highlightRows={step.highlightRows} />
      </div>
    );
  }

  const before = splitAugmented(step.beforeMatrix);

  // Below md the three parts stack vertically, with the operation on its own full-size line:
  // side by side, \xrightarrow{op} made the after-matrix wider than a phone screen (forcing a
  // horizontal scroll per step) and typeset the operation at script size, i.e. illegibly small
  // exactly where the student most needs to read it. From md up the original inline-arrow
  // notation is kept. *-center-safe alignment: anything still too wide scrolls rather than
  // being clipped on its left edge by centering.
  return (
    <div
      className={`flex flex-col md:flex-row items-center-safe justify-center-safe gap-2 md:gap-4 py-2 overflow-x-auto ${className}`}
    >
      <AugmentedMatrixDisplay A={before.A} B={before.B} highlightRows={step.highlightRows} />
      <div className="md:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-800">
        <ArrowDown className="w-4 h-4 flex-shrink-0" />
        <MathView latex={step.operationPerformed} className="text-base font-bold" />
      </div>
      <div className="md:hidden max-w-full">
        <AugmentedMatrixDisplay A={after.A} B={after.B} highlightRows={step.highlightRows} />
      </div>
      <div className="hidden md:block">
        <AugmentedMatrixDisplay
          A={after.A}
          B={after.B}
          rowOperation={step.operationPerformed}
          highlightRows={step.highlightRows}
        />
      </div>
    </div>
  );
};
