import React from 'react';
import { GaussStep } from '../types';
import { AugmentedMatrixDisplay } from './math/MathComponents';

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
      <div className={`flex justify-center py-2 overflow-x-auto ${className}`}>
        <AugmentedMatrixDisplay A={after.A} B={after.B} highlightRows={step.highlightRows} />
      </div>
    );
  }

  const before = splitAugmented(step.beforeMatrix);

  return (
    <div className={`flex flex-col md:flex-row items-center justify-center gap-4 py-2 overflow-x-auto ${className}`}>
      <AugmentedMatrixDisplay A={before.A} B={before.B} highlightRows={step.highlightRows} />
      <AugmentedMatrixDisplay
        A={after.A}
        B={after.B}
        rowOperation={step.operationPerformed}
        highlightRows={step.highlightRows}
      />
    </div>
  );
};
