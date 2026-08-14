import { DesignStoreError, createProjectStore } from './project-store.mjs';

const maxBodyBytes = 1024 * 1024;
const maxMarkdownBodyBytes = 8 * 1024 * 1024;

function sendText(response, status, body, contentType = 'text/plain; charset=utf-8') {
  response.statusCode = status;
  response.setHeader('Content-Type', contentType);
  response.setHeader('Cache-Control', 'no-store');
  response.end(body);
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(`${JSON.stringify(body)}\n`);
}

async function readTextBody(request, maxBytes = maxMarkdownBodyBytes) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new DesignStoreError('Request body is too large.', 413, 'REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  if (chunks.length === 0) throw new DesignStoreError('Request body is required.', 400, 'BODY_REQUIRED');
  return Buffer.concat(chunks).toString('utf8');
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new DesignStoreError('Request body is too large.', 413, 'REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  if (chunks.length === 0) throw new DesignStoreError('JSON request body is required.', 400, 'BODY_REQUIRED');
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    throw new DesignStoreError(`Invalid JSON body: ${error.message}`, 400, 'INVALID_JSON_BODY');
  }
}

function route(pathname) {
  return pathname.split('/').filter(Boolean).map(decodeURIComponent);
}

export function designHarnessApiPlugin(options = {}) {
  const store = options.store ?? createProjectStore(options);
  return {
    name: 'design-harness-local-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        if (!url.pathname.startsWith('/api/design')) return next();
        try {
          const segments = route(url.pathname);
          const method = request.method ?? 'GET';
          if ((segments.length === 2 || (segments.length === 3 && segments[2] === 'projects')) && method === 'GET') {
            return sendJson(response, 200, { projects: await store.listProjects() });
          }
          if (segments[2] !== 'projects' || !segments[3]) throw new DesignStoreError('Unknown Design Harness API route.', 404, 'ROUTE_NOT_FOUND');
          const projectId = segments[3];
          if (segments.length === 4 && method === 'GET') {
            const [project, paths] = await Promise.all([store.getManifest(projectId), store.getPaths(projectId)]);
            return sendJson(response, 200, { project, paths });
          }
          const resource = segments[4];
          if (resource === 'context' && method === 'GET') return sendJson(response, 200, await store.getContext(projectId));
          if (resource === 'design.md') {
            if (method === 'GET') return sendText(response, 200, await store.exportDesignMarkdown(projectId), 'text/markdown; charset=utf-8');
            if (method === 'PUT') return sendJson(response, 200, await store.importDesignMarkdown(projectId, await readTextBody(request)));
          }
          if (resource === 'validate' && method === 'GET') return sendJson(response, 200, await store.validateProject(projectId));
          if (resource === 'paths' && method === 'GET') return sendJson(response, 200, await store.getPaths(projectId));
          if (resource === 'product') {
            if (method === 'GET') return sendJson(response, 200, await store.getProductModel(projectId));
            if (method === 'PUT') return sendJson(response, 200, await store.putProductModel(projectId, await readJsonBody(request)));
          }
          if (resource === 'tokens') {
            if (method === 'GET') return sendJson(response, 200, await store.getTokens(projectId));
            if (method === 'PUT') return sendJson(response, 200, await store.putTokens(projectId, await readJsonBody(request)));
          }
          if (resource === 'components') {
            if (method === 'GET') return sendJson(response, 200, await store.getComponents(projectId));
            if (method === 'PUT') return sendJson(response, 200, await store.putComponents(projectId, await readJsonBody(request)));
          }
          if (resource === 'screens') {
            if (segments.length === 5 && method === 'GET') return sendJson(response, 200, { screens: await store.listScreens(projectId) });
            if (segments.length === 5 && method === 'POST') return sendJson(response, 201, await store.createScreen(projectId, await readJsonBody(request)));
            const screenId = segments[5];
            if (!screenId) throw new DesignStoreError('screen id is required.', 400, 'SCREEN_ID_REQUIRED');
            if (method === 'GET') return sendJson(response, 200, await store.getScreen(projectId, screenId));
            if (method === 'PUT') {
              const document = await readJsonBody(request);
              if (document.id !== screenId) throw new DesignStoreError(`URL/document screen id mismatch: ${screenId} != ${document.id}.`, 400, 'SCREEN_ID_MISMATCH');
              return sendJson(response, 200, await store.putScreen(projectId, document));
            }
          }
          throw new DesignStoreError('Unknown Design Harness API route.', 404, 'ROUTE_NOT_FOUND');
        } catch (error) {
          if (error instanceof DesignStoreError) return sendJson(response, error.status, { error: { code: error.code, message: error.message } });
          console.error(error);
          return sendJson(response, 500, { error: { code: 'INTERNAL_ERROR', message: 'Design Harness API failed.' } });
        }
      });
    },
  };
}
