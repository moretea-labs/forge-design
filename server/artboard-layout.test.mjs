import { describe, expect, it } from 'vitest';
import { analyzeDeclaredArtboardLayout } from './artboard-layout.mjs';

const viewport = { width: 393, height: 852, safeTop: 54, safeBottom: 30 };

describe('analyzeDeclaredArtboardLayout', () => {
  it('passes non-overlapping annotated regions', () => {
    const svg = '<svg viewBox="0 0 393 852"><g data-fd-region="hero" data-fd-box="16 70 361 120" data-fd-overlap-group="flow" data-fd-safe-area="content"></g><g data-fd-region="metrics" data-fd-box="16 202 361 260" data-fd-overlap-group="flow" data-fd-safe-area="content"></g></svg>';
    expect(analyzeDeclaredArtboardLayout(svg, viewport)).toMatchObject({ status: 'pass', issues: [] });
  });

  it('detects sibling overlap, container overflow and safe-area violations', () => {
    const svg = '<svg viewBox="0 0 393 852"><g data-fd-region="container" data-fd-box="16 70 361 150" data-fd-safe-area="content"></g><g data-fd-region="a" data-fd-box="20 80 180 100" data-fd-container="container" data-fd-overlap-group="flow"></g><g data-fd-region="b" data-fd-box="180 120 210 120" data-fd-container="container" data-fd-overlap-group="flow"></g><g data-fd-region="top" data-fd-box="10 10 100 30" data-fd-safe-area="content"></g></svg>';
    const codes = analyzeDeclaredArtboardLayout(svg, viewport).issues.map((issue) => issue.code);
    expect(codes).toContain('sibling_overlap');
    expect(codes).toContain('container_overflow');
    expect(codes).toContain('safe_area_violation');
  });

  it('uses intrinsic artboard height for scroll content while keeping viewport safe-area semantics explicit', () => {
    const svg = '<svg viewBox="0 0 393 1385"><g data-fd-region="hero" data-fd-box="16 70 361 300" data-fd-safe-area="content"></g><g data-fd-region="monitoring" data-fd-box="16 453 361 629" data-fd-overlap-group="flow"></g><g data-fd-region="reminders" data-fd-box="16 1096 361 165" data-fd-overlap-group="flow"></g></svg>';
    expect(analyzeDeclaredArtboardLayout(svg, viewport)).toMatchObject({ status: 'pass', issues: [] });

    const overflow = '<svg viewBox="0 0 393 1385"><g data-fd-region="reminders" data-fd-box="16 1360 361 60"></g></svg>';
    expect(analyzeDeclaredArtboardLayout(overflow, viewport).issues.map((issue) => issue.code)).toContain('artboard_out_of_bounds');

    const viewportSafeArea = '<svg viewBox="0 0 393 1385"><g data-fd-region="scroll-region" data-fd-box="16 900 361 120" data-fd-safe-area="content"></g></svg>';
    expect(analyzeDeclaredArtboardLayout(viewportSafeArea, viewport).issues.map((issue) => issue.code)).toContain('safe_area_violation');
  });

  it('allows intentional overlap and keeps legacy artboards readable', () => {
    const legacy = '<svg viewBox="0 0 393 852"><rect width="393" height="852"/></svg>';
    expect(analyzeDeclaredArtboardLayout(legacy, viewport).status).toBe('unannotated');
    const svg = '<svg viewBox="0 0 393 852"><g data-fd-region="background" data-fd-box="0 0 393 852" data-fd-overlap-group="decor" data-fd-overlap="allow"></g><g data-fd-region="content" data-fd-box="16 70 361 700" data-fd-overlap-group="decor"></g></svg>';
    expect(analyzeDeclaredArtboardLayout(svg, viewport).status).toBe('pass');
  });
});
