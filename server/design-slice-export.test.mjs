import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exportDesignModule, listDesignModules, readDesignModulePreview } from './design-slice-export.mjs';

const directories = [];
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'forge-design-module-'));
  directories.push(root);
  const storagePath = join(root, '.design-harness');
  await mkdir(storagePath);
  return { root, storagePath, manifest: { name: 'Fixture' } };
}
async function catalog(project, modules) {
  await writeFile(join(project.storagePath, 'modules.json'), JSON.stringify({ schemaVersion: 1, modules }));
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

describe('project-owned design module handoff', () => {
  it('treats projects without a module catalog as empty', async () => {
    expect(await listDesignModules(await fixture())).toEqual([]);
  });

  it('exports only the selected source files, without modifying the repository', async () => {
    const project = await fixture();
    await mkdir(join(project.root, 'src'));
    await writeFile(join(project.root, 'src', 'followup.tsx'), 'export const Followup = () => <main>Record & Follow-up</main>;\n');
    await writeFile(join(project.root, 'src', 'other.tsx'), 'DO_NOT_INCLUDE');
    await catalog(project, [
      { id: 'followup', name: 'Record / Follow-up', description: 'Candidate only.', files: ['src/followup.tsx'] },
      { id: 'other', name: 'Other', files: ['src/other.tsx'] },
    ]);
    const result = await exportDesignModule(project, 'followup');
    expect(result).toContain('export const Followup');
    expect(result).toContain('Candidate only.');
    expect(result).not.toContain('DO_NOT_INCLUDE');
    expect(await listDesignModules(project)).toHaveLength(2);
  });

  it('blocks parent traversal and symlink escapes from the project root', async () => {
    const project = await fixture();
    await catalog(project, [{ id: 'bad', name: 'Bad', files: ['../outside.tsx'] }]);
    await expect(exportDesignModule(project, 'bad')).rejects.toThrow(/forbidden segment/);
    await mkdir(join(project.root, 'src'));
    await symlink(join(tmpdir(), 'outside.tsx'), join(project.root, 'src', 'escape.tsx'));
    await catalog(project, [{ id: 'escape', name: 'Escape', files: ['src/escape.tsx'] }]);
    await expect(exportDesignModule(project, 'escape')).rejects.toThrow();
  });

  it('serves only explicit preview entry and bounded assets', async () => {
    const project = await fixture();
    await mkdir(join(project.root, 'preview', 'assets'), { recursive: true });
    await writeFile(join(project.root, 'preview', 'prototype.html'), '<div>ok</div>');
    await writeFile(join(project.root, 'preview', 'assets', 'prototype.js'), 'console.log("ok")');
    await writeFile(join(project.root, 'preview', 'other.html'), 'must be blocked');
    await writeFile(join(project.root, 'src.tsx'), 'export default null');
    await catalog(project, [{ id: 'followup', name: 'Followup', files: ['src.tsx'], preview: { entry: 'preview/prototype.html', screenId: 'followup-home' } }]);
    const entry = await readDesignModulePreview(project, 'followup', 'prototype.html');
    expect(entry.mediaType).toContain('text/html');
    expect(String(entry.bytes)).toContain('ok');
    expect((await readDesignModulePreview(project, 'followup', 'assets/prototype.js')).mediaType).toContain('javascript');
    await expect(readDesignModulePreview(project, 'followup', 'other.html')).rejects.toThrow(/Only the declared/);
  });
});

describe('single-source Studio page registration', () => {
  it('derives all states in the same family from the source SCREENS catalog without duplicating ids', async () => {
    const project = await fixture();
    await mkdir(join(project.root, 'design', 'dist'), { recursive: true });
    await mkdir(join(project.root, 'design', 'src'), { recursive: true });
    await writeFile(join(project.root, 'design/src/main.tsx'), [
      'const SCREENS = [',
      " { id: 'd4-followup-workspace', collection: 'v2-followup', kind: 'candidate', name: 'Follow-up · Home', badge: 'Review' },",
      " { id: 'd4-followup-error', collection: 'v2-followup', kind: 'candidate', name: 'Follow-up · Error', badge: 'State' },",
      " { id: 'd5-data-home', collection: 'v2-data', kind: 'candidate', name: 'Data · Home', badge: 'Review' },",
      '] as const;',
    ].join('\n'));
    await writeFile(join(project.root, 'design/dist/prototype.html'), '<main></main>');
    await writeFile(join(project.root, 'sample.tsx'), 'export const screen = true');
    await catalog(project, [{ id: 'followup', name: 'Follow-up', files: ['sample.tsx'], preview: { entry: 'design/dist/prototype.html', screenId: 'd4-followup-workspace' } }]);
    const [module] = await listDesignModules(project);
    expect(module.screens.map(screen => screen.id)).toEqual(['d4-followup-workspace', 'd4-followup-error']);
    expect((await listDesignModules(project, { includeScreens: false }))[0].screens).toBeUndefined();
  });
});

describe('derived historical gallery', () => {
  it('exposes all unassigned registered screens once, without granting an export authority', async () => {
    const project = await fixture();
    await mkdir(join(project.root, 'design/src'), { recursive: true });
    await writeFile(join(project.root, 'design/src/main.tsx'), [
      'const SCREENS = [',
      " { id: 'current-home', collection: 'current', kind: 'candidate', name: 'Current' },",
      " { id: 'reference-home', collection: 'reference', kind: 'historical', name: 'Reference' },",
      " { id: 'reference-error', collection: 'reference', kind: 'historical', name: 'Reference Error' },",
      '] as const;',
    ].join('\n'));
    await writeFile(join(project.root, 'screen.tsx'), 'export const Screen = true;');
    await catalog(project, [{ id: 'current', name: 'Current', files: ['screen.tsx'], preview: { entry: 'design/dist/prototype.html', screenId: 'current-home' } }]);
    const modules = await listDesignModules(project);
    expect(modules).toHaveLength(2);
    expect(modules[1].id).toBe('historical-candidates');
    expect(modules[1].readOnly).toBe(true);
    expect(modules[1].previewModuleId).toBe('current');
    expect(modules.flatMap(module => module.screens.map(screen => screen.id))).toEqual(['current-home', 'reference-home', 'reference-error']);
    await expect(exportDesignModule(project, 'historical-candidates')).rejects.toThrow(/Design module not found/);
  });
});
