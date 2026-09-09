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
