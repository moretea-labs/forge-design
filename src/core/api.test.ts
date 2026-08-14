import { describe, expect, it } from 'vitest';
import manifest from '../../forge-plugin.json';
import project from '../../workspace/metronome/.design-harness/project.json';
import tokens from '../../workspace/metronome/.design-harness/tokens.json';
import components from '../../workspace/metronome/.design-harness/components.json';
import product from '../../workspace/metronome/.design-harness/product.json';
import homeScreen from '../../workspace/metronome/.design-harness/screens/metronome-home.json';
import emptyScreen from '../../workspace/metronome/.design-harness/screens/empty-state.json';
import { designHarnessCapabilities, getComponentContract, getDesignTokens, getScreenSpec, lintScreenSpec, listComponents, listScreens } from './api';
import type { DesignProjectContext } from './schema';

const context = {
  schemaVersion: 1,
  project,
  storage: {
    canonicalDirectory: '.design-harness',
    sourceOfTruth: 'target-repository',
    versionControl: 'git',
    screenLayout: 'one-json-file-per-screen',
    browserStorageCanonical: false,
  },
  tokens,
  components,
  screens: [homeScreen, emptyScreen],
  product,
  goldenGate: { modeled: true, status: 'candidate', productContractReady: true, flowReady: false, interactionPatternsReady: false, runtimeReviewStage: 'captured', runtimeEvidenceReady: false, userDecision: 'pending', canApprove: false, blockers: ['candidate'] },
} as DesignProjectContext;

describe('Forge Design core API', () => {
  it('keeps the external provider manifest aligned with the public Forge identity', () => {
    expect(manifest.id).toBe('design');
    expect(manifest.name).toBe('Forge Design');
    expect(manifest.mode).toBe('external');
    expect(manifest.scope).toBe('controller');
    expect(manifest.transport.kind).toBe('managed-cli-json');
    expect(manifest.actions).toContain('design_get_context');
    expect(manifest.actions).toContain('design_get_product_model');
    expect(manifest.actions).toContain('design_put_product_model');
    expect(manifest.actions).toContain('design_import_markdown');
  });

  it('returns isolated project data through the future adapter boundary', () => {
    const returnedTokens = getDesignTokens(context);
    const screens = listScreens(context);
    const returnedComponents = listComponents(context);
    expect(returnedTokens.meta.name).toBe('Calm Precision');
    expect(screens.some((screen) => screen.id === 'metronome-home')).toBe(true);
    expect(returnedComponents.some((component) => component.name === 'BPMController')).toBe(true);
    expect(getComponentContract(context, 'MissingComponent')).toBeNull();
  });

  it('lints a screen loaded through the public API', () => {
    const screen = getScreenSpec(context, 'metronome-home');
    expect(screen).not.toBeNull();
    expect(lintScreenSpec(context, screen!)).toEqual([]);
  });
});
