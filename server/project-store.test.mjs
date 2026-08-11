import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DesignStoreError, ProjectStore, validateScreen, validateTokens } from './project-store.mjs';
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

describe('ProjectStore design.md transport', () => {
  it('round-trips the canonical Design Model through deterministic Markdown and imports validated edits', async () => {
    const { store } = await createFixture();
    const exported = await store.exportDesignMarkdown('fixture');
    expect(exported).toContain('<!-- design-harness-format:1 -->');
    expect(exported).toContain('```json design-harness:project');
    expect(exported).toContain('```json design-harness:screen:home');

    const bundle = parseDesignMarkdown(exported);
    bundle.project.designSystem.version = '0.2.0';
    bundle.tokens.meta.version = '0.2.0';
    const edited = renderDesignMarkdown(bundle);
    const result = await store.importDesignMarkdown('fixture', edited);

    expect(result).toMatchObject({ schemaVersion: 1, projectId: 'fixture', mode: 'merge', importedScreenIds: ['home'] });
    expect((await store.getManifest('fixture')).designSystem.version).toBe('0.2.0');
    expect((await store.getTokens('fixture')).meta.version).toBe('0.2.0');
    expect(await store.exportDesignMarkdown('fixture')).toBe(edited);
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
