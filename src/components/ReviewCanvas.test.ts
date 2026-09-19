import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ComponentContractsDocument, ScreenSpec, VisualAsset } from '../core/schema';
import { calculateReviewFitScale, ReviewCanvas } from './ReviewCanvas';

const spec: ScreenSpec = {
  schemaVersion: 1,
  id: 'home',
  name: 'Home',
  device: 'iphone-16-pro',
  goal: 'Exercise review lanes.',
  primaryAction: 'continue',
  constraints: [],
  nodes: [],
};

const components: ComponentContractsDocument = { schemaVersion: 1, components: [] };

const artboard: VisualAsset = {
  id: 'artboard_primary_home_normal_standard-light',
  name: 'Home Artboard',
  role: 'design_artboard',
  mediaType: 'image/svg+xml',
  provenance: { kind: 'repository_path', path: '.design-harness/artboards/primary/home/normal/standard-light.svg' },
  binding: { designUnitId: 'primary', screenId: 'home', stateId: 'normal', profileId: 'standard-light' },
  dimensions: { width: 393, height: 900 },
};

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

describe('ReviewCanvas authority lanes', () => {
  const baseProps = {
    spec,
    components,
    profile: null,
    surfaceStyle: {},
    zoom: 0.78,
    mode: 'device' as const,
    reference: null,
    referenceUrl: null,
  };

  it('keeps Semantic Preview explicitly non-authoritative', () => {
    const html = renderToStaticMarkup(createElement(ReviewCanvas, { ...baseProps, lane: 'semantic', artboard: null, artboardUrl: null, artboardIssue: null }));
    expect(html).toContain('data-lane="semantic"');
    expect(html).toContain('Semantic Preview');
    expect(html).toContain('Non-authority');
    expect(html).not.toContain('High-fidelity Artboard missing');
  });

  it('shows a hard missing state instead of falling back to MockScreen in the visual lane', () => {
    const html = renderToStaticMarkup(createElement(ReviewCanvas, { ...baseProps, lane: 'artboard', artboard: null, artboardUrl: null, artboardIssue: 'Exact artboard missing.' }));
    expect(html).toContain('data-lane="artboard"');
    expect(html).toContain('High-fidelity Artboard missing');
    expect(html).toContain('Exact artboard missing.');
    expect(html).toContain('Visual authority');
    expect(html).not.toContain('Semantic Preview');
  });

  it('renders the exact bound artboard as visual authority when it exists', () => {
    const html = renderToStaticMarkup(createElement(ReviewCanvas, { ...baseProps, lane: 'artboard', artboard, artboardUrl: '/api/artboard.svg', artboardIssue: null }));
    expect(html).toContain('Home · Visual Artboard');
    expect(html).toContain('Visual authority');
    expect(html).toContain('src="/api/artboard.svg"');
    expect(html).toContain('alt="Home Artboard"');
  });
});
