import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectStore } from '../server/project-store.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const errors = [];
const duplicateCanonicalFiles = ['src/design-system/tokens.json', 'src/data/screens.ts'];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

for (const path of duplicateCanonicalFiles) {
  if (await exists(join(root, path))) errors.push(`${path} duplicates canonical repository assets; remove it.`);
}

const store = createProjectStore({ workspaceRoot: join(root, 'workspace'), externalRoots: [] });
try {
  const projects = await store.listProjects();
  if (!projects.some((project) => project.id === 'metronome')) errors.push('Tracked metronome design project was not discovered.');
  const validation = await store.validateProject('metronome');
  errors.push(...validation.errors.map((error) => `workspace/metronome: ${error}`));
  const context = await store.getContext('metronome');
  for (const component of context.components.components) {
    if (!component.preview?.nodes?.length) errors.push(`workspace/metronome component ${component.name} must use declarative preview composition.`);
  }
} catch (error) {
  errors.push(`Unable to validate tracked design assets: ${error.message}`);
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory)) {
    const path = join(directory, entry);
    const info = await stat(path);
    if (info.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const mockScreenSource = await readFile(join(root, 'src/components/MockScreen.tsx'), 'utf8');
for (const businessRendererName of ['BPMControllerNode', 'BeatTrajectoryNode', 'PracticeSummaryNode']) {
  if (mockScreenSource.includes(businessRendererName)) errors.push(`src/components/MockScreen.tsx contains business-specific renderer ${businessRendererName}; use project declarative preview contracts instead.`);
}

for (const file of await walk(join(root, 'src'))) {
  if (!/\.(css|ts|tsx)$/.test(file)) continue;
  const content = await readFile(file, 'utf8');
  const rawColors = content.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? [];
  if (rawColors.length) {
    errors.push(`${relative(root, file)} contains raw colors; add semantic tokens instead: ${[...new Set(rawColors)].join(', ')}`);
  }
  if (/\.(ts|tsx)$/.test(file)) {
    const inlinePixels = content.match(/(?:padding|margin|gap|borderRadius|width|height):\s*['"]?\d+px/g) ?? [];
    if (inlinePixels.length) errors.push(`${relative(root, file)} contains inline pixel styling; use tokens or CSS classes.`);
  }
}

if (errors.length) {
  console.error('Design-system validation failed:\n' + errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log('Design-system validation passed (repository-native .design-harness assets).');
