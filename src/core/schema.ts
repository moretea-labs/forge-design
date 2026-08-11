export type DeviceId = 'iphone-16-pro';

export type TypographyToken = {
  size: number;
  lineHeight: number;
  weight: number;
};

export type DesignTokens = {
  schemaVersion: 1;
  meta: { name: string; version: string };
  color: Record<string, string>;
  spacing: Record<string, number>;
  radius: Record<string, number>;
  shadow: Record<string, string>;
  typography: Record<string, TypographyToken>;
  device: {
    iphoneWidth: number;
    iphoneHeight: number;
    safeTop: number;
    safeBottom: number;
  };
};

export type ScreenNode = {
  id: string;
  component: string;
  props?: Record<string, unknown>;
};

export type ScreenSpec = {
  schemaVersion: 1;
  id: string;
  name: string;
  device: DeviceId;
  goal: string;
  primaryAction: string;
  constraints: string[];
  nodes: ScreenNode[];
};

export type DesignIssue = {
  severity: 'error' | 'warning';
  rule: string;
  message: string;
  nodeId?: string;
};

export type ComponentContract = {
  name: string;
  purpose: string;
  allowedProps: string[];
  category: 'layout' | 'content' | 'control' | 'navigation';
};

export type ComponentContractsDocument = {
  schemaVersion: 1;
  components: ComponentContract[];
};

export type DesignProjectManifest = {
  schemaVersion: 1;
  id: string;
  name: string;
  storageVersion: string;
  designSystem: { name: string; version: string };
  activeScreenId: string;
};

export type DesignProjectSummary = {
  id: string;
  name: string;
  activeScreenId: string;
  designSystem: { name: string; version: string };
  root: string;
  storagePath: string;
};

export type DesignStorageContract = {
  canonicalDirectory: '.design-harness';
  sourceOfTruth: 'target-repository';
  versionControl: 'git';
  screenLayout: 'one-json-file-per-screen';
  browserStorageCanonical: false;
};

export type DesignProjectContext = {
  schemaVersion: 1;
  project: DesignProjectManifest;
  storage: DesignStorageContract;
  tokens: DesignTokens;
  components: ComponentContractsDocument;
  screens: ScreenSpec[];
};

export type DesignProjectPaths = {
  projectRoot: string;
  storageRoot: string;
  manifest: string;
  tokens: string;
  components: string;
  screens: string;
};
