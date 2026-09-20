import * as math from 'mathjs';

export function parseMatrix(input: string[][]): number[][] {
  return input.map(row => row.map(cell => {
    const val = parseFloat(cell);
    return isNaN(val) ? 0 : val;
  }));
}

export function calculateDeterminant(matrix: number[][]): number {
  return math.det(matrix);
}
