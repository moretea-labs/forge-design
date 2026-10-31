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

export async function listDesignModules(project) {
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
  if (new Set(modules.map(module => module.id)).size !== modules.length) {
    throw new ModuleExportError('Duplicate module id.');
  }
  return modules;
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
  const module = (await listDesignModules(project)).find(item => item.id === moduleId);
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
  const module = (await listDesignModules(project)).find(item => item.id === moduleId);
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
