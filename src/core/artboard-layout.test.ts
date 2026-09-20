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

  it('separates tall artboard bounds from the device viewport safe area', () => {
    const monitoring = region('monitoring', { x: 16, y: 900, width: 361, height: 120 });
    const report = analyzeDeclaredLayout(
      [monitoring],
      { width: 393, height: 852, safeTop: 54, safeBottom: 30 },
      { width: 393, height: 1385 },
    );
    expect(report.issues.some((issue) => issue.code === 'artboard_out_of_bounds')).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'safe_area_violation')).toBe(false);

    const viewportSafe = { ...monitoring, safeArea: 'content' };
    const safeReport = analyzeDeclaredLayout(
      [viewportSafe],
      { width: 393, height: 852, safeTop: 54, safeBottom: 30 },
      { width: 393, height: 1385 },
    );
    expect(safeReport.issues.some((issue) => issue.code === 'safe_area_violation')).toBe(true);
  });

  it('detects rendered content escaping declared bounds', () => {
    const regions = [region('card', { x: 16, y: 100, width: 361, height: 100 })];
    const actual = new Map([['card', { x: 16, y: 100, width: 370, height: 112 }]]);
    expect(renderedOverflowIssues(regions, actual)[0]?.code).toBe('rendered_content_overflow');
  });
});
