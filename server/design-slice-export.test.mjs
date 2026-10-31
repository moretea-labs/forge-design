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
