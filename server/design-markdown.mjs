const FORMAT_VERSION = 2;
const SUPPORTED_FORMAT_VERSIONS = new Set([1, 2]);
const FORMAT_MARKER = `<!-- design-harness-format:${FORMAT_VERSION} -->`;
const MAX_MARKDOWN_BYTES = 16 * 1024 * 1024;

export class DesignMarkdownError extends Error {
  constructor(message, code = 'INVALID_DESIGN_MARKDOWN') {
    super(message);
    this.name = 'DesignMarkdownError';
    this.code = code;
  }
}

function compactHeading(value) {
  return String(value ?? 'Untitled').replace(/\s+/g, ' ').trim() || 'Untitled';
}

function jsonSection(key, title, document) {
  const fence = '```';
  return `## ${title}\n\n${fence}json design-harness:${key}\n${JSON.stringify(document, null, 2)}\n${fence}\n`;
}

export function renderDesignMarkdown(context) {
  if (!context || typeof context !== 'object') throw new DesignMarkdownError('Design context is required.', 'DESIGN_MARKDOWN_CONTEXT_REQUIRED');
  const screens = [...(context.screens ?? [])].sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const parts = [
    FORMAT_MARKER,
    '',
    `# Design Project: ${compactHeading(context.project?.name)}`,
    '',
    '> Portable AI/human-readable view of the canonical `.design-harness` JSON assets. The fenced JSON sections are authoritative for import.',
    '',
    jsonSection('project', 'Project', context.project).trimEnd(),
  ];
  if (context.product) parts.push('', jsonSection('product', 'Product Contract', context.product).trimEnd());
  if (context.designUnits) parts.push('', jsonSection('design-units', 'Design Units', context.designUnits).trimEnd());
  parts.push(
    '',
    jsonSection('tokens', 'Design Tokens', context.tokens).trimEnd(),
    '',
    jsonSection('components', 'Component Contracts', context.components).trimEnd(),
  );
  for (const screen of screens) {
    parts.push('', jsonSection(`screen:${screen.id}`, `Screen: ${compactHeading(screen.name)} (${screen.id})`, screen).trimEnd());
  }
  parts.push('');
  return parts.join('\n');
}

function parseJsonBlock(key, source) {
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new DesignMarkdownError(`Invalid JSON in design.md section ${key}: ${error.message}`, 'DESIGN_MARKDOWN_INVALID_JSON');
  }
}

export function parseDesignMarkdown(markdown) {
  if (typeof markdown !== 'string' || markdown.trim().length === 0) {
    throw new DesignMarkdownError('design.md content is required.', 'DESIGN_MARKDOWN_REQUIRED');
  }
  if (Buffer.byteLength(markdown, 'utf8') > MAX_MARKDOWN_BYTES) {
    throw new DesignMarkdownError('design.md exceeds the 16 MiB transport limit.', 'DESIGN_MARKDOWN_TOO_LARGE');
  }
  const formatMatch = markdown.match(/<!-- design-harness-format:(\d+) -->/);
  const parsedFormatVersion = formatMatch ? Number(formatMatch[1]) : null;
  if (!SUPPORTED_FORMAT_VERSIONS.has(parsedFormatVersion)) {
    throw new DesignMarkdownError('design.md must contain a supported design-harness-format marker.', 'DESIGN_MARKDOWN_FORMAT_UNSUPPORTED');
  }

  const sections = new Map();
  const pattern = /```json design-harness:([^\s`]+)\n([\s\S]*?)\n```/g;
  for (const match of markdown.matchAll(pattern)) {
    const key = match[1];
    if (sections.has(key)) throw new DesignMarkdownError(`Duplicate design.md section: ${key}.`, 'DESIGN_MARKDOWN_DUPLICATE_SECTION');
    sections.set(key, parseJsonBlock(key, match[2]));
  }

  for (const required of ['project', 'tokens', 'components']) {
    if (!sections.has(required)) throw new DesignMarkdownError(`Missing design.md section: ${required}.`, 'DESIGN_MARKDOWN_SECTION_MISSING');
  }

  const screens = [];
  for (const [key, document] of sections) {
    if (key === 'project' || key === 'product' || key === 'design-units' || key === 'tokens' || key === 'components') continue;
    if (!key.startsWith('screen:') || key.length === 'screen:'.length) {
      throw new DesignMarkdownError(`Unknown design.md section: ${key}.`, 'DESIGN_MARKDOWN_UNKNOWN_SECTION');
    }
    const screenId = key.slice('screen:'.length);
    if (!document || typeof document !== 'object' || document.id !== screenId) {
      throw new DesignMarkdownError(`Screen section ${key} must contain a document with id ${screenId}.`, 'DESIGN_MARKDOWN_SCREEN_ID_MISMATCH');
    }
    screens.push(document);
  }
  screens.sort((left, right) => String(left.id).localeCompare(String(right.id)));

  return {
    schemaVersion: parsedFormatVersion,
    project: sections.get('project'),
    product: sections.get('product') ?? null,
    designUnits: sections.get('design-units') ?? null,
    tokens: sections.get('tokens'),
    components: sections.get('components'),
    screens,
  };
}

export const designMarkdownFormatVersion = FORMAT_VERSION;
