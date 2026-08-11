import type { ComponentContractsDocument, DesignProjectContext, DesignProjectPaths, DesignProjectSummary, DesignTokens, ScreenSpec } from '../core/schema';

type ApiErrorPayload = { error?: { code?: string; message?: string } };

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

export const designApi = {
  async listProjects(): Promise<DesignProjectSummary[]> {
    const payload = await request<{ projects: DesignProjectSummary[] }>('/api/design/projects');
    return payload.projects;
  },
  getContext: (projectId: string) => request<DesignProjectContext>(projectPath(projectId, '/context')),
  getPaths: (projectId: string) => request<DesignProjectPaths>(projectPath(projectId, '/paths')),
  validate: (projectId: string) => request<{ ok: boolean; projectId: string; errors: string[] }>(projectPath(projectId, '/validate')),
  putTokens: (projectId: string, tokens: DesignTokens) => request<DesignTokens>(projectPath(projectId, '/tokens'), { method: 'PUT', body: JSON.stringify(tokens) }),
  putComponents: (projectId: string, components: ComponentContractsDocument) => request<ComponentContractsDocument>(projectPath(projectId, '/components'), { method: 'PUT', body: JSON.stringify(components) }),
  putScreen: (projectId: string, screen: ScreenSpec) => request<ScreenSpec>(projectPath(projectId, `/screens/${encodeURIComponent(screen.id)}`), { method: 'PUT', body: JSON.stringify(screen) }),
  createScreen: (projectId: string, screen: ScreenSpec) => request<ScreenSpec>(projectPath(projectId, '/screens'), { method: 'POST', body: JSON.stringify(screen) }),
};
