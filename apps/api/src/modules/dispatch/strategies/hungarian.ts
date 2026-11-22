/**
 * Hungarian Algorithm (Kuhn-Munkres) for solving the linear sum assignment problem.
 * Finds the minimum-cost matching between workers (rows) and tasks/drivers (columns).
 *
 * Supports rectangular cost matrices (rows <= cols or rows > cols).
 * Returns an array where index i is the assigned column for row i (or -1 if unassigned).
 */
export function hungarianAlgorithm(costMatrix: number[][]): number[] {
  if (!costMatrix || costMatrix.length === 0) {
    return [];
  }

  const firstRow = costMatrix[0];
  if (!firstRow || firstRow.length === 0) {
    return costMatrix.length === 1 ? [-1] : [];
  }

  const numRows = costMatrix.length;
  const numCols = firstRow.length;

  // Handle case where rows > cols: transpose, solve, and map back
  if (numRows > numCols) {
    const transposed: number[][] = Array.from({ length: numCols }, (_, c) =>
      Array.from({ length: numRows }, (__, r) => {
        const row = costMatrix[r];
        return row && row[c] !== undefined ? row[c]! : 0;
      }),
    );
    const colAssignments = hungarianAlgorithm(transposed);
    const rowAssignments = new Array<number>(numRows).fill(-1);
    for (let c = 0; c < colAssignments.length; c++) {
      const r = colAssignments[c];
      if (r !== undefined && r !== -1 && r < numRows) {
        rowAssignments[r] = c;
      }
    }
    return rowAssignments;
  }

  // Dimension for square matrix (numRows <= numCols)
  const dim = numCols;
  const matrix: number[][] = Array.from({ length: dim }, (_, r) => {
    if (r < numRows) {
      const row = costMatrix[r];
      return row ? [...row] : new Array<number>(dim).fill(0);
    }
    // Dummy rows filled with 0 cost
    return new Array<number>(dim).fill(0);
  });

  // 1-indexed potentials and matching arrays for standard O(V^3) Kuhn-Munkres
  const u = new Array<number>(dim + 1).fill(0);
  const v = new Array<number>(dim + 1).fill(0);
  const p = new Array<number>(dim + 1).fill(0);
  const way = new Array<number>(dim + 1).fill(0);

  for (let i = 1; i <= dim; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(dim + 1).fill(Infinity);
    const used = new Array<boolean>(dim + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0]!;
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= dim; j++) {
        if (!used[j]) {
          const matrixRow = matrix[i0 - 1];
          const cur = (matrixRow ? matrixRow[j - 1] ?? 0 : 0) - (u[i0] ?? 0) - (v[j] ?? 0);
          if (cur < (minv[j] ?? Infinity)) {
            minv[j] = cur;
            way[j] = j0;
          }
          if ((minv[j] ?? Infinity) < delta) {
            delta = minv[j]!;
            j1 = j;
          }
        }
      }

      for (let j = 0; j <= dim; j++) {
        if (used[j]) {
          const pJ = p[j] ?? 0;
          u[pJ] = (u[pJ] ?? 0) + delta;
          v[j] = (v[j] ?? 0) - delta;
        } else {
          minv[j] = (minv[j] ?? 0) - delta;
        }
      }

      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0] ?? 0;
      p[j0] = p[j1] ?? 0;
      j0 = j1;
    } while (j0 !== 0);
  }

  // Reconstruct column assignments for original rows
  const result = new Array<number>(numRows).fill(-1);
  for (let j = 1; j <= dim; j++) {
    const rowIdx = (p[j] ?? 0) - 1;
    if (rowIdx >= 0 && rowIdx < numRows) {
      result[rowIdx] = j - 1;
    }
  }

  return result;
}
