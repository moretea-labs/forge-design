#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DesignStoreError, createProjectStore } from '../server/project-store.mjs';

function parseArguments(values) {
  const [command, ...rest] = values;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith('--')) throw new DesignStoreError(`Unexpected argument: ${item}.`, 400, 'INVALID_ARGUMENT');
    const name = item.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith('--')) throw new DesignStoreError(`Missing value for --${name}.`, 400, 'INVALID_ARGUMENT');
    options[name] = value;
    index += 1;
  }
  return { command, options };
}

const required = (options, name) => {
  if (!options[name]) throw new DesignStoreError(`--${name} is required.`, 400, 'MISSING_ARGUMENT');
  return options[name];
};

async function readTextInput(path) {
  try {
    return await readFile(resolve(path), 'utf8');
  } catch (error) {
    throw new DesignStoreError(`Unable to read text file ${path}: ${error.message}`, 400, 'INPUT_READ_FAILED');
  }
}

async function readInput(path) {
  try {
    return JSON.parse(await readFile(resolve(path), 'utf8'));
  } catch (error) {
    throw new DesignStoreError(`Unable to read JSON file ${path}: ${error.message}`, 400, 'INPUT_READ_FAILED');
  }
}

async function run() {
  const { command, options } = parseArguments(process.argv.slice(2));
  const store = createProjectStore();
  switch (command) {
    case 'projects': return { projects: await store.listProjects() };
    case 'registered-roots': return { projectRoots: await store.getRegisteredProjectRoots() };
    case 'register': return store.registerProjectRoot(required(options, 'project-root'));
    case 'unregister': return store.unregisterProjectRoot(required(options, 'project-root'));
    case 'read-project': return store.getManifest(required(options, 'project'));
    case 'context': return store.getContext(required(options, 'project'));
    case 'validate': return store.validateProject(required(options, 'project'));
    case 'export-design-md': {
      const projectId = required(options, 'project');
      const content = await store.exportDesignMarkdown(projectId);
      if (options.file) {
        const target = resolve(options.file);
        await writeFile(target, content, 'utf8');
        return { projectId, format: 'design.md', file: target, bytes: Buffer.byteLength(content, 'utf8') };
      }
      return { projectId, format: 'design.md', content };
    }
    case 'import-design-md': return store.importDesignMarkdown(required(options, 'project'), await readTextInput(required(options, 'file')));
    case 'path': return store.getPaths(required(options, 'project'));
    case 'get-product': return store.getProductModel(required(options, 'project'));
    case 'put-product': return store.putProductModel(required(options, 'project'), await readInput(required(options, 'file')));
    case 'get-tokens': return store.getTokens(required(options, 'project'));
    case 'put-tokens': return store.putTokens(required(options, 'project'), await readInput(required(options, 'file')));
    case 'get-components': return store.getComponents(required(options, 'project'));
    case 'put-components': return store.putComponents(required(options, 'project'), await readInput(required(options, 'file')));
    case 'list-screens': return { screens: await store.listScreens(required(options, 'project')) };
    case 'get-screen': return store.getScreen(required(options, 'project'), required(options, 'screen'));
    case 'put-screen': return store.putScreen(required(options, 'project'), await readInput(required(options, 'file')));
    case 'init': return store.initProject({
      projectRoot: required(options, 'project-root'),
      id: required(options, 'project'),
      name: options.name ?? options.project,
    });
    default:
      throw new DesignStoreError('Unknown command. Use projects, registered-roots, register, unregister, read-project, context, validate, export-design-md, import-design-md, path, get-product, put-product, get-tokens, put-tokens, get-components, put-components, list-screens, get-screen, put-screen, or init.', 400, 'UNKNOWN_COMMAND');
  }
}

try {
  const result = await run();
  process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
  if (result && result.ok === false) process.exitCode = 1;
} catch (error) {
  const storeError = error instanceof DesignStoreError ? error : new DesignStoreError(error.message, 500, 'UNEXPECTED_ERROR');
  process.stdout.write(`${JSON.stringify({ ok: false, error: { code: storeError.code, message: storeError.message } }, null, 2)}\n`);
  process.exitCode = 1;
}
