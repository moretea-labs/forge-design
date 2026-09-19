import { describe, expect, it } from 'vitest';
import { calculateReviewFitScale } from './ReviewCanvas';

describe('ReviewCanvas fit geometry', () => {
  it('fits one device inside the available review area without upscaling', () => {
    expect(calculateReviewFitScale(1200, 1000, 417, 876, false)).toBe(1);
    expect(calculateReviewFitScale(700, 700, 417, 876, false)).toBeCloseTo(628 / 876, 5);
  });

  it('reserves independent horizontal space for a side-by-side reference', () => {
    const single = calculateReviewFitScale(700, 1000, 417, 876, false);
    const compare = calculateReviewFitScale(700, 1000, 417, 876, true);
    expect(single).toBe(1);
    expect(compare).toBeCloseTo(322 / 417, 5);
    expect(compare).toBeLessThan(single);
  });

  it('never upscales beyond native size', () => {
    expect(calculateReviewFitScale(4000, 3000, 417, 876, true)).toBe(1);
  });
});
