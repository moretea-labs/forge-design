import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { basename, delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DesignMarkdownError, parseDesignMarkdown, renderDesignMarkdown } from './design-markdown.mjs';
import { SchemaValidationError, loadCanonicalSchema, validateCanonicalDocument } from './schema-validator.mjs';

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

const storageVersionSchema = loadCanonicalSchema('project').properties.storageVersion;
export const supportedStorageVersions = Object.freeze([...storageVersionSchema.enum]);
export const currentStorageVersion = supportedStorageVersions.at(-1);

function validateSchema(schemaName, document) {
  try {
    return validateCanonicalDocument(schemaName, document);
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      throw new DesignStoreError(error.message, 400, error.code);
    }
    throw error;
  }
}

export function validateProjectManifest(document) {
  validateSchema('project', document);
  assert(supportedStorageVersions.includes(document.storageVersion), `Unsupported storageVersion: ${document.storageVersion}.`, 'STORAGE_VERSION_UNSUPPORTED');
  return document;
}

export function validateTokens(document) {
  return validateSchema('tokens', document);
}

function componentPropNames(component) {
  if (Array.isArray(component.props) && component.props.length > 0) return component.props.map((prop) => prop.name);
  return component.allowedProps ?? [];
}

function componentPropValueValid(definition, value) {
  if (definition.type === 'string') return typeof value === 'string';
  if (definition.type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (definition.type === 'boolean') return typeof value === 'boolean';
  if (definition.type === 'enum') return typeof value === 'string' && Array.isArray(definition.enumValues) && definition.enumValues.includes(value);
  return false;
}

export function validateComponents(document) {
  validateSchema('components', document);
  const names = new Set();
  for (const component of document.components) {
    assert(!names.has(component.name), `Duplicate component contract: ${component.name}.`, 'DUPLICATE_COMPONENT_NAME');
    names.add(component.name);
    const propNames = new Set();
    for (const prop of component.props ?? []) {
      assert(!propNames.has(prop.name), `Duplicate component prop ${component.name}.${prop.name}.`, 'DUPLICATE_COMPONENT_PROP');
      propNames.add(prop.name);
      if (prop.type === 'enum') assert(Array.isArray(prop.enumValues) && prop.enumValues.length > 0, `Enum prop ${component.name}.${prop.name} requires enumValues.`, 'COMPONENT_ENUM_VALUES_REQUIRED');
    }
    for (const collectionName of ['variants', 'states']) {
      const ids = new Set();
      for (const item of component[collectionName] ?? []) {
        assert(!ids.has(item.id), `Duplicate ${component.name} ${collectionName} id ${item.id}.`, 'DUPLICATE_COMPONENT_VARIANT_STATE');
        ids.add(item.id);
      }
    }
    if (component.preview?.nodes) {
      const previewIds = new Set(component.preview.nodes.map((item) => item.id));
      assert(previewIds.size === component.preview.nodes.length, `Duplicate preview node id in ${component.name}.`, 'DUPLICATE_PREVIEW_NODE');
      const variantIds = new Set((component.variants ?? []).map((item) => item.id));
      const stateIds = new Set((component.states ?? []).map((item) => item.id));
      const parentById = new Map();
      for (const item of component.preview.nodes) {
        if (item.parentId) {
          assert(previewIds.has(item.parentId), `${component.name} preview node ${item.id} references unknown parent ${item.parentId}.`, 'PREVIEW_PARENT_UNKNOWN');
          assert(item.parentId !== item.id, `${component.name} preview node ${item.id} cannot parent itself.`, 'PREVIEW_PARENT_CYCLE');
          parentById.set(item.id, item.parentId);
        }
        for (const id of item.when?.variants ?? []) assert(variantIds.has(id), `${component.name} preview node ${item.id} references unknown variant ${id}.`, 'PREVIEW_VARIANT_UNKNOWN');
        for (const id of item.when?.states ?? []) assert(stateIds.has(id), `${component.name} preview node ${item.id} references unknown state ${id}.`, 'PREVIEW_STATE_UNKNOWN');
      }
      for (const id of previewIds) {
        const seen = new Set([id]);
        let current = parentById.get(id);
        while (current) {
          assert(!seen.has(current), `${component.name} preview hierarchy contains a cycle at ${current}.`, 'PREVIEW_PARENT_CYCLE');
          seen.add(current);
          current = parentById.get(current);
        }
      }
    }
  }
  return document;
}

function starterComponentContracts() {
  return { schemaVersion: 1, components: [
    {
      name: 'ScreenHeader', purpose: 'Page identity and one optional secondary action.', category: 'navigation', interactionRole: 'navigation',
      props: [
        { name: 'eyebrow', type: 'string', required: false, description: 'Optional contextual label.' },
        { name: 'title', type: 'string', required: true, description: 'Primary page title.' },
        { name: 'actionLabel', type: 'string', required: false, description: 'Optional secondary action label.' },
      ],
      variants: [{ id: 'standard', name: 'Standard' }], states: [{ id: 'default', name: 'Default' }],
      layout: { axis: 'horizontal', width: 'fill', alignment: 'center', description: 'Title block with optional trailing action.' },
      accessibility: { summary: 'Expose the title as a header and secondary action separately.', traits: ['header'] },
      preview: { nodes: [
        { id: 'root', primitive: 'stack', style: { axis: 'vertical', gap: 'xs', width: 'fill', padding: 'sm' } },
        { id: 'eyebrow', primitive: 'text', parentId: 'root', content: { kind: 'prop', value: 'eyebrow', fallback: 'Context' }, style: { typography: 'caption', color: 'textSecondary' } },
        { id: 'title', primitive: 'text', parentId: 'root', content: { kind: 'prop', value: 'title', fallback: 'Untitled' }, style: { typography: 'title', color: 'textPrimary' } },
      ] },
    },
    {
      name: 'EmptyState', purpose: 'Explain an empty canvas and the next valid action.', category: 'content', interactionRole: 'display',
      props: [
        { name: 'title', type: 'string', required: true, description: 'Empty-state conclusion.' },
        { name: 'body', type: 'string', required: true, description: 'Explanation and next-step context.' },
      ], variants: [{ id: 'standard', name: 'Standard' }], states: [{ id: 'default', name: 'Default' }],
      layout: { axis: 'vertical', width: 'fill', alignment: 'center', description: 'Centered explanatory content.' },
      accessibility: { summary: 'Read the empty-state conclusion before supporting explanation.', traits: ['summary'] },
      preview: { nodes: [
        { id: 'root', primitive: 'surface', style: { axis: 'vertical', gap: 'sm', padding: 'xl', radius: 'card', background: 'surface', width: 'fill', alignment: 'center' } },
        { id: 'title', primitive: 'text', parentId: 'root', content: { kind: 'prop', value: 'title', fallback: 'Nothing here yet' }, style: { typography: 'headline', color: 'textPrimary' } },
        { id: 'body', primitive: 'text', parentId: 'root', content: { kind: 'prop', value: 'body', fallback: 'Add the next valid item.' }, style: { typography: 'body', color: 'textSecondary' } },
      ] },
    },
    {
      name: 'PrimaryAction', purpose: 'Exactly one dominant screen action.', category: 'control', interactionRole: 'primary_action',
      props: [
        { name: 'label', type: 'string', required: true, description: 'Primary action label.' },
        { name: 'activeLabel', type: 'string', required: false, description: 'Label for the active component state.' },
      ], variants: [{ id: 'filled', name: 'Filled' }], states: [{ id: 'idle', name: 'Idle' }, { id: 'active', name: 'Active' }],
      layout: { axis: 'none', width: 'fill', alignment: 'center', description: 'Full-width primary action.' },
      accessibility: { summary: 'Expose as the screen primary action.', traits: ['button'] },
      preview: { nodes: [
        { id: 'idle', primitive: 'button', content: { kind: 'prop', value: 'label', fallback: 'Continue' }, iconName: 'play', style: { width: 'fill' }, when: { states: ['idle'] } },
        { id: 'active', primitive: 'button', content: { kind: 'prop', value: 'activeLabel', fallback: 'Continue' }, iconName: 'stop', style: { width: 'fill' }, when: { states: ['active'] } },
      ] },
    },
  ] };
}

function assertUniqueNodeIds(nodes, label = 'screen') {
  const nodeIds = new Set();
  for (const node of nodes) {
    assert(!nodeIds.has(node.id), `Duplicate ${label} node id: ${node.id}.`, 'DUPLICATE_NODE_ID');
    nodeIds.add(node.id);
  }
}

function screenStateIds(screen) {
  if (Array.isArray(screen.states) && screen.states.length > 0) return new Set(screen.states.map((state) => state.id));
  return new Set(['normal']);
}

export function validateScreen(document, expectedId) {
  validateSchema('screen', document);
  if (expectedId !== undefined) assert(document.id === expectedId, `Screen filename/id mismatch: expected ${expectedId}, received ${document.id}.`, 'SCREEN_ID_MISMATCH');
  assertUniqueNodeIds(document.nodes);
  if (Array.isArray(document.states) && document.states.length > 0) {
    assert(document.initialStateId, `Screen ${document.id} with state variants must declare initialStateId.`, 'SCREEN_INITIAL_STATE_REQUIRED');
    const stateIds = new Set();
    for (const state of document.states) {
      assert(!stateIds.has(state.id), `Duplicate screen state id: ${state.id}.`, 'DUPLICATE_SCREEN_STATE_ID');
      stateIds.add(state.id);
      if (state.nodes) assertUniqueNodeIds(state.nodes, `screen state ${state.id}`);
    }
    assert(stateIds.has(document.initialStateId), `Screen ${document.id} initialStateId ${document.initialStateId} does not exist.`, 'SCREEN_INITIAL_STATE_MISSING');
  } else if (document.initialStateId !== undefined) {
    assert(document.initialStateId === 'normal', `Screen ${document.id} without variants may only use implicit initialStateId normal.`, 'SCREEN_INITIAL_STATE_INVALID');
  }
  return document;
}

function assertUniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    assert(!ids.has(item.id), `Duplicate ${label} id: ${item.id}.`, 'DUPLICATE_PRODUCT_ID');
    ids.add(item.id);
  }
}

export function validateProductModel(document) {
  validateSchema('product', document);
  assertUniqueIds(document.flows, 'product flow');
  assertUniqueIds(document.patterns, 'interaction pattern');
  for (const flow of document.flows) {
    if (flow.transitions) assertUniqueIds(flow.transitions, `transition in flow ${flow.id}`);
  }
  return document;
}

export function validateDesignUnits(document) {
  validateSchema('design-units', document);
  assertUniqueIds(document.units, 'design unit');
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
  const flowReady = selectedFlows.length === product.golden.flowIds.length && selectedFlows.length > 0 && selectedFlows.every((flow) => flow.screenIds.length > 0 && flow.screenIds.every((id) => screenIds.has(id)) && flow.status === 'validated' && flow.entry && Array.isArray(flow.transitions));
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
  if (!flowReady) blockers.push('Golden flow must use a validated transition graph with an explicit entry state and valid screens.');
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
  const screenMap = new Map(screens.map((screen) => [screen.id, screen]));
  const screenIds = new Set(screenMap.keys());
  const flowIds = new Set(product.flows.map((flow) => flow.id));
  const patternIds = new Set(product.patterns.map((pattern) => pattern.id));
  const interactionIds = new Set(product.brief.interactionModel.map((interaction) => interaction.id));
  const errors = [];

  const checkTarget = (flowId, label, target) => {
    if (!target) return;
    const screen = screenMap.get(target.screenId);
    if (!screen) {
      errors.push(`Product flow ${flowId} ${label} references unknown screen ${target.screenId}.`);
      return;
    }
    if (target.stateId && !screenStateIds(screen).has(target.stateId)) {
      errors.push(`Product flow ${flowId} ${label} references unknown state ${target.stateId} on screen ${target.screenId}.`);
    }
  };

  for (const flow of product.flows) {
    for (const screenId of flow.screenIds) if (!screenIds.has(screenId)) errors.push(`Product flow ${flow.id} references unknown screen ${screenId}.`);
    if (flow.entry) {
      checkTarget(flow.id, 'entry', flow.entry);
      if (!flow.screenIds.includes(flow.entry.screenId)) errors.push(`Product flow ${flow.id} entry screen ${flow.entry.screenId} is not listed in screenIds.`);
    }
    for (const transition of flow.transitions ?? []) {
      checkTarget(flow.id, `transition ${transition.id} source`, transition.from);
      checkTarget(flow.id, `transition ${transition.id} destination`, transition.to);
      if (!interactionIds.has(transition.trigger.interactionId)) errors.push(`Product flow ${flow.id} transition ${transition.id} references unknown interaction ${transition.trigger.interactionId}.`);
      for (const recovery of transition.recovery ?? []) checkTarget(flow.id, `transition ${transition.id} recovery`, recovery.target);
    }
  }
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
      designUnits: join(project.storagePath, 'design-units.json'),
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

  async getDesignUnits(projectId) {
    const project = await this.resolveProject(projectId);
    const path = join(project.storagePath, 'design-units.json');
    if (await pathExists(path)) return validateDesignUnits(await readJson(path));
    if (project.manifest.storageVersion !== '1.0.0') {
      throw new DesignStoreError('design-units.json is required for storageVersion 1.1.0.', 400, 'DESIGN_UNITS_MISSING');
    }
    const [screens, product] = await Promise.all([this.listScreens(projectId), this.getProductModel(projectId)]);
    return validateDesignUnits({
      schemaVersion: 1,
      units: [{
        id: 'legacy-default',
        name: `${project.manifest.name} Legacy Design`,
        screenFamily: product?.brief?.screenFamily || 'unclassified',
        screenIds: screens.map((screen) => screen.id).sort(),
        contractRefs: [],
      }],
    });
  }

  async putDesignUnits(projectId, document) {
    validateDesignUnits(document);
    const project = await this.resolveProject(projectId);
    if (project.manifest.storageVersion !== currentStorageVersion) {
      throw new DesignStoreError(`Project ${projectId} uses storageVersion ${project.manifest.storageVersion}; migrate to ${currentStorageVersion} before writing design units.`, 409, 'STORAGE_MIGRATION_REQUIRED');
    }
    await writeJsonAtomic(join(project.storagePath, 'design-units.json'), document);
    return structuredClone(document);
  }

  async migrateProjectStorage(projectId) {
    const project = await this.resolveProject(projectId);
    if (project.manifest.storageVersion === currentStorageVersion) {
      return { projectId, fromVersion: currentStorageVersion, toVersion: currentStorageVersion, changed: false };
    }
    if (project.manifest.storageVersion !== '1.0.0') {
      throw new DesignStoreError(`Unsupported migration from ${project.manifest.storageVersion}.`, 400, 'STORAGE_MIGRATION_UNSUPPORTED');
    }
    const designUnits = await this.getDesignUnits(projectId);
    await writeJsonAtomic(join(project.storagePath, 'design-units.json'), designUnits);
    const nextManifest = { ...project.manifest, storageVersion: currentStorageVersion };
    validateProjectManifest(nextManifest);
    await writeJsonAtomic(join(project.storagePath, 'project.json'), nextManifest);
    return { projectId, fromVersion: '1.0.0', toVersion: currentStorageVersion, changed: true, designUnits };
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
    const [tokens, components, screens, product, designUnits] = await Promise.all([
      this.getTokens(projectId),
      this.getComponents(projectId),
      this.listScreens(projectId),
      this.getProductModel(projectId),
      this.getDesignUnits(projectId),
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
        storageVersion: project.manifest.storageVersion,
        currentStorageVersion,
        migrationRequired: project.manifest.storageVersion !== currentStorageVersion,
      },
      tokens,
      components,
      screens,
      product,
      designUnits,
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
    const importedDesignUnits = bundle.designUnits == null ? null : validateDesignUnits(bundle.designUnits);
    const importedScreens = bundle.screens.map((screen) => validateScreen(screen, screen.id));
    const project = await this.resolveProject(projectId);
    if (project.manifest.storageVersion === currentStorageVersion && manifest.storageVersion === '1.0.0') {
      throw new DesignStoreError('design.md cannot downgrade a project from storageVersion 1.1.0 to 1.0.0.', 409, 'DESIGN_MARKDOWN_STORAGE_DOWNGRADE');
    }
    const currentScreens = await this.listScreens(projectId);
    const designUnits = importedDesignUnits ?? await this.getDesignUnits(projectId);
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
    const mergedScreenIds = new Set(mergedScreens.keys());
    for (const unit of designUnits.units) {
      for (const screenId of unit.screenIds) {
        if (!mergedScreenIds.has(screenId)) throw new DesignStoreError(`Design unit ${unit.id} references unknown screen ${screenId}.`, 400, 'DESIGN_MARKDOWN_DESIGN_UNIT_REFERENCE_INVALID');
      }
    }

    await writeJsonAtomic(join(project.storagePath, 'project.json'), manifest);
    await writeJsonAtomic(join(project.storagePath, 'tokens.json'), tokens);
    await writeJsonAtomic(join(project.storagePath, 'components.json'), components);
    if (product) await writeJsonAtomic(join(project.storagePath, 'product.json'), product);
    if (importedDesignUnits) await writeJsonAtomic(join(project.storagePath, 'design-units.json'), designUnits);
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
    const screenIds = new Set(context.screens.map((screen) => screen.id));
    const errors = [];
    const warnings = [];
    if (!context.screens.some((screen) => screen.id === context.project.activeScreenId)) {
      errors.push(`activeScreenId ${context.project.activeScreenId} does not exist.`);
    }
    const componentMap = new Map(context.components.components.map((component) => [component.name, component]));
    const validateComposition = (screen, nodes, stateId = 'base') => {
      for (const node of nodes) {
        const contract = componentMap.get(node.component);
        const identity = `${screen.id}[${stateId}]/${node.id}`;
        if (!contract) {
          errors.push(`${identity} uses unregistered component ${node.component}.`);
          continue;
        }
        const allowedProps = new Set(componentPropNames(contract));
        for (const key of Object.keys(node.props ?? {})) if (!allowedProps.has(key)) errors.push(`${identity} uses unsupported prop ${node.component}.${key}.`);
        for (const definition of contract.props ?? []) {
          const value = node.props?.[definition.name];
          if (definition.required && value === undefined) errors.push(`${identity} is missing required prop ${node.component}.${definition.name}.`);
          else if (value !== undefined && !componentPropValueValid(definition, value)) errors.push(`${identity} prop ${node.component}.${definition.name} does not match type ${definition.type}.`);
        }
        if (node.variant && !(contract.variants ?? []).some((item) => item.id === node.variant)) errors.push(`${identity} uses unknown ${node.component} variant ${node.variant}.`);
        if (node.state && !(contract.states ?? []).some((item) => item.id === node.state)) errors.push(`${identity} uses unknown ${node.component} state ${node.state}.`);
      }
    };
    for (const screen of context.screens) {
      validateComposition(screen, screen.nodes);
      for (const state of screen.states ?? []) if (state.nodes) validateComposition(screen, state.nodes, state.id);
    }
    if (context.storage.migrationRequired) {
      warnings.push(`storageVersion ${context.storage.storageVersion} is readable compatibility state; migrate to ${context.storage.currentStorageVersion} before design-unit writes.`);
    }
    const assignedScreens = new Set();
    for (const unit of context.designUnits.units) {
      for (const screenId of unit.screenIds) {
        if (!screenIds.has(screenId)) errors.push(`Design unit ${unit.id} references unknown screen ${screenId}.`);
        assignedScreens.add(screenId);
      }
    }
    for (const screenId of screenIds) if (!assignedScreens.has(screenId)) warnings.push(`Screen ${screenId} is not assigned to a design unit.`);
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
      storageVersion: currentStorageVersion,
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
        { id: 'primary-flow', name: 'Primary product flow', userJob: 'Define the end-to-end user job.', screenIds: ['home'], entry: { screenId: 'home', stateId: 'normal' }, transitions: [], status: 'draft' },
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
    const components = starterComponentContracts();
    const designUnits = { schemaVersion: 1, units: [{
      id: 'primary',
      name: `${name} Primary Design`,
      screenFamily: 'unclassified',
      screenIds: ['home'],
      contractRefs: [],
    }] };
    const screen = { schemaVersion: 1, id: 'home', name: 'Home', device: 'iphone-16-pro', goal: 'Define the first screen goal.', primaryAction: 'continue', constraints: ['Use registered components and project tokens only.'], nodes: [
      { id: 'header', component: 'ScreenHeader', props: { eyebrow: 'New project', title: name } },
      { id: 'empty', component: 'EmptyState', props: { title: 'Start with a Product Contract', body: 'Define the User Job, full flow, information hierarchy, and interaction semantics before composing screens.' } },
      { id: 'continue', component: 'PrimaryAction', props: { label: 'Continue', activeLabel: 'Continue' } },
    ] };
    validateProjectManifest(manifest);
    validateTokens(tokens);
    validateComponents(components);
    validateProductModel(product);
    validateDesignUnits(designUnits);
    validateScreen(screen, 'home');
    const temporaryStoragePath = join(root, `.design-harness-${randomUUID()}.tmp`);
    await mkdir(root, { recursive: true });
    try {
      await writeJsonAtomic(join(temporaryStoragePath, 'project.json'), manifest);
      await writeJsonAtomic(join(temporaryStoragePath, 'tokens.json'), tokens);
      await writeJsonAtomic(join(temporaryStoragePath, 'components.json'), components);
      await writeJsonAtomic(join(temporaryStoragePath, 'product.json'), product);
      await writeJsonAtomic(join(temporaryStoragePath, 'design-units.json'), designUnits);
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
