import { describe, expect, it } from 'vitest';
import { compileScreenToDesignIR, resolveDesignViewport } from './design-ir';
import { inspectDesignIR } from './quality';
import { createStudioRuntimeState, executeDesignInteractions } from './studio-runtime';
import type { ComponentContractsDocument, DesignReviewProfile, DesignTokens, ScreenSpec } from './schema';

const components: ComponentContractsDocument = {
  schemaVersion: 1,
  components: [{
    name: 'PrimaryAction', purpose: 'Continue.', category: 'control', interactionRole: 'primary_action',
    props: [{ name: 'label', type: 'string', required: true, description: 'Label.' }],
    states: [{ id: 'idle', name: 'Idle' }], variants: [{ id: 'filled', name: 'Filled' }],
    preview: { nodes: [
      { id: 'root', primitive: 'surface', style: { padding: 'lg', background: 'surface', radius: 'card' } },
      { id: 'action', primitive: 'button', parentId: 'root', content: { kind: 'prop', value: 'label' }, style: { width: 'fill' } },
    ] },
  }],
};

const tokens: DesignTokens = {
  schemaVersion: 1, meta: { name: 'Test', version: '1' }, color: { surface: 'test-surface' }, spacing: { lg: 16 }, radius: { card: 12 }, shadow: {}, typography: { body: { size: 14, lineHeight: 20, weight: 400 } },
};

const screen: ScreenSpec = {
  schemaVersion: 1, id: 'home', name: 'Home', goal: 'Continue task.', primaryAction: 'Continue', constraints: [],
  viewport: { kind: 'desktop', platform: 'macos', preset: 'macbook', width: 1440, height: 900, safeTop: 0, safeBottom: 0 },
  nodes: [{ id: 'continue', component: 'PrimaryAction', props: { label: 'Continue' }, interactions: [{ event: 'press', actions: [{ type: 'set_state', stateId: 'done' }, { type: 'emit_design_action', actionId: 'continue' }] }] }],
  initialStateId: 'normal', states: [{ id: 'normal', name: 'Normal', meaning: 'Ready.' }, { id: 'done', name: 'Done', meaning: 'Completed.' }],
  quality: { requiredStateIds: ['normal', 'done'], requireTokenReferences: true },
};

describe('Design IR', () => {
  it('compiles repository component contracts into one platform-neutral IR', () => {
    const ir = compileScreenToDesignIR(screen, components);
    expect(ir.viewport).toMatchObject({ kind: 'desktop', platform: 'macos', width: 1440, height: 900 });
    expect(ir.nodes[0].children[0]).toMatchObject({ primitive: 'button', content: 'Continue', component: 'PrimaryAction' });
    expect(ir.nodes[0].children[0].interactions[0].event).toBe('press');
  });

  it('lets review profiles override the legacy/device surface without changing screen identity', () => {
    const profile: DesignReviewProfile = { id: 'desktop-light', name: 'Desktop', viewport: { width: 1280, height: 800, safeTop: 0, safeBottom: 0, kind: 'desktop', platform: 'macos' }, colorScheme: 'light', textScale: 1, contrast: 'standard', reduceMotion: false };
    expect(resolveDesignViewport({ ...screen, viewport: undefined, device: 'iphone-16-pro' }, profile)).toMatchObject({ width: 1280, platform: 'macos', kind: 'desktop' });
  });

  it('preserves screen platform semantics when a review profile only overrides dimensions', () => {
    const profile: DesignReviewProfile = { id: 'wide', name: 'Wide', viewport: { width: 1280, height: 800, safeTop: 0, safeBottom: 0 }, colorScheme: 'light', textScale: 1, contrast: 'standard', reduceMotion: false };
    expect(resolveDesignViewport(screen, profile)).toMatchObject({ width: 1280, height: 800, platform: 'macos', kind: 'desktop', preset: 'macbook' });
  });

  it('uses a neutral web viewport instead of implicitly inventing an iPhone', () => {
    const neutral: ScreenSpec = { schemaVersion: 1, id: 'neutral', name: 'Neutral', goal: 'Render anywhere.', primaryAction: 'Continue', constraints: [], nodes: [] };
    expect(resolveDesignViewport(neutral)).toEqual({ kind: 'web', platform: 'web', width: 1024, height: 768, safeTop: 0, safeBottom: 0 });
  });

  it('runs bounded declarative actions without project JavaScript', () => {
    const ir = compileScreenToDesignIR(screen, components);
    const button = ir.nodes[0].children[0];
    const initial = createStudioRuntimeState(ir);
    const next = executeDesignInteractions(initial, button.interactions, 'press');
    expect(next.screenStateId).toBe('done');
    expect(next.emittedActions).toEqual(['continue']);
  });

  it('reports deterministic IR/token/state quality issues', () => {
    const bad = { ...screen, quality: { requiredStateIds: ['missing'], requireTokenReferences: true } } satisfies ScreenSpec;
    const ir = compileScreenToDesignIR(bad, components);
    const issues = inspectDesignIR(ir, bad, tokens);
    expect(issues.some((issue) => issue.rule === 'required-screen-state')).toBe(true);
    expect(issues.some((issue) => issue.rule === 'interactive-preview-action')).toBe(false);
  });
});
