#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(root, 'src', 'core', 'schema.generated.ts');
const mappings = [
  ['project', 'DesignProjectManifest'],
  ['tokens', 'DesignTokens'],
  ['components', 'ComponentContractsDocument'],
  ['product', 'ProductDesignModel'],
  ['screen', 'ScreenSpec'],
  ['design-units', 'DesignUnitsDocument'],
];

function literal(value) {
  return JSON.stringify(value);
}

function schemaType(schema, indent = '') {
  if (Object.prototype.hasOwnProperty.call(schema, 'const')) return literal(schema.const);
  if (Array.isArray(schema.enum)) return schema.enum.map(literal).join(' | ');
  if (schema.type === 'string') return 'string';
  if (schema.type === 'number') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'array') return `Array<${schemaType(schema.items ?? {}, indent)}>`;
  if (schema.type === 'object') {
    const properties = schema.properties ?? {};
    const required = new Set(schema.required ?? []);
    const entries = Object.entries(properties);
    let objectType = '{}';
    if (entries.length) {
      const nextIndent = `${indent}  `;
      const lines = entries.map(([name, child]) => `${nextIndent}${JSON.stringify(name)}${required.has(name) ? '' : '?'}: ${schemaType(child, nextIndent)};`);
      objectType = `{\n${lines.join('\n')}\n${indent}}`;
    }
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      const recordType = `Record<string, ${schemaType(schema.additionalProperties, indent)}>`;
      return entries.length ? `(${objectType} & ${recordType})` : recordType;
    }
    if (schema.additionalProperties !== false) {
      return entries.length ? `(${objectType} & Record<string, unknown>)` : 'Record<string, unknown>';
    }
    return objectType;
  }
  throw new Error(`Unsupported canonical schema fragment: ${JSON.stringify(schema)}`);
}

const generated = [];
for (const [fileName, typeName] of mappings) {
  const source = JSON.parse(await readFile(join(root, 'schemas', `${fileName}.schema.json`), 'utf8'));
  generated.push(`export type ${typeName} = ${schemaType(source)};`);
}
const contents = `// GENERATED FILE. DO NOT EDIT.\n// Source of truth: schemas/*.schema.json via scripts/generate-schema-types.mjs.\n\n${generated.join('\n\n')}\n`;

if (process.argv.includes('--check')) {
  const current = await readFile(outputPath, 'utf8').catch(() => '');
  if (current !== contents) {
    console.error('src/core/schema.generated.ts is stale. Run: npm run generate:schema-types');
    process.exit(1);
  }
} else {
  await writeFile(outputPath, contents, 'utf8');
}
