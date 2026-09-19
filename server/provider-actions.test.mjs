import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectStore } from './project-store.mjs';
import { executeProviderAction, providerActions } from './provider-actions.mjs';

const cleanupRoots = [];
afterEach(async () => {
  await Promise.all(cleanupRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'forge-design-provider-'));
  cleanupRoots.push(root);
  const workspaceRoot = join(root, 'workspace');
  const projectRoot = join(workspaceRoot, 'fixture');
  const store = new ProjectStore({ workspaceRoot, externalRoots: [], registryPath: join(root, 'projects.json') });
  await store.initProject({ projectRoot, id: 'fixture', name: 'Fixture' });
  return { root, projectRoot, store };
}

describe('Forge provider granular design actions', () => {
  it('keeps provider, static manifest, and install registration action inventories aligned', async () => {
    const manifest = JSON.parse(await readFile(new URL('../forge-plugin.json', import.meta.url), 'utf8'));
    const packageDocument = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    expect(manifest.actions).toEqual(providerActions);
    expect(manifest.version).toBe(packageDocument.version);
    const output = execFileSync(process.execPath, [new URL('../forge-plugin-install.mjs', import.meta.url).pathname], { encoding: 'utf8' });
    const registration = JSON.parse(output).registration;
    expect(registration.pluginVersion).toBe(packageDocument.version);
    expect(registration.actions.map((action) => action.actionId)).toEqual(providerActions);
    const providerOutput = execFileSync(process.execPath, [new URL('../scripts/forge-provider.mjs', import.meta.url).pathname], { encoding: 'utf8', input: `${JSON.stringify({ schemaVersion: 1, type: 'execute', requestId: 'manifest-test', actionId: 'manifest', input: {} })}\n` });
    const providerLines = providerOutput.trim().split(/\r?\n/).map((line) => JSON.parse(line));
    const providerManifest = providerLines.find((line) => line.type === 'result')?.result;
    expect(providerManifest.version).toBe(packageDocument.version);
    const putScreen = registration.actions.find((action) => action.actionId === 'design_put_screen');
    expect(putScreen.argumentsSchema.properties.screen.required).toContain('nodes');
    const putFlow = registration.actions.find((action) => action.actionId === 'design_put_product_flow');
    expect(putFlow.argumentsSchema.properties.flow.required).toContain('id');
    expect(putFlow.argumentsSchema.properties.flow.properties.transitions.type).toBe('array');
    const putArtboard = registration.actions.find((action) => action.actionId === 'design_put_artboard');
    expect(putArtboard.argumentsSchema.required).toEqual(['project_id', 'unit_id', 'screen_id', 'state_id', 'profile_id', 'svg']);
    expect(putArtboard.argumentsSchema).not.toHaveProperty('properties.path');
    const acceptUnit = registration.actions.find((action) => action.actionId === 'design_accept_unit');
    expect(acceptUnit).toMatchObject({ confirmation: 'strong_confirmation', requiredConfirmationText: 'accept-design-unit' });
    const freezeProject = registration.actions.find((action) => action.actionId === 'design_freeze_project');
    expect(freezeProject).toMatchObject({ confirmation: 'strong_confirmation', requiredConfirmationText: 'freeze-design-project' });
  });

  it('reads repository-native assets without accepting path-shaped targets', async () => {
    const { store } = await fixture();
    const screen = await executeProviderAction(store, 'design_get_screen', { project_id: 'fixture', screen_id: 'home' });
    expect(screen.id).toBe('home');
    const units = await executeProviderAction(store, 'design_get_design_units', { project_id: 'fixture' });
    expect(units.units[0].screenIds).toContain('home');
    const review = await executeProviderAction(store, 'design_get_review_status', { project_id: 'fixture' });
    expect(review.units[0]).toMatchObject({ unitId: 'primary', reviewStatus: 'draft', acceptanceCurrent: false });
    const tokens = await executeProviderAction(store, 'design_get_tokens', { project_id: 'fixture' });
    expect(tokens.schemaVersion).toBe(1);
  });

  it('writes a canonical SVG artboard through semantic identities rather than a repository path', async () => {
    const { store, projectRoot } = await fixture();
    const result = await executeProviderAction(store, 'design_put_artboard', {
      project_id: 'fixture',
      unit_id: 'primary',
      screen_id: 'home',
      state_id: 'normal',
      profile_id: 'standard-light',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 393 852"><rect width="393" height="852" fill="#fff"/></svg>',
    });
    expect(result.asset.binding).toEqual({ designUnitId: 'primary', screenId: 'home', stateId: 'normal', profileId: 'standard-light' });
    expect(await readFile(join(projectRoot, '.design-harness', 'artboards', 'primary', 'home', 'normal', 'standard-light.svg'), 'utf8')).toContain('<svg');
  });

  it('updates one Product Flow through canonical product.json and preserves unrelated product fields', async () => {
    const { store } = await fixture();
    const before = await store.getProductModel('fixture');
    const flow = {
      id: 'secondary-flow',
      name: 'Secondary flow',
      userJob: 'Exercise granular provider flow writes.',
      screenIds: ['home'],
      entry: { screenId: 'home', stateId: 'normal' },
      transitions: [],
      status: 'draft',
    };
    const written = await executeProviderAction(store, 'design_put_product_flow', { project_id: 'fixture', flow_id: flow.id, flow });
    expect(written).toEqual(flow);
    const after = await store.getProductModel('fixture');
    expect(after.flows).toContainEqual(flow);
    expect(after.brief).toEqual(before.brief);
    expect(after.golden).toEqual(before.golden);
  });

  it('fails closed when explicit resource identity disagrees with the document identity', async () => {
    const { store } = await fixture();
    const screen = await store.getScreen('fixture', 'home');
    await expect(executeProviderAction(store, 'design_put_screen', { project_id: 'fixture', screen_id: 'other', screen })).rejects.toMatchObject({ code: 'SCREEN_ID_MISMATCH' });
    const product = await store.getProductModel('fixture');
    await expect(executeProviderAction(store, 'design_put_product_flow', { project_id: 'fixture', flow_id: 'other', flow: product.flows[0] })).rejects.toMatchObject({ code: 'PRODUCT_FLOW_ID_MISMATCH' });
  });
});
