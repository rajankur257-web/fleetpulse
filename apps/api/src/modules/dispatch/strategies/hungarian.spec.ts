import { hungarianAlgorithm } from './hungarian';

describe('Hungarian Algorithm (Kuhn-Munkres)', () => {
  it('solves 1x1 cost matrix', () => {
    const costMatrix = [[5]];
    const assignments = hungarianAlgorithm(costMatrix);
    expect(assignments).toEqual([0]);
  });

  it('solves 2x2 cost matrix with optimal minimum cost assignment', () => {
    // Row 0: costs [4, 1]
    // Row 1: costs [2, 3]
    // Optimal: Row 0 -> Col 1 (cost 1), Row 1 -> Col 0 (cost 2). Total = 3.
    const costMatrix = [
      [4, 1],
      [2, 3],
    ];
    const assignments = hungarianAlgorithm(costMatrix);
    expect(assignments).toEqual([1, 0]);
  });

  it('solves 3x3 cost matrix correctly', () => {
    // Workers vs Tasks
    const costMatrix = [
      [10, 19, 8],
      [10, 1, 12],
      [13, 12, 17],
    ];
    // Optimal:
    // Row 0 -> Col 2 (cost 8)
    // Row 1 -> Col 1 (cost 1)
    // Row 2 -> Col 0 (cost 13)
    // Total = 22
    const assignments = hungarianAlgorithm(costMatrix);
    expect(assignments).toEqual([2, 1, 0]);
  });

  it('handles rectangular matrix: more tasks/drivers than workers/requests (rows < cols)', () => {
    // 2 requests, 3 drivers
    const costMatrix = [
      [10, 2, 20],
      [5, 15, 8],
    ];
    // Optimal:
    // Row 0 -> Col 1 (cost 2)
    // Row 1 -> Col 0 (cost 5)
    const assignments = hungarianAlgorithm(costMatrix);
    expect(assignments[0]).toBe(1);
    expect(assignments[1]).toBe(0);
  });

  it('handles rectangular matrix: more workers/requests than tasks/drivers (rows > cols)', () => {
    // 3 requests, 2 drivers
    const costMatrix = [
      [2, 20],
      [10, 1],
      [30, 40],
    ];
    // Optimal:
    // Row 0 -> Col 0 (cost 2)
    // Row 1 -> Col 1 (cost 1)
    // Row 2 -> unassigned (-1)
    const assignments = hungarianAlgorithm(costMatrix);
    expect(assignments[0]).toBe(0);
    expect(assignments[1]).toBe(1);
    expect(assignments[2]).toBe(-1);
  });

  it('handles empty matrix gracefully', () => {
    expect(hungarianAlgorithm([])).toEqual([]);
    expect(hungarianAlgorithm([[]])).toEqual([-1]);
  });
});
