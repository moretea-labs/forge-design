import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageDocument = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
if (typeof packageDocument.version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(packageDocument.version)) {
  throw new Error('FORGE_DESIGN_PACKAGE_VERSION_INVALID');
}
export const PACKAGE_VERSION = packageDocument.version;
