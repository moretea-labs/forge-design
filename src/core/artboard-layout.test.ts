import { describe, expect, it } from 'vitest';
import { analyzeDeclaredLayout, renderedOverflowIssues, type LayoutRegion } from './artboard-layout';

const region = (id: string, box: { x: number; y: number; width: number; height: number }): LayoutRegion => ({
  id, box, containerId: null, overlapGroup: 'flow', overlapPolicy: 'forbid', safeArea: null,
});

describe('artboard layout client diagnostics', () => {
  it('detects declared sibling overlap', () => {
    const report = analyzeDeclaredLayout([
      region('a', { x: 0, y: 60, width: 200, height: 100 }),
      region('b', { x: 180, y: 120, width: 200, height: 100 }),
    ], { width: 393, height: 852, safeTop: 54, safeBottom: 30 });
    expect(report.issues.some((issue) => issue.code === 'sibling_overlap')).toBe(true);
  });

  it('detects rendered content escaping declared bounds', () => {
    const regions = [region('card', { x: 16, y: 100, width: 361, height: 100 })];
    const actual = new Map([['card', { x: 16, y: 100, width: 370, height: 112 }]]);
    expect(renderedOverflowIssues(regions, actual)[0]?.code).toBe('rendered_content_overflow');
  });
});
