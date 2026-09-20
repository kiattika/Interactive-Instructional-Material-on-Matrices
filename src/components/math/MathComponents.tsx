import React, { useMemo } from 'react';
import katex from 'katex';
import { round, toFraction } from '../../lib/matrixEngine';

export function formatLatexFraction(val: number | string): string {
  if (typeof val === 'string') {
    if (val.includes('/')) {
      const isNeg = val.startsWith('-');
      const clean = isNeg ? val.substring(1) : val;
      const [n, d] = clean.split('/');
      return `${isNeg ? '-' : ''}\\frac{${n}}{${d}}`;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      return formatLatexFraction(num);
    }
    return val;
  }
  const rounded = round(val, 6);
  if (Math.abs(rounded) < 1e-10) return '0';
  if (Number.isInteger(rounded)) return rounded.toString();

  const frac = toFraction(rounded);
  if (frac && frac.includes('/')) {
    const isNeg = frac.startsWith('-');
    const clean = isNeg ? frac.substring(1) : frac;
    const [n, d] = clean.split('/');
    return `${isNeg ? '-' : ''}\\frac{${n}}{${d}}`;
  }
  return rounded.toString();
}

export function preprocessMathText(text: string): string {
  if (!text) return '';

  // Step 1: convert JS matrix array string [[a, b], [c, d]] to
  // $\begin{bmatrix} a & b \\[0.5em] c & d \end{bmatrix}$. Safe to run on the
  // whole string up front — a literal [[1,2],[3,4]] pattern is not valid
  // LaTeX, so it cannot legitimately appear inside existing $ math already.
  const withBmatrix = text.replace(/\[\s*(\[\s*[^\[\]]+\s*\](?:\s*,\s*\[\s*[^\[\]]+\s*\])*)\s*\]/g, (match) => {
    try {
      const normalized = match.replace(/'/g, '"');
      const arr = JSON.parse(normalized);
      if (Array.isArray(arr) && arr.every((r) => Array.isArray(r))) {
        const rows = arr
          .map((row) => row.map((v: number | string) => (typeof v === 'number' ? formatLatexFraction(v) : v)).join(' & '))
          .join(' \\\\[0.5em] ');
        return `$\\begin{bmatrix} ${rows} \\end{bmatrix}$`;
      }
    } catch {
      // ignore parsing error
    }
    return match;
  });

  // Step 2: split into segments that are already inside a $...$ / $$...$$
  // math delimiter (this now also covers the $...$ that step 1 may have just
  // introduced) versus plain text, then only auto-wrap bare
  // \begin{ENV}...\end{ENV} within the PLAIN segments.
  //
  // This segmentation is what fixes the original bug: a properly-wrapped
  // block like "$$\left[\begin{array}{cc|c} ... \end{array}\right]$$" used
  // to get matched a second time in the middle (the old lookbehind/lookahead
  // only checked one adjacent character, which \left[ / \right] defeated),
  // splitting it into three broken pieces — a dangling "\left[", raw
  // unrendered "\begin{array}...", and a dangling "\right]" that KaTeX
  // renders as a parse error. Segmenting first makes that impossible, for
  // both originally-authored math and math introduced by step 1 above.
  const existingDelimRegex = /\$\$[\s\S]*?\$\$|\$[\s\S]*?\$/g;
  const segments: { isMath: boolean; text: string }[] = [];
  let cursor = 0;
  let delimMatch: RegExpExecArray | null;
  while ((delimMatch = existingDelimRegex.exec(withBmatrix)) !== null) {
    if (delimMatch.index > cursor) {
      segments.push({ isMath: false, text: withBmatrix.slice(cursor, delimMatch.index) });
    }
    segments.push({ isMath: true, text: delimMatch[0] });
    cursor = existingDelimRegex.lastIndex;
  }
  if (cursor < withBmatrix.length) {
    segments.push({ isMath: false, text: withBmatrix.slice(cursor) });
  }

  return segments
    .map((seg) =>
      seg.isMath ? seg.text : seg.text.replace(/\\begin\{([a-zA-Z]+)\}[\s\S]*?\\end\{\1\}/g, (match) => `$$${match}$$`)
    )
    .join('');
}

interface MathViewProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
  ariaLabel?: string;
}

export const MathView: React.FC<MathViewProps> = ({
  latex,
  displayMode = false,
  className = '',
  ariaLabel
}) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        macros: {
          "\\arraystretch": "1.5"
        }
      });
    } catch (err) {
      console.error('KaTeX rendering error:', err);
      return `<span class="text-rose-600 font-mono">${latex}</span>`;
    }
  }, [latex, displayMode]);

  return (
    <span
      className={`inline-block align-middle ${className}`}
      aria-label={ariaLabel || latex}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

// Matrix Display Component (Supports 2x2, 3x3, or any dimension, as matrix [] or determinant ||)
interface MatrixDisplayProps {
  matrix: (number | string)[][];
  type?: 'matrix' | 'determinant';
  label?: string;
  symbol?: string;
  className?: string;
}

export const MatrixDisplay: React.FC<MatrixDisplayProps> = ({
  matrix,
  type = 'matrix',
  label,
  symbol,
  className = ''
}) => {
  const latex = useMemo(() => {
    const env = type === 'determinant' ? 'vmatrix' : 'bmatrix';
    const rows = matrix.map((row) => row.map(val => typeof val === 'number' ? formatLatexFraction(val) : formatLatexFraction(val.toString())).join(' & ')).join(' \\\\[0.5em] ');
    const body = `\\begin{${env}} ${rows} \\end{${env}}`;
    const lbl = symbol || label;
    return lbl ? `${lbl} = ${body}` : body;
  }, [matrix, type, label, symbol]);

  return <MathView latex={latex} displayMode={true} className={className} />;
};

// Determinant Display Component (Explicitly uses vmatrix)
export const DeterminantDisplay: React.FC<{ matrix: (number | string)[][]; label?: string; className?: string }> = ({
  matrix,
  label,
  className = ''
}) => {
  return <MatrixDisplay matrix={matrix} type="determinant" label={label} className={className} />;
};

// Vector Display Component (Column Vector)
interface VectorDisplayProps {
  values: (number | string)[];
  label?: string;
  className?: string;
}

export const VectorDisplay: React.FC<VectorDisplayProps> = ({
  values,
  label,
  className = ''
}) => {
  const latex = useMemo(() => {
    const rows = values.map(val => typeof val === 'number' ? formatLatexFraction(val) : formatLatexFraction(val.toString())).join(' \\\\[0.5em] ');
    const body = `\\begin{bmatrix} ${rows} \\end{bmatrix}`;
    return label ? `${label} = ${body}` : body;
  }, [values, label]);

  return <MathView latex={latex} displayMode={true} className={className} />;
};

// Matrix Equation Display: AX = B -> [A] [X] = [B]
interface MatrixEquationDisplayProps {
  A: (number | string)[][];
  X?: string[];
  variables?: string[];
  B: (number | string)[];
  label?: string;
  className?: string;
}

export const MatrixEquationDisplay: React.FC<MatrixEquationDisplayProps> = ({
  A,
  X,
  variables,
  B,
  label,
  className = ''
}) => {
  const latex = useMemo(() => {
    const varList = X || variables || ['x', 'y', 'z'];
    const rowsA = A.map((r) => r.map(val => typeof val === 'number' ? formatLatexFraction(val) : formatLatexFraction(val.toString())).join(' & ')).join(' \\\\[0.5em] ');
    const rowsX = varList.slice(0, A[0]?.length || varList.length).join(' \\\\[0.5em] ');
    const rowsB = B.map(val => typeof val === 'number' ? formatLatexFraction(val) : formatLatexFraction(val.toString())).join(' \\\\[0.5em] ');
    const eq = `\\begin{bmatrix} ${rowsA} \\end{bmatrix} \\begin{bmatrix} ${rowsX} \\end{bmatrix} = \\begin{bmatrix} ${rowsB} \\end{bmatrix}`;
    return label ? `${label}: \\quad ${eq}` : eq;
  }, [A, X, variables, B, label]);

  return <MathView latex={latex} displayMode={true} className={className} />;
};

// Augmented Matrix Display: [A | B] with vertical divider
interface AugmentedMatrixDisplayProps {
  A: (number | string)[][];
  B: (number | string)[];
  rowOperation?: string;
  className?: string;
  // Row indices (0-based) to visually highlight — e.g. the row(s) about to be changed by
  // the next Elementary Row Operation. Rendered as a strong, high-contrast colored box
  // (not a pale tint) so it reads at a glance, per the Phase 2 step-highlight bug report.
  highlightRows?: number[];
}

export const AugmentedMatrixDisplay: React.FC<AugmentedMatrixDisplayProps> = ({
  A,
  B,
  rowOperation,
  className = '',
  highlightRows
}) => {
  const latex = useMemo(() => {
    const numCols = A[0]?.length || 2;
    const colFormat = 'c'.repeat(numCols) + '|c';
    const rows = A.map((row, i) => {
      const cells = [...row, B[i]].map((val) =>
        typeof val === 'number' ? formatLatexFraction(val) : formatLatexFraction(val.toString())
      );
      const isHighlighted = highlightRows?.includes(i);
      const formattedCells = isHighlighted
        ? cells.map((cell) => `\\colorbox{#fcd34d}{$\\color{#78350f}{${cell}}$}`)
        : cells;
      return formattedCells.join(' & ');
    }).join(' \\\\[0.5em] ');
    const matrixLatex = `\\left[\\begin{array}{${colFormat}} ${rows} \\end{array}\\right]`;

    if (rowOperation) {
      return `\\xrightarrow{${rowOperation}} \\quad ${matrixLatex}`;
    }
    return matrixLatex;
  }, [A, B, rowOperation, highlightRows]);

  return <MathView latex={latex} displayMode={true} className={className} />;
};

// 'light' assumes a light/white surface (bold rendered near-black); 'dark' assumes a dark
// surface (e.g. GeminiTutor's indigo/slate gradient chat bubbles) and needs a light accent
// instead, or bold text becomes invisible against the background.
export type TextTheme = 'light' | 'dark';

function renderFormattedText(text: string, theme: TextTheme = 'light'): React.ReactNode {
  if (!text) return null;
  if (!text.includes('**')) return <span className="whitespace-pre-line">{text}</span>;

  const boldClassName = theme === 'dark' ? 'font-bold text-amber-300' : 'font-bold text-slate-900';
  const parts = text.split('**');
  return (
    <span className="whitespace-pre-line">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className={boldClassName}>{part}</strong>
        ) : (
          part
        )
      )}
    </span>
  );
}

// Helper to render text containing math formatted with $...$ or $$...$$
export const RenderTextWithMath: React.FC<{ text: string; className?: string; theme?: TextTheme }> = ({
  text,
  className = '',
  theme = 'light' as TextTheme
}) => {
  const processedText = useMemo(() => preprocessMathText(text), [text]);

  const parts = useMemo(() => {
    // Match $$...$$ first for display mode, then $...$ for inline mode
    const regex = /\$\$([\s\S]*?)\$\$|\$([\s\S]*?)\$/g;
    const result: { isMath: boolean; displayMode?: boolean; content: string }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(processedText)) !== null) {
      if (match.index > lastIndex) {
        result.push({ isMath: false, content: processedText.substring(lastIndex, match.index) });
      }
      if (match[1] !== undefined) {
        result.push({ isMath: true, displayMode: true, content: match[1].trim() });
      } else if (match[2] !== undefined) {
        result.push({ isMath: true, displayMode: false, content: match[2].trim() });
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < processedText.length) {
      result.push({ isMath: false, content: processedText.substring(lastIndex) });
    }

    return result;
  }, [processedText]);

  return (
    <span className={className}>
      {parts.map((p, idx) =>
        p.isMath ? (
          <MathView
            key={idx}
            latex={p.content}
            displayMode={p.displayMode || false}
            className={p.displayMode ? "my-3 block text-center overflow-x-auto" : "mx-1 inline-block"}
          />
        ) : (
          <span key={idx}>{renderFormattedText(p.content, theme)}</span>
        )
      )}
    </span>
  );
};

interface SystemDisplayProps {
  equations?: string[];
  A?: (number | string)[][];
  B?: (number | string)[];
  variables?: string[];
  className?: string;
}

export const SystemDisplay: React.FC<SystemDisplayProps> = ({
  equations,
  A,
  B,
  variables = ['x', 'y', 'z'],
  className = ''
}) => {
  const latex = useMemo(() => {
    if (equations && equations.length > 0) {
      const body = equations.join(' \\\\[0.4em] ');
      return `\\begin{cases} ${body} \\end{cases}`;
    }

    if (A && B) {
      const generatedEqs = A.map((row, i) => {
        const terms = row
          .map((coeff, j) => {
            const val = typeof coeff === 'number' ? coeff : parseFloat(coeff as string);
            if (isNaN(val) || val === 0) return '';
            const varName = variables[j] || `x_{${j + 1}}`;
            const isFirst = j === 0 || row.slice(0, j).every(c => c === 0 || parseFloat(c as any) === 0);
            const sign = val > 0 ? (isFirst ? '' : ' + ') : (isFirst ? '-' : ' - ');
            const absVal = Math.abs(val);
            const coeffStr = absVal === 1 ? '' : formatLatexFraction(absVal);
            return `${sign}${coeffStr}${varName}`;
          })
          .filter(Boolean)
          .join('');

        return `${terms || '0'} = ${formatLatexFraction(B[i])}`;
      });

      return `\\begin{cases} ${generatedEqs.join(' \\\\[0.4em] ')} \\end{cases}`;
    }

    return '';
  }, [equations, A, B, variables]);

  return <MathView latex={latex} displayMode={true} className={className} />;
};

