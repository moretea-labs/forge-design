import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DesignStoreError, ProjectStore, validateProductModel, validateScreen, validateTokens } from './project-store.mjs';
import { parseDesignMarkdown, renderDesignMarkdown } from './design-markdown.mjs';

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'design-harness-'));
  const workspaceRoot = join(root, 'workspace');
  const projectRoot = join(workspaceRoot, 'fixture');
  const store = new ProjectStore({
    workspaceRoot,
    externalRoots: [],
    registryPath: join(root, 'projects.local.json'),
  });
  await store.initProject({ projectRoot, id: 'fixture', name: 'Fixture' });
  return { root, projectRoot, store };
}

describe('ProjectStore', () => {
  it('discovers, reads, and atomically updates repository-owned assets', async () => {
    const { store, projectRoot } = await createFixture();
    expect((await store.listProjects()).map((project) => project.id)).toEqual(['fixture']);
    const tokens = await store.getTokens('fixture');
    tokens.meta.version = '0.2.0';
    await store.putTokens('fixture', tokens);
    expect((await store.getTokens('fixture')).meta.version).toBe('0.2.0');
    const persisted = JSON.parse(await readFile(join(projectRoot, '.design-harness', 'tokens.json'), 'utf8'));
    expect(persisted.meta.version).toBe('0.2.0');
  });

  it('rejects unsafe ids and duplicate node ids', async () => {
    const { store } = await createFixture();
    await expect(store.getScreen('fixture', '../secret')).rejects.toMatchObject({ code: 'UNSAFE_ID' });
    expect(() => validateScreen({
      schemaVersion: 1,
      id: 'broken',
      name: 'Broken',
      device: 'iphone-16-pro',
      goal: 'Test',
      primaryAction: 'continue',
      constraints: [],
      nodes: [
        { id: 'same', component: 'EmptyState' },
        { id: 'same', component: 'PrimaryAction' },
      ],
    }, 'broken')).toThrow(DesignStoreError);
  });

  it('rejects a screen filename/document id mismatch', async () => {
    const { store, projectRoot } = await createFixture();
    const path = join(projectRoot, '.design-harness', 'screens', 'home.json');
    const document = JSON.parse(await readFile(path, 'utf8'));
    document.id = 'different';
    await writeFile(path, JSON.stringify(document), 'utf8');
    await expect(store.getScreen('fixture', 'home')).rejects.toMatchObject({ code: 'SCREEN_ID_MISMATCH' });
  });
});


describe('ProjectStore creation semantics', () => {
  it('does not let create overwrite an existing independent screen file', async () => {
    const { store } = await createFixture();
    const home = await store.getScreen('fixture', 'home');
    await expect(store.createScreen('fixture', home)).rejects.toMatchObject({ code: 'SCREEN_ALREADY_EXISTS' });
  });
});


describe('ProjectStore storage migration and design units', () => {
  it('initializes storageVersion 1.1.0 with canonical design units', async () => {
    const { store, projectRoot } = await createFixture();
    expect((await store.getManifest('fixture')).storageVersion).toBe('1.1.0');
    const units = await store.getDesignUnits('fixture');
    expect(units.units).toEqual([expect.objectContaining({ id: 'primary', screenIds: ['home'] })]);
    const persisted = JSON.parse(await readFile(join(projectRoot, '.design-harness', 'design-units.json'), 'utf8'));
    expect(persisted).toEqual(units);
  });

  it('reads storageVersion 1.0.0 without mutating it, then migrates explicitly', async () => {
    const { store, projectRoot } = await createFixture();
    const harness = join(projectRoot, '.design-harness');
    const manifestPath = join(harness, 'project.json');
    const designUnitsPath = join(harness, 'design-units.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.storageVersion = '1.0.0';
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    await rm(designUnitsPath);

    const context = await store.getContext('fixture');
    expect(context.storage).toMatchObject({ storageVersion: '1.0.0', currentStorageVersion: '1.1.0', migrationRequired: true });
    expect(context.designUnits.units[0]).toMatchObject({ id: 'legacy-default', screenIds: ['home'] });
    await expect(readFile(designUnitsPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(store.putDesignUnits('fixture', context.designUnits)).rejects.toMatchObject({ code: 'STORAGE_MIGRATION_REQUIRED' });

    const migration = await store.migrateProjectStorage('fixture');
    expect(migration).toMatchObject({ changed: true, fromVersion: '1.0.0', toVersion: '1.1.0' });
    expect((await store.getManifest('fixture')).storageVersion).toBe('1.1.0');
    expect(JSON.parse(await readFile(designUnitsPath, 'utf8'))).toEqual(context.designUnits);
    expect((await store.getContext('fixture')).storage.migrationRequired).toBe(false);
  });

  it('reports design units that reference unknown screens', async () => {
    const { store } = await createFixture();
    const units = await store.getDesignUnits('fixture');
    units.units[0].screenIds.push('missing-screen');
    await store.putDesignUnits('fixture', units);
    const validation = await store.validateProject('fixture');
    expect(validation.ok).toBe(false);
    expect(validation.errors.join(' ')).toContain('references unknown screen missing-screen');
  });
});

describe('ProjectStore initialization safety', () => {
  it('publishes one complete storage directory without leaving temporary siblings', async () => {
    const { projectRoot, store } = await createFixture();
    const entries = await readdir(projectRoot);
    expect(entries).toEqual(['.design-harness']);
    await expect(store.initProject({ projectRoot, id: 'fixture', name: 'Fixture' })).rejects.toMatchObject({ code: 'PROJECT_ALREADY_INITIALIZED' });
  });

  it('rejects invalid device token values before persistence', () => {
    expect(() => validateTokens({
      schemaVersion: 1,
      meta: { name: 'Invalid', version: '0.1.0' },
      color: { canvas: '#000000' },
      spacing: { sm: 8 },
      radius: { sm: 8 },
      shadow: { card: 'none' },
      typography: { body: { size: 14, lineHeight: 20, weight: 400 } },
      device: { iphoneWidth: 0, iphoneHeight: 852, safeTop: 54, safeBottom: 30 },
    })).toThrow(DesignStoreError);
  });
});


describe('ProjectStore local project registry', () => {
  it('registers and discovers an external repository without environment variables', async () => {
    const root = await mkdtemp(join(tmpdir(), 'design-harness-registry-'));
    const projectRoot = join(root, 'external-project');
    const registryPath = join(root, 'projects.local.json');
    const store = new ProjectStore({
      workspaceRoot: join(root, 'workspace'),
      externalRoots: [],
      registryPath,
    });

    await store.initProject({ projectRoot, id: 'external', name: 'External' });
    expect(await store.getRegisteredProjectRoots()).toEqual([]);

    const registration = await store.registerProjectRoot(projectRoot);
    expect(registration.manifest.id).toBe('external');
    expect(await store.getRegisteredProjectRoots()).toEqual([projectRoot]);
    expect((await store.listProjects()).map((project) => project.id)).toEqual(['external']);

    const persisted = JSON.parse(await readFile(registryPath, 'utf8'));
    expect(persisted).toEqual({ schemaVersion: 1, projectRoots: [projectRoot] });

    await store.unregisterProjectRoot(projectRoot);
    expect(await store.getRegisteredProjectRoots()).toEqual([]);
    expect(await store.listProjects()).toEqual([]);
  });

  it('refuses to register a repository without canonical design assets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'design-harness-registry-invalid-'));
    const store = new ProjectStore({
      workspaceRoot: join(root, 'workspace'),
      externalRoots: [],
      registryPath: join(root, 'projects.local.json'),
    });
    await expect(store.registerProjectRoot(join(root, 'missing'))).rejects.toMatchObject({ code: 'DESIGN_PROJECT_NOT_INITIALIZED' });
  });
});

describe('ProjectStore product-design model', () => {
  it('initializes a canonical Product Contract and exposes Golden gate state in context', async () => {
    const { store, projectRoot } = await createFixture();
    const productPath = join(projectRoot, '.design-harness', 'product.json');
    const persisted = JSON.parse(await readFile(productPath, 'utf8'));
    expect(() => validateProductModel(persisted)).not.toThrow();
    const context = await store.getContext('fixture');
    expect(context.product?.brief.userJob).toContain('primary user job');
    expect(context.goldenGate).toMatchObject({ modeled: true, status: 'draft', flowReady: false, runtimeReviewStage: 'not_started', canApprove: false });
  });

  it('keeps legacy visual-only projects readable but blocks Golden promotion', async () => {
    const { store, projectRoot } = await createFixture();
    await rm(join(projectRoot, '.design-harness', 'product.json'));
    const context = await store.getContext('fixture');
    expect(context.product).toBeNull();
    expect(context.goldenGate).toMatchObject({ modeled: false, status: 'unmodeled', canApprove: false });
    const validation = await store.validateProject('fixture');
    expect(validation.ok).toBe(true);
    expect(validation.warnings.join(' ')).toContain('legacy visual-only');
  });

  it('does not equate screenshot capture with model-visible or visual review', async () => {
    const { store } = await createFixture();
    const product = await store.getProductModel('fixture');
    product.brief.status = 'ready';
    product.flows[0].status = 'validated';
    product.golden.status = 'approved';
    product.golden.review = { stage: 'captured', userDecision: 'accepted', artifactRefs: ['controller-artifacts/screenshot.png'], notes: [] };
    await store.putProductModel('fixture', product);
    const validation = await store.validateProject('fixture');
    expect(validation.ok).toBe(false);
    expect(validation.goldenGate.runtimeEvidenceReady).toBe(true);
    expect(validation.goldenGate.runtimeReviewStage).toBe('captured');
    expect(validation.goldenGate.canApprove).toBe(false);
    expect(validation.errors.join(' ')).toContain('Captured is not Model Visible or Visual Reviewed');
  });

  it('requires flow validation, runtime evidence, visual review, and user acceptance before Approved Golden', async () => {
    const { store } = await createFixture();
    const product = await store.getProductModel('fixture');
    product.brief.status = 'ready';
    product.flows[0].status = 'validated';
    product.golden.status = 'approved';
    product.golden.review = { stage: 'visual_reviewed', userDecision: 'accepted', artifactRefs: ['controller-artifacts/review.png'], notes: ['Reviewed rendered output.'] };
    await store.putProductModel('fixture', product);
    const validation = await store.validateProject('fixture');
    expect(validation.ok).toBe(true);
    expect(validation.goldenGate).toMatchObject({ productContractReady: true, flowReady: true, runtimeEvidenceReady: true, runtimeReviewStage: 'visual_reviewed', userDecision: 'accepted', canApprove: true });
  });

  it('requires sibling evidence before an Interaction Pattern can participate in Approved Golden', async () => {
    const { store } = await createFixture();
    const product = await store.getProductModel('fixture');
    product.brief.status = 'ready';
    product.flows[0].status = 'validated';
    product.patterns = [{ id: 'filter-selection', name: 'Filter Selection', semanticPurpose: 'Select a result subset rather than toggle a setting.', status: 'approved', validatedFlowIds: ['primary-flow'], siblingEvidence: [] }];
    product.brief.interactionModel[0].patternId = 'filter-selection';
    product.golden.patternIds = ['filter-selection'];
    product.golden.status = 'approved';
    product.golden.review = { stage: 'visual_reviewed', userDecision: 'accepted', artifactRefs: ['controller-artifacts/review.png'], notes: [] };
    await store.putProductModel('fixture', product);
    let validation = await store.validateProject('fixture');
    expect(validation.ok).toBe(false);
    expect(validation.goldenGate.interactionPatternsReady).toBe(false);
    product.patterns[0].siblingEvidence = ['settings-filter-sibling'];
    await store.putProductModel('fixture', product);
    validation = await store.validateProject('fixture');
    expect(validation.ok).toBe(true);
    expect(validation.goldenGate.interactionPatternsReady).toBe(true);
  });
});

describe('ProjectStore design.md transport', () => {
  it('round-trips the canonical Design Model through deterministic Markdown and imports validated edits', async () => {
    const { store } = await createFixture();
    const exported = await store.exportDesignMarkdown('fixture');
    expect(exported).toContain('<!-- design-harness-format:2 -->');
    expect(exported).toContain('```json design-harness:project');
    expect(exported).toContain('```json design-harness:product');
    expect(exported).toContain('```json design-harness:design-units');
    expect(exported).toContain('```json design-harness:screen:home');

    const bundle = parseDesignMarkdown(exported);
    bundle.project.designSystem.version = '0.2.0';
    bundle.product.brief.productGoal = 'Edited through deterministic design.md transport.';
    bundle.designUnits.units[0].name = 'Edited Design Unit';
    bundle.tokens.meta.version = '0.2.0';
    const edited = renderDesignMarkdown(bundle);
    const result = await store.importDesignMarkdown('fixture', edited);

    expect(result).toMatchObject({ schemaVersion: 1, projectId: 'fixture', mode: 'merge', importedScreenIds: ['home'] });
    expect((await store.getManifest('fixture')).designSystem.version).toBe('0.2.0');
    expect((await store.getTokens('fixture')).meta.version).toBe('0.2.0');
    expect((await store.getProductModel('fixture')).brief.productGoal).toContain('Edited through deterministic');
    expect((await store.getDesignUnits('fixture')).units[0].name).toBe('Edited Design Unit');
    expect(await store.exportDesignMarkdown('fixture')).toBe(edited);
  });

  it('parses legacy format v1 without design-units and preserves current design units on import', async () => {
    const { store } = await createFixture();
    const beforeUnits = await store.getDesignUnits('fixture');
    let legacy = await store.exportDesignMarkdown('fixture');
    legacy = legacy.replace('<!-- design-harness-format:2 -->', '<!-- design-harness-format:1 -->');
    legacy = legacy.replace(/\n## Design Units\n\n```json design-harness:design-units\n[\s\S]*?\n```/, '');
    const parsed = parseDesignMarkdown(legacy);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.designUnits).toBeNull();
    await store.importDesignMarkdown('fixture', legacy);
    expect(await store.getDesignUnits('fixture')).toEqual(beforeUnits);
  });

  it('fails before persistence when design.md attempts to change project identity', async () => {
    const { store } = await createFixture();
    const before = await store.getManifest('fixture');
    const bundle = parseDesignMarkdown(await store.exportDesignMarkdown('fixture'));
    bundle.project.id = 'other-project';

    await expect(store.importDesignMarkdown('fixture', renderDesignMarkdown(bundle))).rejects.toMatchObject({
      code: 'DESIGN_MARKDOWN_PROJECT_ID_MISMATCH',
    });
    expect(await store.getManifest('fixture')).toEqual(before);
  });
});

describe('ProjectStore screen state and transition flow semantics', () => {
  it('rejects a screen whose declared initial state does not exist', () => {
    expect(() => validateScreen({
      schemaVersion: 1,
      id: 'stateful',
      name: 'Stateful',
      device: 'iphone-16-pro',
      goal: 'Exercise state validation.',
      primaryAction: 'continue',
      constraints: [],
      nodes: [{ id: 'action', component: 'PrimaryAction' }],
      initialStateId: 'missing',
      states: [{ id: 'normal', name: 'Normal', meaning: 'Default state.' }],
    }, 'stateful')).toThrow(DesignStoreError);
  });

  it('rejects transition targets that reference an unknown screen state', async () => {
    const { store } = await createFixture();
    const product = await store.getProductModel('fixture');
    product.flows[0].entry = { screenId: 'home', stateId: 'normal' };
    product.flows[0].transitions = [{
      id: 'continue',
      from: { screenId: 'home', stateId: 'normal' },
      trigger: { interactionId: 'primary-action', event: 'tap' },
      commitBoundary: { kind: 'none' },
      result: 'Continue the flow.',
      to: { screenId: 'home', stateId: 'missing' },
    }];
    await store.putProductModel('fixture', product);
    const validation = await store.validateProject('fixture');
    expect(validation.ok).toBe(false);
    expect(validation.errors.join(' ')).toContain('unknown state missing');
  });

  it('does not treat a legacy screenIds-only flow as Golden-ready', async () => {
    const { store } = await createFixture();
    const product = await store.getProductModel('fixture');
    product.brief.status = 'ready';
    product.flows[0].status = 'validated';
    delete product.flows[0].entry;
    delete product.flows[0].transitions;
    product.golden.status = 'approved';
    product.golden.review = { stage: 'visual_reviewed', userDecision: 'accepted', artifactRefs: ['controller-artifacts/review.png'], notes: [] };
    await store.putProductModel('fixture', product);
    const validation = await store.validateProject('fixture');
    expect(validation.goldenGate.flowReady).toBe(false);
    expect(validation.goldenGate.canApprove).toBe(false);
    expect(validation.goldenGate.blockers.join(' ')).toContain('transition graph');
  });
});
