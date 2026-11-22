import { SeededPRNG } from './prng';

describe('SeededPRNG', () => {
  it('produces identical sequences with the same seed', () => {
    const prng1 = new SeededPRNG(42);
    const prng2 = new SeededPRNG(42);

    const seq1 = Array.from({ length: 10 }, () => prng1.next());
    const seq2 = Array.from({ length: 10 }, () => prng2.next());

    expect(seq1).toEqual(seq2);
  });

  it('produces different sequences with different seeds', () => {
    const prng1 = new SeededPRNG(42);
    const prng2 = new SeededPRNG(999);

    const seq1 = Array.from({ length: 5 }, () => prng1.next());
    const seq2 = Array.from({ length: 5 }, () => prng2.next());

    expect(seq1).not.toEqual(seq2);
  });

  it('respects range boundaries', () => {
    const prng = new SeededPRNG(123);
    for (let i = 0; i < 100; i++) {
      const val = prng.range(10, 20);
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThan(20);
    }
  });

  it('picks elements from array deterministically', () => {
    const items = ['Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout'];
    const prng1 = new SeededPRNG(555);
    const prng2 = new SeededPRNG(555);

    const picks1 = Array.from({ length: 5 }, () => prng1.pick(items));
    const picks2 = Array.from({ length: 5 }, () => prng2.pick(items));

    expect(picks1).toEqual(picks2);
    picks1.forEach((p) => expect(items).toContain(p));
  });

  it('evaluates probability chance correctly', () => {
    const prng = new SeededPRNG(777);
    let trueCount = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      if (prng.chance(0.7)) trueCount++;
    }
    // Should be roughly ~70% (e.g. 650 - 750)
    expect(trueCount).toBeGreaterThan(650);
    expect(trueCount).toBeLessThan(750);
  });
});
