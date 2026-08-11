import { describe, expect, it } from 'vitest';
import { lintScreen } from './lint';
import type { ComponentContractsDocument, ScreenSpec } from './schema';
import componentsDocument from '../../workspace/metronome/.design-harness/components.json';
import homeScreen from '../../workspace/metronome/.design-harness/screens/metronome-home.json';
import emptyScreen from '../../workspace/metronome/.design-harness/screens/empty-state.json';

const components = componentsDocument as ComponentContractsDocument;
const screens = [homeScreen, emptyScreen] as ScreenSpec[];

describe('lintScreen', () => {
  it('accepts repository-backed screen specs', () => {
    for (const screen of screens) expect(lintScreen(screen, components)).toEqual([]);
  });

  it('rejects an unregistered component and missing primary action', () => {
    const issues = lintScreen({
      schemaVersion: 1,
      id: 'broken',
      name: 'Broken',
      device: 'iphone-16-pro',
      goal: 'Test lint.',
      primaryAction: 'continue',
      constraints: [],
      nodes: [{ id: 'mystery', component: 'MysteryBox' }],
    }, components);
    expect(issues.map((issue) => issue.rule)).toContain('registered-components-only');
    expect(issues.map((issue) => issue.rule)).toContain('single-primary-action');
  });
});
