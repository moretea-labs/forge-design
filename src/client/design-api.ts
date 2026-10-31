import type { ComponentContractsDocument, DesignProjectContext, DesignProjectPaths, DesignProjectSummary, DesignReviewStatus, DesignTokens, ProductDesignModel, ScreenSpec } from '../core/schema';

type ApiErrorPayload = { error?: { code?: string; message?: string } };
export type DesignModuleScreen = { id: string; name: string; badge: string; kind: string };
export type DesignSourceModule = { id: string; name: string; description: string; files: string[]; screens?: DesignModuleScreen[]; preview?: { entry: string; screenId: string }; previewModuleId?: string; readOnly?: boolean };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  });
  const payload = await response.json() as T & ApiErrorPayload;
  if (!response.ok) throw new Error(payload.error?.message ?? `Design API request failed (${response.status}).`);
  return payload;
}

const projectPath = (projectId: string, suffix = '') => `/api/design/projects/${encodeURIComponent(projectId)}${suffix}`;

export const visualAssetContentUrl = (projectId: string, assetId: string) =>
  projectPath(projectId, `/visual-assets/${encodeURIComponent(assetId)}/content`);

export const designApi = {
  async listProjects(): Promise<DesignProjectSummary[]> {
    const payload = await request<{ projects: DesignProjectSummary[] }>('/api/design/projects');
    return payload.projects;
  },
  getContext: (projectId: string) => request<DesignProjectContext>(projectPath(projectId, '/context')),
  listModules: async (projectId: string): Promise<DesignSourceModule[]> => (await request<{ modules: DesignSourceModule[] }>(projectPath(projectId, '/modules'))).modules,
  async exportModule(projectId: string, moduleId: string): Promise<Blob> {
    const response = await fetch(projectPath(projectId, '/modules/' + encodeURIComponent(moduleId) + '/export.md'));
    if (!response.ok) {
      const payload = await response.json() as ApiErrorPayload;
      throw new Error(payload.error?.message ?? 'Design module export failed.');
    }
    return response.blob();
  },
  modulePreviewUrl: (projectId: string, module: DesignSourceModule, screenId = module.preview?.screenId ?? '') => projectPath(projectId, '/modules/' + encodeURIComponent(module.previewModuleId ?? module.id) + '/preview/' + encodeURIComponent(module.preview?.entry.split('/').at(-1) ?? 'prototype.html')) + '?screen=' + encodeURIComponent(screenId),
  getPaths: (projectId: string) => request<DesignProjectPaths>(projectPath(projectId, '/paths')),
  getReviewStatus: (projectId: string) => request<DesignReviewStatus>(projectPath(projectId, '/review-status')),
  validate: (projectId: string) => request<{ ok: boolean; projectId: string; errors: string[]; warnings: string[]; goldenGate: DesignProjectContext['goldenGate'] }>(projectPath(projectId, '/validate')),
  putProduct: (projectId: string, product: ProductDesignModel) => request<ProductDesignModel>(projectPath(projectId, '/product'), { method: 'PUT', body: JSON.stringify(product) }),
  putTokens: (projectId: string, tokens: DesignTokens) => request<DesignTokens>(projectPath(projectId, '/tokens'), { method: 'PUT', body: JSON.stringify(tokens) }),
  putComponents: (projectId: string, components: ComponentContractsDocument) => request<ComponentContractsDocument>(projectPath(projectId, '/components'), { method: 'PUT', body: JSON.stringify(components) }),
  putScreen: (projectId: string, screen: ScreenSpec) => request<ScreenSpec>(projectPath(projectId, `/screens/${encodeURIComponent(screen.id)}`), { method: 'PUT', body: JSON.stringify(screen) }),
  createScreen: (projectId: string, screen: ScreenSpec) => request<ScreenSpec>(projectPath(projectId, '/screens'), { method: 'POST', body: JSON.stringify(screen) }),
};
