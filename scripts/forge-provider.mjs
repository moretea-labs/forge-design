#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { createProjectStore } from '../server/project-store.mjs';
import { executeProviderAction, providerActions, providerCapabilities } from '../server/provider-actions.mjs';
import { PACKAGE_VERSION } from './version.mjs';

const VERSION = PACKAGE_VERSION;
const PLUGIN_ID = 'design';
const store = createProjectStore();

function write(value) { process.stdout.write(`${JSON.stringify(value)}\n`); }
function success(requestId, result) { write({ schemaVersion: 1, type: 'result', requestId, ok: true, result }); }
function failure(requestId, error) {
  write({ schemaVersion: 1, type: 'result', requestId, ok: false, error: { code: error?.code || 'FORGE_DESIGN_PROVIDER_ERROR', message: String(error?.message || error), retryable: false } });
}

async function execute(actionId, input = {}) {
  if (actionId === 'manifest') return { id: PLUGIN_ID, name: 'Forge Design', version: VERSION, protocolVersion: '1.0', mode: 'managed', scope: 'controller', provider: 'moretea-labs', capabilities: providerCapabilities, actions: providerActions };
  if (actionId === 'health') return { state: 'ready', provider: 'forge-design', version: VERSION };
  return executeProviderAction(store, actionId, input);
}

write({ schemaVersion: 1, type: 'handshake', protocolVersion: 1, pluginId: PLUGIN_ID, helperVersion: VERSION, capabilities: providerCapabilities });
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
