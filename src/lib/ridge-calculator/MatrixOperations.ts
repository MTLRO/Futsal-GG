/**
 * Matrix operations for ridge regression
 * Implements ridge regression solver using normal equations with L2 regularization
 */

/**
 * Ridge regression solver using normal equations with L2 regularization
 * Solves: (X^T X + λI) β = X^T y
 *
 * @param X - Design matrix (n games × p players)
 * @param y - Target vector (goal differences or win/loss outcomes)
 * @param lambda - L2 regularization parameter
 * @returns Player coefficients (β)
 */
export function ridgeRegression(X: number[][], y: number[], lambda: number): number[] {
  const n = X.length;
  const p = X[0]?.length || 0;

  if (n === 0 || p === 0) {
    return [];
  }

  // Compute X^T X
  const XtX: number[][] = Array(p).fill(0).map(() => Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j];
      }
      XtX[i][j] = sum;
      // Add regularization to diagonal
      if (i === j) {
        XtX[i][j] += lambda;
      }
    }
  }

  // Compute X^T y
  const Xty: number[] = Array(p).fill(0);
  for (let i = 0; i < p; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += X[k][i] * y[k];
    }
    Xty[i] = sum;
  }

  // Solve linear system using Gaussian elimination
  return solveLinearSystem(XtX, Xty);
}

/**
 * Solves Ax = b using Gaussian elimination with partial pivoting
 *
 * @param A - Coefficient matrix (n × n)
 * @param b - Right-hand side vector (n)
 * @returns Solution vector x
 */
export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;

  if (n === 0) {
    return [];
  }

  // Create augmented matrix [A|b]
  const Ab: number[][] = A.map((row, i) => [...row, b[i]]);

  // Forward elimination with partial pivoting
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(Ab[k][i]) > Math.abs(Ab[maxRow][i])) {
        maxRow = k;
      }
    }

    // Swap rows
    [Ab[i], Ab[maxRow]] = [Ab[maxRow], Ab[i]];

    // Check for singular matrix
    if (Math.abs(Ab[i][i]) < 1e-10) {
      // Matrix is singular or nearly singular
      // Return zero vector or handle appropriately
      console.warn('Matrix is singular or nearly singular at row', i);
      continue;
    }

    // Make all rows below this one 0 in current column
    for (let k = i + 1; k < n; k++) {
      const factor = Ab[k][i] / Ab[i][i];
      for (let j = i; j <= n; j++) {
        Ab[k][j] -= factor * Ab[i][j];
      }
    }
  }

  // Back substitution
  const x: number[] = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = Ab[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= Ab[i][j] * x[j];
    }
    if (Math.abs(Ab[i][i]) > 1e-10) {
      x[i] /= Ab[i][i];
    }
  }

  return x;
}
