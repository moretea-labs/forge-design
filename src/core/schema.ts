export type {
  ComponentContractsDocument,
  DesignProjectManifest,
  DesignTokens,
  DesignUnitsDocument,
  ProductDesignModel,
  ScreenSpec,
} from './schema.generated';

import type {
  ComponentContractsDocument,
  DesignProjectManifest,
  DesignTokens,
  DesignUnitsDocument,
  ProductDesignModel,
  ScreenSpec,
} from './schema.generated';

export type DeviceId = ScreenSpec['device'];
export type TypographyToken = DesignTokens['typography'][string];
export type ScreenNode = ScreenSpec['nodes'][number];
export type ComponentContract = ComponentContractsDocument['components'][number];
export type ProductInformationRole = ProductDesignModel['brief']['informationHierarchy'][number]['role'];
export type ProductPriority = ProductDesignModel['brief']['informationHierarchy'][number]['priority'];
export type ProductReviewStage = ProductDesignModel['golden']['review']['stage'];
export type DesignUnit = DesignUnitsDocument['units'][number];
export type DesignReviewProfile = NonNullable<DesignUnitsDocument['reviewProfiles']>[number];
export type DesignReviewStatus = {
  schemaVersion: 1;
  units: Array<{
    unitId: string;
    reviewStatus: 'draft' | 'review' | 'visual_reviewed' | 'rejected';
    currentDigest: string;
    acceptance: NonNullable<DesignUnit['review']>['acceptance'] | null;
    acceptanceCurrent: boolean;
  }>;
  freeze: NonNullable<DesignUnitsDocument['freeze']> | null;
  freezeCurrent: boolean;
};
export type ProductContractRef = DesignUnit['contractRefs'][number];

export type ProductGoldenGate = {
  modeled: boolean;
  status: 'unmodeled' | 'draft' | 'candidate' | 'approved';
  productContractReady: boolean;
  flowReady: boolean;
  interactionPatternsReady: boolean;
  runtimeReviewStage: ProductReviewStage;
  runtimeEvidenceReady: boolean;
  userDecision: 'pending' | 'accepted' | 'rejected';
  canApprove: boolean;
  blockers: string[];
};

export type DesignIssue = {
  severity: 'error' | 'warning';
  rule: string;
  message: string;
  nodeId?: string;
};

export type DesignStorageContract = {
  canonicalDirectory: '.design-harness';
  sourceOfTruth: 'target-repository';
  versionControl: 'git';
  screenLayout: 'one-json-file-per-screen';
  browserStorageCanonical: false;
  storageVersion: DesignProjectManifest['storageVersion'];
  currentStorageVersion: string;
  migrationRequired: boolean;
};

export type DesignProjectSummary = {
  id: string;
  name: string;
  activeScreenId: string;
  designSystem: { name: string; version: string };
  root: string;
  storagePath: string;
};

export type DesignProjectContext = {
  schemaVersion: 1;
  project: DesignProjectManifest;
  storage: DesignStorageContract;
  tokens: DesignTokens;
  components: ComponentContractsDocument;
  screens: ScreenSpec[];
  product: ProductDesignModel | null;
  designUnits: DesignUnitsDocument;
  goldenGate: ProductGoldenGate;
};

export type DesignProjectPaths = {
  projectRoot: string;
  storageRoot: string;
  manifest: string;
  tokens: string;
  components: string;
  screens: string;
  product: string;
  designUnits: string;
};

export type ScreenStateVariant = NonNullable<ScreenSpec['states']>[number];
export type ProductFlow = ProductDesignModel['flows'][number];
export type ProductFlowTransition = NonNullable<ProductFlow['transitions']>[number];

export function screenStateIds(spec: ScreenSpec): string[] {
  return spec.states && spec.states.length > 0 ? spec.states.map((state) => state.id) : ['normal'];
}

export function initialScreenStateId(spec: ScreenSpec): string {
  return spec.states && spec.states.length > 0 ? (spec.initialStateId ?? spec.states[0].id) : 'normal';
}

export function resolveScreenState(spec: ScreenSpec, stateId?: string): ScreenSpec {
  if (!spec.states || spec.states.length === 0) return spec;
  const resolvedStateId = stateId ?? initialScreenStateId(spec);
  const variant = spec.states.find((state) => state.id === resolvedStateId);
  if (!variant) return spec;
  return {
    ...spec,
    primaryAction: variant.primaryAction ?? spec.primaryAction,
    constraints: variant.constraints ?? spec.constraints,
    nodes: variant.nodes ?? spec.nodes,
  };
}
