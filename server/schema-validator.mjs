import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const schemaDirectory = join(moduleDirectory, '..', 'schemas');
const schemaCache = new Map();

export class SchemaValidationError extends Error {
  constructor(schemaName, issues) {
    super(`${schemaName} failed schema validation: ${issues[0] ?? 'unknown validation error'}`);
    this.name = 'SchemaValidationError';
    this.code = 'SCHEMA_VALIDATION_FAILED';
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

export function loadCanonicalSchema(schemaName) {
  if (!schemaCache.has(schemaName)) {
    const path = join(schemaDirectory, `${schemaName}.schema.json`);
    schemaCache.set(schemaName, JSON.parse(readFileSync(path, 'utf8')));
  }
  return schemaCache.get(schemaName);
}

const describeType = (value) => Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const stableValue = (value) => JSON.stringify(value, Object.keys(value && typeof value === 'object' && !Array.isArray(value) ? value : {}).sort());

function validateNode(schema, value, path, issues) {
  if (!schema || typeof schema !== 'object') return;

  if (Object.prototype.hasOwnProperty.call(schema, 'const') && value !== schema.const) {
    issues.push(`${path} must equal ${JSON.stringify(schema.const)}.`);
    return;
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => Object.is(item, value))) {
    issues.push(`${path} must be one of ${schema.enum.map((item) => JSON.stringify(item)).join(', ')}.`);
    return;
  }

  if (schema.type === 'object') {
    if (!isPlainObject(value)) {
      issues.push(`${path} must be an object; received ${describeType(value)}.`);
      return;
    }
    const properties = schema.properties ?? {};
    const required = new Set(schema.required ?? []);
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) issues.push(`${path}.${key} is required.`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (Object.prototype.hasOwnProperty.call(properties, key)) {
        validateNode(properties[key], child, `${path}.${key}`, issues);
      } else if (schema.additionalProperties === false) {
        issues.push(`${path}.${key} is not allowed.`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        validateNode(schema.additionalProperties, child, `${path}.${key}`, issues);
      }
    }
    if (typeof schema.minProperties === 'number' && Object.keys(value).length < schema.minProperties) {
      issues.push(`${path} must contain at least ${schema.minProperties} properties.`);
    }
    return;
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      issues.push(`${path} must be an array; received ${describeType(value)}.`);
      return;
    }
    if (schema.items) value.forEach((item, index) => validateNode(schema.items, item, `${path}[${index}]`, issues));
    if (schema.uniqueItems) {
      const seen = new Set();
      for (const item of value) {
        const key = stableValue(item);
        if (seen.has(key)) {
          issues.push(`${path} must contain unique items.`);
          break;
        }
        seen.add(key);
      }
    }
    return;
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      issues.push(`${path} must be a string; received ${describeType(value)}.`);
      return;
    }
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) issues.push(`${path} must contain at least ${schema.minLength} characters.`);
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) issues.push(`${path} must match ${schema.pattern}.`);
    return;
  }

  if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push(`${path} must be a finite number; received ${describeType(value)}.`);
      return;
    }
    if (typeof schema.minimum === 'number' && value < schema.minimum) issues.push(`${path} must be >= ${schema.minimum}.`);
    return;
  }

  if (schema.type === 'boolean' && typeof value !== 'boolean') issues.push(`${path} must be a boolean; received ${describeType(value)}.`);
}

export function validateCanonicalDocument(schemaName, document) {
  const issues = [];
  validateNode(loadCanonicalSchema(schemaName), document, '$', issues);
  if (issues.length) throw new SchemaValidationError(schemaName, issues);
  return document;
}
