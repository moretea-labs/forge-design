import { readFile, realpath } from 'node:fs/promises';
import { join, resolve, relative, sep, extname, dirname } from 'node:path';

const MAX_FILES = 24;
const MAX_BYTES = 6 * 1024 * 1024;
const SOURCE_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js', '.css', '.scss', '.json', '.md', '.swift']);
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const PREVIEW_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };

export class ModuleExportError extends Error {
  constructor(message, status = 400, code = 'MODULE_EXPORT_INVALID') {
    super(message);
    this.name = 'ModuleExportError';
    this.status = status;
    this.code = code;
  }
}

function safeFilePath(path, extensions = SOURCE_EXTENSIONS) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\\')) {
    throw new ModuleExportError('Module source paths must be repository-relative.');
  }
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || part === 'node_modules' || part === '.git')) {
    throw new ModuleExportError('Module source path contains a forbidden segment.');
  }
  if (!extensions.has(extname(path).toLowerCase())) {
    throw new ModuleExportError('Module source file type is not supported.');
  }
  return path;
}

function validateModule(module) {
  if (!module || !ID_PATTERN.test(module.id ?? '') || typeof module.name !== 'string' || !module.name.trim()) {
    throw new ModuleExportError('Module must have a valid id and name.');
  }
  if (!Array.isArray(module.files) || module.files.length === 0 || module.files.length > MAX_FILES) {
    throw new ModuleExportError('Module must contain 1–24 explicit files.');
  }
  const files = module.files.map(path => safeFilePath(path));
  if (new Set(files).size !== files.length) throw new ModuleExportError('Duplicate module source file.');
  const preview = module.preview === undefined ? null : module.preview;
  if (preview !== null && (!preview || typeof preview !== 'object' || typeof preview.screenId !== 'string' || !ID_PATTERN.test(preview.screenId))) {
    throw new ModuleExportError('Invalid module preview binding.');
  }
  const previewEntry = preview ? safeFilePath(preview.entry, new Set(['.html'])) : null;
  return { id: module.id, name: module.name, files, description: typeof module.description === 'string' ? module.description : '', ...(previewEntry ? { preview: { entry: previewEntry, screenId: preview.screenId } } : {}) };
}

// The project's existing static SCREENS registration is the sole source of page IDs.
// Parse literal registration lines; never import or execute project TSX in the Studio server.
export function readStaticScreenRegistry(source) {
  const start = source.indexOf('const SCREENS = [');
  const closing = start < 0 ? null : source.slice(start).match(/\n\]\s*(?:as const)?\s*;/);
  const end = closing ? start + closing.index : -1;
  if (end < 0) throw new ModuleExportError('Static SCREENS catalog is unavailable.');
  const screens = [];
  for (const line of source.slice(start, end).split('\n')) {
    const id = line.match(/^\s*\{\s*id:\s*'([a-z0-9_-]+)'/);
    if (!id) continue;
    const collection = line.match(/,\s*collection:\s*(?:'([^']+)'|([A-Za-z_][A-Za-z_0-9]*))/);
    const name = line.match(/,\s*name:\s*'([^']+)'/);
    const badge = line.match(/,\s*badge:\s*'([^']+)'/);
    const kind = line.match(/,\s*kind:\s*'([^']+)'/);
    if (collection && name) screens.push({ id: id[1], name: name[1], collection: collection[1] ?? collection[2], badge: badge?.[1] ?? '', kind: kind?.[1] ?? 'candidate' });
  }
  if (!screens.length || screens.length > 2000 || new Set(screens.map(screen => screen.id)).size !== screens.length) throw new ModuleExportError('Invalid or empty static screen registry.');
  return screens;
}

export async function listDesignModules(project, { includeScreens = true } = {}) {
  const manifest = join(project.storagePath, 'modules.json');
  let document;
  try {
    document = JSON.parse(await readFile(manifest, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new ModuleExportError('Unable to read project module catalog: ' + error.message);
  }
  if (document.schemaVersion !== 1 || !Array.isArray(document.modules) || document.modules.length > 64) {
    throw new ModuleExportError('Invalid project-owned modules.json catalog.');
  }
  const modules = document.modules.map(validateModule);
  if (new Set(modules.map(module => module.id)).size !== modules.length) throw new ModuleExportError('Duplicate module id.');
  if (!includeScreens) return modules;
  const preview = modules.find(module => module.preview)?.preview;
  const catalogPath = document.screenCatalog ?? (preview ? join(dirname(dirname(preview.entry)), 'src/main.tsx') : null);
  let registry = [];
  if (catalogPath) {
    try {
      registry = readStaticScreenRegistry(await readBoundedProjectFile(project, safeFilePath(catalogPath, new Set(['.tsx', '.ts']))));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const grouped = modules.map(module => {
    const sourceScreen = registry.find(screen => screen.id === module.preview?.screenId);
    const screens = sourceScreen ? registry.filter(screen => screen.collection === sourceScreen.collection) : [];
    return { ...module, screens: screens.length ? screens : module.preview ? [{ id: module.preview.screenId, name: module.name, badge: 'Preview', kind: 'candidate' }] : [] };
  });
  // Read-only remainder from the same source registry, never a second list of page IDs.
  const coveredIds = new Set(grouped.flatMap(module => module.screens.map(screen => screen.id)));
  const unassigned = registry.filter(screen => !coveredIds.has(screen.id));
  const previewHost = modules.find(module => module.preview);
  if (unassigned.length && previewHost) {
    grouped.push({
      id: 'historical-candidates', name: '其他参考与历史候选', description: '源自项目页面注册表的历史参考和视觉实验，只用于对照；不是当前 V2 已验收页面。',
      files: [], preview: previewHost.preview, previewModuleId: previewHost.id, readOnly: true, screens: unassigned,
    });
  }
  return grouped;
}

async function readBoundedProjectFile(project, path) {
  const root = await realpath(project.root);
  const file = await realpath(resolve(root, safeFilePath(path)));
  const within = relative(root, file);
  if (!within || within.startsWith('..' + sep) || within === '..' || within.startsWith(sep)) {
    throw new ModuleExportError('Module path resolves outside the registered project.', 403, 'MODULE_PATH_OUTSIDE_PROJECT');
  }
  const content = await readFile(file);
  if (content.length > MAX_BYTES) throw new ModuleExportError('Module file exceeds size limit.', 413, 'MODULE_TOO_LARGE');
  return content.toString('utf8');
}

function fence(content) {
  const tick = String.fromCharCode(96);
  const runs = content.match(new RegExp(tick + '+', 'g')) ?? [];
  return tick.repeat(Math.max(3, ...runs.map(run => run.length + 1)));
}

export async function readDesignModulePreview(project, moduleId, assetPath) {
  const module = (await listDesignModules(project, { includeScreens: false })).find(item => item.id === moduleId);
  if (!module?.preview) throw new ModuleExportError('Module has no registered preview.', 404, 'MODULE_PREVIEW_NOT_FOUND');
  const asset = safeFilePath(assetPath, new Set(Object.keys(PREVIEW_TYPES)));
  if (asset !== module.preview.entry.split('/').at(-1) && !asset.startsWith('assets/')) {
    throw new ModuleExportError('Only the declared preview entry and its assets may be served.', 403, 'MODULE_PREVIEW_PATH_DENIED');
  }
  const root = await realpath(project.root);
  const base = await realpath(resolve(root, dirname(module.preview.entry)));
  const target = await realpath(resolve(base, asset));
  const withinRoot = relative(root, target);
  const withinBase = relative(base, target);
  if (!withinRoot || withinRoot.startsWith('..' + sep) || withinRoot === '..'
    || !withinBase || withinBase.startsWith('..' + sep) || withinBase === '..') {
    throw new ModuleExportError('Preview asset resolves outside the registered preview directory.', 403, 'MODULE_PREVIEW_PATH_DENIED');
  }
  const bytes = await readFile(target);
  if (bytes.length > MAX_BYTES) throw new ModuleExportError('Preview asset exceeds size limit.', 413, 'MODULE_TOO_LARGE');
  return { bytes, mediaType: PREVIEW_TYPES[extname(asset).toLowerCase()] };
}

export async function exportDesignModule(project, moduleId) {
  if (!ID_PATTERN.test(moduleId ?? '')) throw new ModuleExportError('Invalid module id.');
  const module = (await listDesignModules(project, { includeScreens: false })).find(item => item.id === moduleId);
  if (!module) throw new ModuleExportError('Design module not found.', 404, 'MODULE_NOT_FOUND');
  let size = 0;
  const sections = [];
  for (const path of module.files) {
    const source = await readBoundedProjectFile(project, path);
    size += Buffer.byteLength(source, 'utf8');
    if (size > MAX_BYTES) throw new ModuleExportError('Module exceeds export size limit.', 413, 'MODULE_TOO_LARGE');
    const ticks = fence(source);
    const language = extname(path).slice(1).replace('md', 'markdown');
    sections.push('## ' + path + '\n\n' + ticks + language + '\n' + source.trimEnd() + '\n' + ticks);
  }
  return [
    '# Design module: ' + module.name,
    '',
    'Project: ' + project.manifest.name,
    'Module ID: ' + module.id,
    '',
    module.description,
    '',
    '> Exported source is a read-only handoff for AI redesign. The target repository remains the single authority. Product/domain contracts are requirements; redesign UI composition only unless explicitly asked. This export is not an approved Golden.',
    '',
    ...sections.flatMap(section => [section, '']),
  ].join('\n');
}
