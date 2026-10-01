import { createComponentRegistry } from './registry';
import { initialScreenStateId, resolveScreenState, type ComponentContract, type ComponentContractsDocument, type DesignReviewProfile, type ScreenNode, type ScreenSpec } from './schema';

export type DesignPrimitive = NonNullable<ComponentContract['preview']>['nodes'][number]['primitive'];
export type DesignInteraction = NonNullable<ScreenNode['interactions']>[number];
export type DesignAction = DesignInteraction['actions'][number];

export type DesignViewport = {
  kind: 'device' | 'desktop' | 'web';
  platform: 'ios' | 'android' | 'macos' | 'windows' | 'web' | 'other';
  preset?: string;
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
};

export type DesignIRStyle = {
  axis?: 'vertical' | 'horizontal';
  gap?: string;
  padding?: string;
  typography?: string;
  color?: string;
  background?: string;
  radius?: string;
  alignment?: 'leading' | 'center' | 'trailing' | 'stretch';
  justify?: 'start' | 'center' | 'between' | 'end';
  width?: 'fill' | 'hug';
  height?: 'fill' | 'hug';
  overflow?: 'visible' | 'hidden' | 'auto';
  columns?: number;
  shadow?: string;
  material?: string;
};

export type DesignIRNode = {
  id: string;
  sourceNodeId: string;
  component: string;
  primitive: DesignPrimitive | 'legacy';
  content?: string;
  iconName?: string;
  style: DesignIRStyle;
  interactionRole?: ComponentContract['interactionRole'];
  interactions: DesignInteraction[];
  children: DesignIRNode[];
  diagnostics: string[];
};

export type DesignIR = {
  schemaVersion: 1;
  screenId: string;
  screenName: string;
  screenStateId: string;
  goal: string;
  primaryAction: string;
  viewport: DesignViewport;
  nodes: DesignIRNode[];
  diagnostics: string[];
};

const legacyIphoneViewport: DesignViewport = {
  kind: 'device', platform: 'ios', preset: 'iphone-16-pro', width: 393, height: 852, safeTop: 54, safeBottom: 30,
};

const neutralViewport: DesignViewport = {
  kind: 'web', platform: 'web', width: 1024, height: 768, safeTop: 0, safeBottom: 0,
};

export function resolveDesignViewport(spec: ScreenSpec, profile?: DesignReviewProfile | null): DesignViewport {
  const source = profile?.viewport ?? spec.viewport;
  if (source) {
    const declared = spec.viewport;
    const platform = source.platform ?? declared?.platform ?? (spec.device === 'iphone-16-pro' ? 'ios' : 'other');
    const kind = source.kind ?? declared?.kind ?? (platform === 'macos' || platform === 'windows' ? 'desktop' : platform === 'web' ? 'web' : 'device');
    const preset = source.preset ?? declared?.preset;
    return {
      kind,
      platform,
      ...(preset ? { preset } : {}),
      width: source.width,
      height: source.height,
      safeTop: source.safeTop,
      safeBottom: source.safeBottom,
    };
  }
  if (spec.device === 'iphone-16-pro') return legacyIphoneViewport;
  return neutralViewport;
}

function boundContent(item: NonNullable<ComponentContract['preview']>['nodes'][number], props?: Record<string, unknown>): string | undefined {
  if (!item.content) return undefined;
  if (item.content.kind === 'literal') return item.content.value;
  const value = props?.[item.content.value];
  if (value === undefined || value === null || value === '') return item.content.fallback ?? '';
  return String(value);
}

function compileComponentNode(screenNode: ScreenNode, contract: ComponentContract): DesignIRNode[] {
  const preview = contract.preview?.nodes ?? [];
  if (preview.length === 0) {
    return [{
      id: screenNode.id,
      sourceNodeId: screenNode.id,
      component: contract.name,
      primitive: 'legacy',
      content: contract.purpose,
      style: {},
      interactionRole: contract.interactionRole,
      interactions: screenNode.interactions ?? [],
      children: [],
      diagnostics: ['declarative_preview_missing'],
    }];
  }

  const variant = screenNode.variant ?? contract.variants?.[0]?.id;
  const state = screenNode.state ?? contract.states?.[0]?.id;
  const visible = preview.filter((item) => {
    if (item.when?.variants?.length && (!variant || !item.when.variants.includes(variant))) return false;
    if (item.when?.states?.length && (!state || !item.when.states.includes(state))) return false;
    return true;
  });
  const byParent = new Map<string | undefined, typeof visible>();
  for (const item of visible) {
    const children = byParent.get(item.parentId) ?? [];
    children.push(item);
    byParent.set(item.parentId, children);
  }

  const compile = (item: (typeof visible)[number]): DesignIRNode => ({
    id: `${screenNode.id}:${item.id}`,
    sourceNodeId: screenNode.id,
    component: contract.name,
    primitive: item.primitive,
    ...(boundContent(item, screenNode.props) !== undefined ? { content: boundContent(item, screenNode.props) } : {}),
    ...(item.iconName ? { iconName: item.iconName } : {}),
    style: { ...(item.style ?? {}) },
    interactionRole: contract.interactionRole,
    interactions: ['button', 'input', 'toggle', 'segmented', 'menu', 'selection'].includes(item.primitive) ? (screenNode.interactions ?? []) : [],
    children: (byParent.get(item.id) ?? []).map(compile),
    diagnostics: [],
  });

  const roots = (byParent.get(undefined) ?? []).map(compile);
  const visibleIds = new Set(visible.map((item) => item.id));
  const orphanIds = visible.filter((item) => item.parentId && !visibleIds.has(item.parentId)).map((item) => item.id);
  if (orphanIds.length > 0) roots.push({
    id: `${screenNode.id}:orphans`, sourceNodeId: screenNode.id, component: contract.name, primitive: 'legacy',
    content: `Orphan preview nodes: ${orphanIds.join(', ')}`, style: {}, interactionRole: contract.interactionRole,
    interactions: [], children: [], diagnostics: ['orphan_preview_nodes'],
  });
  return roots;
}

export function compileScreenToDesignIR(
  spec: ScreenSpec,
  components: ComponentContractsDocument,
  profile?: DesignReviewProfile | null,
  stateId?: string,
): DesignIR {
  const resolvedStateId = stateId ?? initialScreenStateId(spec);
  const resolved = resolveScreenState(spec, resolvedStateId);
  const registry = createComponentRegistry(components);
  const diagnostics: string[] = [];
  const nodes = resolved.nodes.flatMap((screenNode) => {
    const contract = registry[screenNode.component];
    if (!contract) {
      diagnostics.push(`unregistered_component:${screenNode.component}`);
      return [{
        id: screenNode.id, sourceNodeId: screenNode.id, component: screenNode.component, primitive: 'legacy' as const,
        content: 'Unregistered component', style: {}, interactions: screenNode.interactions ?? [], children: [], diagnostics: ['unregistered_component'],
      }];
    }
    return compileComponentNode(screenNode, contract);
  });
  return {
    schemaVersion: 1,
    screenId: spec.id,
    screenName: spec.name,
    screenStateId: resolvedStateId,
    goal: resolved.goal,
    primaryAction: resolved.primaryAction,
    viewport: resolveDesignViewport(resolved, profile),
    nodes,
    diagnostics,
  };
}
