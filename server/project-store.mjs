import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { basename, delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DesignMarkdownError, parseDesignMarkdown, renderDesignMarkdown } from './design-markdown.mjs';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(moduleDirectory, '..');
export const defaultWorkspaceRoot = join(repositoryRoot, 'workspace');
export const defaultProjectRegistryPath = join(homedir(), '.forge-design', 'projects.json');
export const storageDirectoryName = '.design-harness';
const idPattern = /^[a-z0-9][a-z0-9_-]*$/;
const maxDocumentBytes = 2 * 1024 * 1024;

export class DesignStoreError extends Error {
  constructor(message, status = 400, code = 'DESIGN_STORE_ERROR') {
    super(message);
    this.name = 'DesignStoreError';
    this.status = status;
    this.code = code;
  }
}

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const assert = (condition, message, code = 'INVALID_DOCUMENT') => {
  if (!condition) throw new DesignStoreError(message, 400, code);
};

export function assertSafeId(value, label = 'id') {
  assert(typeof value === 'string' && idPattern.test(value), `${label} must match ${idPattern}.`, 'UNSAFE_ID');
  return value;
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string.`);
}

export function validateProjectManifest(document) {
  assert(isObject(document), 'project.json must contain an object.');
  assert(document.schemaVersion === 1, 'project.json schemaVersion must be 1.');
  assertSafeId(document.id, 'project id');
  assertString(document.name, 'project name');
  assertString(document.storageVersion, 'storageVersion');
  assert(isObject(document.designSystem), 'designSystem must be an object.');
  assertString(document.designSystem.name, 'designSystem.name');
  assertString(document.designSystem.version, 'designSystem.version');
  assertSafeId(document.activeScreenId, 'activeScreenId');
  return document;
}

export function validateTokens(document) {
  assert(isObject(document), 'tokens.json must contain an object.');
  assert(document.schemaVersion === 1, 'tokens.json schemaVersion must be 1.');
  assert(isObject(document.meta), 'tokens.meta must be an object.');
  assertString(document.meta.name, 'tokens.meta.name');
  assertString(document.meta.version, 'tokens.meta.version');
  for (const group of ['color', 'spacing', 'radius', 'shadow', 'typography', 'device']) {
    assert(isObject(document[group]), `tokens.${group} must be an object.`);
  }
  assert(Object.keys(document.color).length > 0, 'tokens.color cannot be empty.');
  for (const [name, value] of Object.entries(document.color)) assertString(value, `tokens.color.${name}`);
  for (const group of ['spacing', 'radius']) {
    for (const [name, value] of Object.entries(document[group])) {
      assert(typeof value === 'number' && Number.isFinite(value) && value >= 0, `tokens.${group}.${name} must be a non-negative number.`);
    }
  }
  for (const [name, value] of Object.entries(document.shadow)) assert(typeof value === 'string', `tokens.shadow.${name} must be a string.`);
  for (const [name, style] of Object.entries(document.typography)) {
    assert(isObject(style), `tokens.typography.${name} must be an object.`);
    for (const key of ['size', 'lineHeight', 'weight']) {
      assert(typeof style[key] === 'number' && Number.isFinite(style[key]) && style[key] > 0, `tokens.typography.${name}.${key} must be a positive number.`);
    }
  }
  for (const key of ['iphoneWidth', 'iphoneHeight', 'safeTop', 'safeBottom']) {
    const value = document.device[key];
    assert(typeof value === 'number' && Number.isFinite(value) && value >= 0, `tokens.device.${key} must be a non-negative number.`);
  }
  assert(document.device.iphoneWidth > 0 && document.device.iphoneHeight > 0, 'Device width and height must be positive.');
  return document;
}

export function validateComponents(document) {
  assert(isObject(document), 'components.json must contain an object.');
  assert(document.schemaVersion === 1, 'components.json schemaVersion must be 1.');
  assert(Array.isArray(document.components), 'components must be an array.');
  const names = new Set();
  for (const component of document.components) {
    assert(isObject(component), 'Every component contract must be an object.');
    assert(typeof component.name === 'string' && /^[A-Z][A-Za-z0-9]*$/.test(component.name), `Invalid component name: ${component.name}.`);
    assert(!names.has(component.name), `Duplicate component contract: ${component.name}.`);
    names.add(component.name);
    assertString(component.purpose, `${component.name}.purpose`);
    assert(Array.isArray(component.allowedProps) && component.allowedProps.every((item) => typeof item === 'string' && item.trim().length > 0), `${component.name}.allowedProps must be a non-empty string array.`);
    assert(new Set(component.allowedProps).size === component.allowedProps.length, `${component.name}.allowedProps contains duplicates.`);
    assert(['layout', 'content', 'control', 'navigation'].includes(component.category), `${component.name}.category is invalid.`);
  }
  return document;
}

export function validateScreen(document, expectedId) {
  assert(isObject(document), 'Screen document must contain an object.');
  assert(document.schemaVersion === 1, 'Screen schemaVersion must be 1.');
  assertSafeId(document.id, 'screen id');
  if (expectedId !== undefined) assert(document.id === expectedId, `Screen filename/id mismatch: expected ${expectedId}, received ${document.id}.`, 'SCREEN_ID_MISMATCH');
  assertString(document.name, 'screen name');
  assert(document.device === 'iphone-16-pro', 'screen.device must be iphone-16-pro.');
  assertString(document.goal, 'screen goal');
  assertString(document.primaryAction, 'screen primaryAction');
  assert(Array.isArray(document.constraints) && document.constraints.every((item) => typeof item === 'string'), 'screen.constraints must be a string array.');
  assert(Array.isArray(document.nodes), 'screen.nodes must be an array.');
  const nodeIds = new Set();
  for (const node of document.nodes) {
    assert(isObject(node), 'Every screen node must be an object.');
    assertSafeId(node.id, 'screen node id');
    assert(!nodeIds.has(node.id), `Duplicate screen node id: ${node.id}.`, 'DUPLICATE_NODE_ID');
    nodeIds.add(node.id);
    assertString(node.component, `${node.id}.component`);
    if (node.props !== undefined) assert(isObject(node.props), `${node.id}.props must be an object.`);
  }
  return document;
}

const productReviewStages = ['not_started', 'captured', 'model_visible', 'visual_reviewed'];
const productInformationRoles = ['identity', 'primary_meaning', 'evidence', 'action', 'status', 'next_action', 'context', 'supporting_metadata'];
const productPriorities = ['primary', 'secondary', 'supporting'];

function assertStringArray(value, label) {
  assert(Array.isArray(value) && value.every((item) => typeof item === 'string'), `${label} must be a string array.`);
}

function assertUniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    assert(isObject(item), `${label} entries must be objects.`);
    assertSafeId(item.id, `${label} id`);
    assert(!ids.has(item.id), `Duplicate ${label} id: ${item.id}.`, 'DUPLICATE_PRODUCT_ID');
    ids.add(item.id);
  }
}

export function validateProductModel(document) {
  assert(isObject(document), 'product.json must contain an object.');
  assert(document.schemaVersion === 1, 'product.json schemaVersion must be 1.');
  assert(isObject(document.brief), 'product.brief must be an object.');
  assert(['draft', 'ready'].includes(document.brief.status), 'product.brief.status is invalid.');
  assertString(document.brief.userJob, 'product.brief.userJob');
  assertString(document.brief.productGoal, 'product.brief.productGoal');
  for (const field of ['businessSemantics', 'primaryTasks', 'secondaryTasks', 'nonGoals', 'preservedSemantics']) {
    assertStringArray(document.brief[field], `product.brief.${field}`);
  }
  assert(Array.isArray(document.brief.informationHierarchy), 'product.brief.informationHierarchy must be an array.');
  for (const item of document.brief.informationHierarchy) {
    assert(isObject(item), 'informationHierarchy entries must be objects.');
    assert(productInformationRoles.includes(item.role), `Invalid information role: ${item.role}.`);
    assertString(item.description, 'informationHierarchy.description');
    assert(productPriorities.includes(item.priority), `Invalid information priority: ${item.priority}.`);
  }
  assert(Array.isArray(document.brief.stateModel), 'product.brief.stateModel must be an array.');
  assertUniqueIds(document.brief.stateModel, 'state');
  for (const item of document.brief.stateModel) {
    assertString(item.meaning, `${item.id}.meaning`);
    assertString(item.userImpact, `${item.id}.userImpact`);
  }
  assert(Array.isArray(document.brief.interactionModel), 'product.brief.interactionModel must be an array.');
  assertUniqueIds(document.brief.interactionModel, 'interaction');
  for (const item of document.brief.interactionModel) {
    assertString(item.semantics, `${item.id}.semantics`);
    if (item.patternId !== undefined) assertSafeId(item.patternId, `${item.id}.patternId`);
  }
  assertString(document.brief.screenFamily, 'product.brief.screenFamily');

  assert(Array.isArray(document.flows), 'product.flows must be an array.');
  assertUniqueIds(document.flows, 'flow');
  for (const flow of document.flows) {
    assertString(flow.name, `${flow.id}.name`);
    assertString(flow.userJob, `${flow.id}.userJob`);
    assert(Array.isArray(flow.screenIds), `${flow.id}.screenIds must be an array.`);
    for (const screenId of flow.screenIds) assertSafeId(screenId, `${flow.id}.screenId`);
    assert(['draft', 'candidate', 'validated'].includes(flow.status), `${flow.id}.status is invalid.`);
  }

  assert(Array.isArray(document.patterns), 'product.patterns must be an array.');
  assertUniqueIds(document.patterns, 'pattern');
  for (const pattern of document.patterns) {
    assertString(pattern.name, `${pattern.id}.name`);
    assertString(pattern.semanticPurpose, `${pattern.id}.semanticPurpose`);
    assert(['local', 'golden_candidate', 'approved'].includes(pattern.status), `${pattern.id}.status is invalid.`);
    assert(Array.isArray(pattern.validatedFlowIds), `${pattern.id}.validatedFlowIds must be an array.`);
    for (const flowId of pattern.validatedFlowIds) assertSafeId(flowId, `${pattern.id}.validatedFlowId`);
    assertStringArray(pattern.siblingEvidence, `${pattern.id}.siblingEvidence`);
    if (pattern.owner !== undefined) assertString(pattern.owner, `${pattern.id}.owner`);
  }

  assert(isObject(document.golden), 'product.golden must be an object.');
  assert(['draft', 'candidate', 'approved'].includes(document.golden.status), 'product.golden.status is invalid.');
  for (const field of ['screenIds', 'flowIds', 'patternIds']) {
    assert(Array.isArray(document.golden[field]), `product.golden.${field} must be an array.`);
    for (const value of document.golden[field]) assertSafeId(value, `product.golden.${field}`);
  }
  assert(isObject(document.golden.review), 'product.golden.review must be an object.');
  assert(productReviewStages.includes(document.golden.review.stage), 'product.golden.review.stage is invalid.');
  assert(['pending', 'accepted', 'rejected'].includes(document.golden.review.userDecision), 'product.golden.review.userDecision is invalid.');
  assertStringArray(document.golden.review.artifactRefs, 'product.golden.review.artifactRefs');
  assertStringArray(document.golden.review.notes, 'product.golden.review.notes');
  return document;
}

function evaluateGoldenGate(product, screens = []) {
  if (!product) {
    return {
      modeled: false,
      status: 'unmodeled',
      productContractReady: false,
      flowReady: false,
      interactionPatternsReady: false,
      runtimeReviewStage: 'not_started',
      runtimeEvidenceReady: false,
      userDecision: 'pending',
      canApprove: false,
      blockers: ['Product Contract is missing. Start with User Job and the full product flow before composing or promoting UI.'],
    };
  }
  const screenIds = new Set(screens.map((screen) => screen.id));
  const flows = new Map(product.flows.map((flow) => [flow.id, flow]));
  const patterns = new Map(product.patterns.map((pattern) => [pattern.id, pattern]));
  const brief = product.brief;
  const productContractReady = Boolean(
    brief.status === 'ready'
    && brief.userJob.trim()
    && brief.productGoal.trim()
    && brief.primaryTasks.length
    && brief.informationHierarchy.length
    && brief.interactionModel.length
    && brief.screenFamily.trim()
  );
  const selectedFlows = product.golden.flowIds.map((id) => flows.get(id)).filter(Boolean);
  const flowReady = selectedFlows.length === product.golden.flowIds.length && selectedFlows.length > 0 && selectedFlows.every((flow) => flow.screenIds.length > 0 && flow.screenIds.every((id) => screenIds.has(id)) && flow.status === 'validated');
  const selectedPatterns = product.golden.patternIds.map((id) => patterns.get(id)).filter(Boolean);
  const interactionPatternsReady = selectedPatterns.length === product.golden.patternIds.length
    && selectedPatterns.every((pattern) => pattern.status === 'approved' && pattern.validatedFlowIds.length > 0 && pattern.siblingEvidence.length > 0);
  const runtimeEvidenceReady = product.golden.review.stage === 'not_started'
    ? product.golden.review.artifactRefs.length === 0
    : product.golden.review.artifactRefs.length > 0;
  const visualReviewed = product.golden.review.stage === 'visual_reviewed';
  const userAccepted = product.golden.review.userDecision === 'accepted';
  const blockers = [];
  if (!productContractReady) blockers.push('Product Contract is incomplete.');
  if (!flowReady) blockers.push('Golden flow must reference validated screens and a validated full product flow.');
  if (product.golden.patternIds.length > 0 && !interactionPatternsReady) blockers.push('Interaction Patterns need validated flow and sibling evidence before system promotion.');
  if (!runtimeEvidenceReady) blockers.push('Runtime review stage requires at least one concrete artifact reference.');
  if (!visualReviewed) blockers.push(`Runtime review is only at ${product.golden.review.stage}; Captured is not Model Visible or Visual Reviewed.`);
  if (!userAccepted) blockers.push('User acceptance is still pending or rejected.');
  const canApprove = blockers.length === 0;
  return {
    modeled: true,
    status: product.golden.status,
    productContractReady,
    flowReady,
    interactionPatternsReady,
    runtimeReviewStage: product.golden.review.stage,
    runtimeEvidenceReady,
    userDecision: product.golden.review.userDecision,
    canApprove,
    blockers,
  };
}

function productReferenceErrors(product, screens) {
  if (!product) return [];
  const screenIds = new Set(screens.map((screen) => screen.id));
  const flowIds = new Set(product.flows.map((flow) => flow.id));
  const patternIds = new Set(product.patterns.map((pattern) => pattern.id));
  const errors = [];
  for (const flow of product.flows) for (const screenId of flow.screenIds) if (!screenIds.has(screenId)) errors.push(`Product flow ${flow.id} references unknown screen ${screenId}.`);
  for (const interaction of product.brief.interactionModel) if (interaction.patternId && !patternIds.has(interaction.patternId)) errors.push(`Interaction ${interaction.id} references unknown pattern ${interaction.patternId}.`);
  for (const pattern of product.patterns) for (const flowId of pattern.validatedFlowIds) if (!flowIds.has(flowId)) errors.push(`Pattern ${pattern.id} references unknown validated flow ${flowId}.`);
  for (const screenId of product.golden.screenIds) if (!screenIds.has(screenId)) errors.push(`Golden references unknown screen ${screenId}.`);
  for (const flowId of product.golden.flowIds) if (!flowIds.has(flowId)) errors.push(`Golden references unknown flow ${flowId}.`);
  for (const patternId of product.golden.patternIds) if (!patternIds.has(patternId)) errors.push(`Golden references unknown pattern ${patternId}.`);
  return errors;
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  const content = await readFile(path, 'utf8');
  if (Buffer.byteLength(content, 'utf8') > maxDocumentBytes) throw new DesignStoreError(`${path} exceeds the document size limit.`, 413, 'DOCUMENT_TOO_LARGE');
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new DesignStoreError(`Invalid JSON in ${path}: ${error.message}`, 400, 'INVALID_JSON');
  }
}

async function writeJsonAtomic(path, document) {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const temporaryPath = join(directory, `.${randomUUID()}.tmp`);
  const serialized = `${JSON.stringify(document, null, 2)}\n`;
  try {
    await writeFile(temporaryPath, serialized, { encoding: 'utf8', flag: 'wx' });
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

function normalizeProjectRoot(candidate) {
  const root = resolve(candidate);
  return basename(root) === storageDirectoryName ? dirname(root) : root;
}

function externalRootsFromEnvironment() {
  return (process.env.DESIGN_HARNESS_PROJECT_ROOTS ?? '')
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizeProjectRoot);
}

function validateProjectRegistry(document) {
  assert(isObject(document), 'Local project registry must contain an object.', 'INVALID_PROJECT_REGISTRY');
  assert(document.schemaVersion === 1, 'Local project registry schemaVersion must be 1.', 'INVALID_PROJECT_REGISTRY');
  assert(
    Array.isArray(document.projectRoots) && document.projectRoots.every((item) => typeof item === 'string' && item.trim().length > 0),
    'Local project registry projectRoots must be a string array.',
    'INVALID_PROJECT_REGISTRY'
  );
  return {
    schemaVersion: 1,
    projectRoots: [...new Set(document.projectRoots.map(normalizeProjectRoot))].sort(),
  };
}

export class ProjectStore {
  constructor({
    workspaceRoot = defaultWorkspaceRoot,
    externalRoots = externalRootsFromEnvironment(),
    registryPath = defaultProjectRegistryPath,
  } = {}) {
    this.workspaceRoot = resolve(workspaceRoot);
    this.externalRoots = [...new Set(externalRoots.map(normalizeProjectRoot))];
    this.registryPath = resolve(registryPath);
  }

  async getRegisteredProjectRoots() {
    if (!(await pathExists(this.registryPath))) return [];
    return validateProjectRegistry(await readJson(this.registryPath)).projectRoots;
  }

  async registerProjectRoot(projectRoot) {
    const root = normalizeProjectRoot(projectRoot);
    const manifestPath = join(root, storageDirectoryName, 'project.json');
    if (!(await pathExists(manifestPath))) {
      throw new DesignStoreError(`No ${storageDirectoryName}/project.json found at ${root}.`, 404, 'DESIGN_PROJECT_NOT_INITIALIZED');
    }
    const manifest = validateProjectManifest(await readJson(manifestPath));
    const projectRoots = [...new Set([...(await this.getRegisteredProjectRoots()), root])].sort();
    await writeJsonAtomic(this.registryPath, { schemaVersion: 1, projectRoots });
    return { root, manifest, registryPath: this.registryPath };
  }

  async unregisterProjectRoot(projectRoot) {
    const root = normalizeProjectRoot(projectRoot);
    const projectRoots = (await this.getRegisteredProjectRoots()).filter((item) => item !== root);
    await writeJsonAtomic(this.registryPath, { schemaVersion: 1, projectRoots });
    return { root, removed: true, registryPath: this.registryPath };
  }

  async discoverProjectRoots() {
    const roots = new Set([...this.externalRoots, ...(await this.getRegisteredProjectRoots())]);
    if (await pathExists(this.workspaceRoot)) {
      for (const entry of await readdir(this.workspaceRoot, { withFileTypes: true })) {
        if (entry.isDirectory()) roots.add(join(this.workspaceRoot, entry.name));
      }
    }
    const projects = [];
    for (const root of roots) {
      const manifestPath = join(root, storageDirectoryName, 'project.json');
      if (!(await pathExists(manifestPath))) continue;
      const manifest = validateProjectManifest(await readJson(manifestPath));
      projects.push({ root, manifest, storagePath: join(root, storageDirectoryName) });
    }
    projects.sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
    const ids = new Set();
    for (const project of projects) {
      if (ids.has(project.manifest.id)) throw new DesignStoreError(`Duplicate design project id: ${project.manifest.id}.`, 409, 'DUPLICATE_PROJECT_ID');
      ids.add(project.manifest.id);
    }
    return projects;
  }

  async listProjects() {
    const projects = await this.discoverProjectRoots();
    return projects.map(({ root, storagePath, manifest }) => ({
      id: manifest.id,
      name: manifest.name,
      activeScreenId: manifest.activeScreenId,
      designSystem: manifest.designSystem,
      root,
      storagePath,
    }));
  }

  async resolveProject(projectId) {
    assertSafeId(projectId, 'project id');
    const projects = await this.discoverProjectRoots();
    const project = projects.find((candidate) => candidate.manifest.id === projectId);
    if (!project) throw new DesignStoreError(`Unknown design project: ${projectId}.`, 404, 'PROJECT_NOT_FOUND');
    return project;
  }

  async getManifest(projectId) {
    return structuredClone((await this.resolveProject(projectId)).manifest);
  }

  async getPaths(projectId) {
    const project = await this.resolveProject(projectId);
    return {
      projectRoot: project.root,
      storageRoot: project.storagePath,
      manifest: join(project.storagePath, 'project.json'),
      tokens: join(project.storagePath, 'tokens.json'),
      components: join(project.storagePath, 'components.json'),
      screens: join(project.storagePath, 'screens'),
      product: join(project.storagePath, 'product.json'),
    };
  }

  async getTokens(projectId) {
    const project = await this.resolveProject(projectId);
    return validateTokens(await readJson(join(project.storagePath, 'tokens.json')));
  }

  async putTokens(projectId, document) {
    validateTokens(document);
    const project = await this.resolveProject(projectId);
    await writeJsonAtomic(join(project.storagePath, 'tokens.json'), document);
    return structuredClone(document);
  }

  async getComponents(projectId) {
    const project = await this.resolveProject(projectId);
    return validateComponents(await readJson(join(project.storagePath, 'components.json')));
  }

  async putComponents(projectId, document) {
    validateComponents(document);
    const project = await this.resolveProject(projectId);
    await writeJsonAtomic(join(project.storagePath, 'components.json'), document);
    return structuredClone(document);
  }

  async getProductModel(projectId) {
    const project = await this.resolveProject(projectId);
    const path = join(project.storagePath, 'product.json');
    if (!(await pathExists(path))) return null;
    return validateProductModel(await readJson(path));
  }

  async putProductModel(projectId, document) {
    validateProductModel(document);
    const project = await this.resolveProject(projectId);
    await writeJsonAtomic(join(project.storagePath, 'product.json'), document);
    return structuredClone(document);
  }

  async listScreens(projectId) {
    const project = await this.resolveProject(projectId);
    const directory = join(project.storagePath, 'screens');
    const entries = (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
    const screens = [];
    for (const entry of entries) {
      const id = entry.name.slice(0, -5);
      assertSafeId(id, 'screen filename');
      const screen = validateScreen(await readJson(join(directory, entry.name)), id);
      screens.push(screen);
    }
    screens.sort((left, right) => left.name.localeCompare(right.name));
    return screens;
  }

  async getScreen(projectId, screenId) {
    assertSafeId(screenId, 'screen id');
    const project = await this.resolveProject(projectId);
    const path = join(project.storagePath, 'screens', `${screenId}.json`);
    if (!(await pathExists(path))) throw new DesignStoreError(`Unknown screen: ${screenId}.`, 404, 'SCREEN_NOT_FOUND');
    return validateScreen(await readJson(path), screenId);
  }

  async putScreen(projectId, document) {
    validateScreen(document, document.id);
    const project = await this.resolveProject(projectId);
    const path = join(project.storagePath, 'screens', `${document.id}.json`);
    await writeJsonAtomic(path, document);
    return structuredClone(document);
  }

  async createScreen(projectId, document) {
    validateScreen(document, document.id);
    const project = await this.resolveProject(projectId);
    const path = join(project.storagePath, 'screens', `${document.id}.json`);
    if (await pathExists(path)) throw new DesignStoreError(`Screen already exists: ${document.id}.`, 409, 'SCREEN_ALREADY_EXISTS');
    await writeJsonAtomic(path, document);
    return structuredClone(document);
  }

  async getContext(projectId) {
    const project = await this.resolveProject(projectId);
    const [tokens, components, screens, product] = await Promise.all([
      this.getTokens(projectId),
      this.getComponents(projectId),
      this.listScreens(projectId),
      this.getProductModel(projectId),
    ]);
    return {
      schemaVersion: 1,
      project: structuredClone(project.manifest),
      storage: {
        canonicalDirectory: storageDirectoryName,
        sourceOfTruth: 'target-repository',
        versionControl: 'git',
        screenLayout: 'one-json-file-per-screen',
        browserStorageCanonical: false,
      },
      tokens,
      components,
      screens,
      product,
      goldenGate: evaluateGoldenGate(product, screens),
    };
  }

  async exportDesignMarkdown(projectId) {
    return renderDesignMarkdown(await this.getContext(projectId));
  }

  async importDesignMarkdown(projectId, markdown) {
    let bundle;
    try {
      bundle = parseDesignMarkdown(markdown);
    } catch (error) {
      if (error instanceof DesignMarkdownError) throw new DesignStoreError(error.message, 400, error.code);
      throw error;
    }

    const manifest = validateProjectManifest(bundle.project);
    if (manifest.id !== projectId) {
      throw new DesignStoreError(`design.md project id mismatch: expected ${projectId}, received ${manifest.id}.`, 400, 'DESIGN_MARKDOWN_PROJECT_ID_MISMATCH');
    }
    const tokens = validateTokens(bundle.tokens);
    const components = validateComponents(bundle.components);
    const product = bundle.product == null ? null : validateProductModel(bundle.product);
    const importedScreens = bundle.screens.map((screen) => validateScreen(screen, screen.id));
    const project = await this.resolveProject(projectId);
    const currentScreens = await this.listScreens(projectId);
    const mergedScreens = new Map(currentScreens.map((screen) => [screen.id, screen]));
    for (const screen of importedScreens) mergedScreens.set(screen.id, screen);

    if (!mergedScreens.has(manifest.activeScreenId)) {
      throw new DesignStoreError(`activeScreenId ${manifest.activeScreenId} does not exist after design.md merge.`, 400, 'DESIGN_MARKDOWN_ACTIVE_SCREEN_MISSING');
    }
    const componentNames = new Set(components.components.map((component) => component.name));
    for (const screen of mergedScreens.values()) {
      for (const node of screen.nodes) {
        if (!componentNames.has(node.component)) {
          throw new DesignStoreError(`${screen.id}/${node.id} uses unregistered component ${node.component}.`, 400, 'DESIGN_MARKDOWN_COMPONENT_MISSING');
        }
      }
    }
    const productErrors = productReferenceErrors(product, [...mergedScreens.values()]);
    if (productErrors.length) throw new DesignStoreError(productErrors[0], 400, 'DESIGN_MARKDOWN_PRODUCT_REFERENCE_INVALID');

    await writeJsonAtomic(join(project.storagePath, 'project.json'), manifest);
    await writeJsonAtomic(join(project.storagePath, 'tokens.json'), tokens);
    await writeJsonAtomic(join(project.storagePath, 'components.json'), components);
    if (product) await writeJsonAtomic(join(project.storagePath, 'product.json'), product);
    for (const screen of importedScreens) {
      await writeJsonAtomic(join(project.storagePath, 'screens', `${screen.id}.json`), screen);
    }
    const importedIds = new Set(importedScreens.map((screen) => screen.id));
    return {
      schemaVersion: 1,
      projectId,
      mode: 'merge',
      importedScreenIds: [...importedIds].sort(),
      preservedScreenIds: currentScreens.map((screen) => screen.id).filter((id) => !importedIds.has(id)).sort(),
    };
  }

  async validateProject(projectId) {
    const context = await this.getContext(projectId);
    const componentNames = new Set(context.components.components.map((component) => component.name));
    const screenIds = new Set(context.screens.map((screen) => screen.id));
    const errors = [];
    const warnings = [];
    if (!context.screens.some((screen) => screen.id === context.project.activeScreenId)) {
      errors.push(`activeScreenId ${context.project.activeScreenId} does not exist.`);
    }
    for (const screen of context.screens) {
      for (const node of screen.nodes) {
        if (!componentNames.has(node.component)) errors.push(`${screen.id}/${node.id} uses unregistered component ${node.component}.`);
      }
    }
    if (!context.product) {
      warnings.push('product.json is missing; this project is legacy visual-only and cannot be promoted to Golden.');
    } else {
      errors.push(...productReferenceErrors(context.product, context.screens));
      if (context.product.golden.status === 'approved' && !context.goldenGate.canApprove) {
        errors.push(`Golden is marked approved before all gates pass: ${context.goldenGate.blockers.join(' ')}`);
      }
    }
    return { ok: errors.length === 0, projectId, errors, warnings, goldenGate: context.goldenGate };
  }

  async initProject({ projectRoot, id, name }) {
    const root = normalizeProjectRoot(projectRoot);
    assertSafeId(id, 'project id');
    assertString(name, 'project name');
    const storagePath = join(root, storageDirectoryName);
    if (await pathExists(storagePath)) throw new DesignStoreError(`${storageDirectoryName} already exists at ${root}.`, 409, 'PROJECT_ALREADY_INITIALIZED');
    const manifest = {
      schemaVersion: 1,
      id,
      name,
      storageVersion: '1.0.0',
      designSystem: { name: `${name} Design System`, version: '0.1.0' },
      activeScreenId: 'home',
    };
    const tokens = {
      schemaVersion: 1,
      meta: { name: manifest.designSystem.name, version: manifest.designSystem.version },
      color: {
        canvas: '#171918', canvasRaised: '#202321', panel: '#262927', border: '#393d3a', chromeText: '#aeb4af', chromeTextMuted: '#9ca39d', chromeTextSubtle: '#89908a', chromeTextFaint: '#858c86', chromeCrumb: '#7f8680', chromeControl: '#9ba19c', artboardLabel: '#a7ada8', chromeBorderStrong: '#545a55', chromeMiniDevice: '#111311', deviceBorder: '#4a4e4b', deviceFrame: '#080908', deviceIsland: '#050505', screenBackground: '#f5f5f1', surface: '#ffffff', surfaceMuted: '#eceee8', surfaceBorder: '#e6e8e2', emptyBorder: '#cfd4ce', divider: '#d9ddd7', textPrimary: '#161a17', textSecondary: '#687069', textInverse: '#f5f7f3', accent: '#52735b', accentStrong: '#36533f', accentSoft: '#dfe9e0', danger: '#a94f47', warning: '#9a6b32', success: '#72b782', trajectoryRail: '#d8ddd7', trajectoryDot: '#bac3bb', trajectoryDotBorder: '#cad0ca', beatMuted: '#879088', inspectorTab: '#8e958f', inspectorTitle: '#c6cbc7', inspectorCount: '#757c76', inspectorBody: '#9fa59f', successText: '#b7d7bd', componentText: '#bfc4c0', treeLine: '#555b56', componentMeta: '#717872', lintSuccessText: '#a9d5b2', lintWarningText: '#d7b18f', tokenLabel: '#7d847e', gridLine: 'rgba(255, 255, 255, 0.025)', toolbarOverlay: 'rgba(23, 25, 24, 0.9)', statusHalo: 'rgba(114, 183, 130, 0.12)', accentShadow: 'rgba(54, 83, 63, 0.22)', successSurfaceStrong: 'rgba(82, 115, 91, 0.24)', successSurface: 'rgba(82, 115, 91, 0.18)', warningSurface: 'rgba(154, 107, 50, 0.14)', subtleBorder: 'rgba(255, 255, 255, 0.08)'
      },
      spacing: { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
      radius: { sm: 8, control: 12, card: 18, sheet: 28, device: 44, pill: 999 },
      shadow: { card: '0 8px 30px rgba(22, 26, 23, 0.08)', device: '0 32px 90px rgba(0, 0, 0, 0.34)' },
      typography: { display: { size: 48, lineHeight: 52, weight: 700 }, title: { size: 26, lineHeight: 32, weight: 700 }, headline: { size: 18, lineHeight: 24, weight: 650 }, body: { size: 15, lineHeight: 22, weight: 450 }, caption: { size: 12, lineHeight: 16, weight: 550 } },
      device: { iphoneWidth: 393, iphoneHeight: 852, safeTop: 54, safeBottom: 30 },
    };
    const product = {
      schemaVersion: 1,
      brief: {
        status: 'draft',
        userJob: 'Define the primary user job before composing screens.',
        productGoal: 'Describe the product outcome this flow must achieve.',
        businessSemantics: [],
        primaryTasks: ['Define the primary task.'],
        secondaryTasks: [],
        informationHierarchy: [
          { role: 'primary_meaning', description: 'Define what must be understood first.', priority: 'primary' },
        ],
        stateModel: [],
        interactionModel: [
          { id: 'primary-action', semantics: 'Define the semantic meaning of the primary action before styling it.' },
        ],
        screenFamily: 'unclassified',
        nonGoals: [],
        preservedSemantics: [],
      },
      flows: [
        { id: 'primary-flow', name: 'Primary product flow', userJob: 'Define the end-to-end user job.', screenIds: ['home'], status: 'draft' },
      ],
      patterns: [],
      golden: {
        status: 'draft',
        screenIds: ['home'],
        flowIds: ['primary-flow'],
        patternIds: [],
        review: { stage: 'not_started', userDecision: 'pending', artifactRefs: [], notes: [] },
      },
    };
    const components = { schemaVersion: 1, components: [
      { name: 'ScreenHeader', purpose: 'Page identity and one optional secondary action.', allowedProps: ['eyebrow', 'title', 'actionLabel'], category: 'navigation' },
      { name: 'EmptyState', purpose: 'Explain an empty canvas and the next valid action.', allowedProps: ['title', 'body'], category: 'content' },
      { name: 'PrimaryAction', purpose: 'Exactly one dominant screen action.', allowedProps: ['label', 'activeLabel'], category: 'control' },
    ] };
    const screen = { schemaVersion: 1, id: 'home', name: 'Home', device: 'iphone-16-pro', goal: 'Define the first screen goal.', primaryAction: 'continue', constraints: ['Use registered components and project tokens only.'], nodes: [
      { id: 'header', component: 'ScreenHeader', props: { eyebrow: 'New project', title: name } },
      { id: 'empty', component: 'EmptyState', props: { title: 'Start with a Product Contract', body: 'Define the User Job, full flow, information hierarchy, and interaction semantics before composing screens.' } },
      { id: 'continue', component: 'PrimaryAction', props: { label: 'Continue', activeLabel: 'Continue' } },
    ] };
    validateProjectManifest(manifest);
    validateTokens(tokens);
    validateComponents(components);
    validateProductModel(product);
    validateScreen(screen, 'home');
    const temporaryStoragePath = join(root, `.design-harness-${randomUUID()}.tmp`);
    await mkdir(root, { recursive: true });
    try {
      await writeJsonAtomic(join(temporaryStoragePath, 'project.json'), manifest);
      await writeJsonAtomic(join(temporaryStoragePath, 'tokens.json'), tokens);
      await writeJsonAtomic(join(temporaryStoragePath, 'components.json'), components);
      await writeJsonAtomic(join(temporaryStoragePath, 'product.json'), product);
      await writeJsonAtomic(join(temporaryStoragePath, 'screens', 'home.json'), screen);
      await writeFile(join(temporaryStoragePath, 'README.md'), '# `.design-harness`\n\nCanonical Git-tracked design assets for this repository.\n', 'utf8');
      await rename(temporaryStoragePath, storagePath);
    } finally {
      await rm(temporaryStoragePath, { recursive: true, force: true });
    }
    return { projectRoot: root, storagePath, manifest };
  }
}

export function createProjectStore(options) {
  return new ProjectStore(options);
}
