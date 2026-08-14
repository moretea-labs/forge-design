#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { createProjectStore } from '../server/project-store.mjs';

const VERSION = '0.4.0';
const PLUGIN_ID = 'design';
const capabilities = ['design.projects', 'design.read', 'design.write'];
const actions = ['design_list_projects', 'design_register_project', 'design_get_context', 'design_get_product_model', 'design_put_product_model', 'design_validate', 'design_export_markdown', 'design_import_markdown'];
const store = createProjectStore();

function write(value) { process.stdout.write(`${JSON.stringify(value)}\n`); }
function success(requestId, result) { write({ schemaVersion: 1, type: 'result', requestId, ok: true, result }); }
function failure(requestId, error) {
  write({ schemaVersion: 1, type: 'result', requestId, ok: false, error: { code: error?.code || 'FORGE_DESIGN_PROVIDER_ERROR', message: String(error?.message || error), retryable: false } });
}

async function execute(actionId, input = {}) {
  switch (actionId) {
    case 'manifest': return { id: PLUGIN_ID, name: 'Forge Design', version: VERSION, protocolVersion: '1.0', mode: 'managed', scope: 'controller', provider: 'moretea-labs', capabilities, actions };
    case 'health': return { state: 'ready', provider: 'forge-design', version: VERSION };
    case 'design_list_projects': return { projects: await store.listProjects() };
    case 'design_register_project': return await store.registerProjectRoot(input.project_root);
    case 'design_get_context': return await store.getContext(input.project_id);
    case 'design_get_product_model': return await store.getProductModel(input.project_id);
    case 'design_put_product_model': return await store.putProductModel(input.project_id, input.product);
    case 'design_validate': return await store.validateProject(input.project_id);
    case 'design_export_markdown': return { project_id: input.project_id, markdown: await store.exportDesignMarkdown(input.project_id) };
    case 'design_import_markdown': return await store.importDesignMarkdown(input.project_id, input.markdown);
    default: throw Object.assign(new Error(`Unknown action: ${actionId}`), { code: 'FORGE_DESIGN_ACTION_UNKNOWN' });
  }
}

write({ schemaVersion: 1, type: 'handshake', protocolVersion: 1, pluginId: PLUGIN_ID, helperVersion: VERSION, capabilities });
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
let handled = false;
lines.on('line', async (line) => {
  if (handled || !line.trim()) return;
  handled = true;
  let message;
  try {
    message = JSON.parse(line);
    if (message?.schemaVersion !== 1 || message?.type !== 'execute' || typeof message?.requestId !== 'string') throw Object.assign(new Error('Invalid managed provider request.'), { code: 'FORGE_DESIGN_PROTOCOL_INVALID' });
    success(message.requestId, await execute(message.actionId, message.input || {}));
  } catch (error) {
    failure(message?.requestId || 'unknown', error);
  } finally {
    lines.close();
  }
});
