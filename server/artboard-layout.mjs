const attributePattern = /([\w:-]+)\s*=\s*["']([^"']*)["']/g;
const regionTagPattern = /<[^>]+\bdata-fd-region\s*=\s*["'][^"']+["'][^>]*>/gi;
const epsilon = 0.5;

function attributesForTag(tag) {
  const attributes = {};
  let match;
  attributePattern.lastIndex = 0;
  while ((match = attributePattern.exec(tag))) attributes[match[1]] = match[2];
  return attributes;
}

function parseBox(value) {
  const numbers = String(value ?? '').trim().split(/[\s,]+/).map(Number);
  if (numbers.length !== 4 || numbers.some((item) => !Number.isFinite(item))) return null;
  const [x, y, width, height] = numbers;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function contains(outer, inner) {
  return inner.x >= outer.x - epsilon
    && inner.y >= outer.y - epsilon
    && inner.x + inner.width <= outer.x + outer.width + epsilon
    && inner.y + inner.height <= outer.y + outer.height + epsilon;
}

function overlap(a, b) {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > epsilon && height > epsilon;
}

export function parseDeclaredArtboardRegions(svg) {
  const regions = [];
  let match;
  regionTagPattern.lastIndex = 0;
  while ((match = regionTagPattern.exec(String(svg ?? '')))) {
    const attributes = attributesForTag(match[0]);
    regions.push({
      id: attributes['data-fd-region'],
      box: parseBox(attributes['data-fd-box']),
      containerId: attributes['data-fd-container'] || null,
      overlapGroup: attributes['data-fd-overlap-group'] || null,
      overlapPolicy: attributes['data-fd-overlap'] || 'forbid',
      safeArea: attributes['data-fd-safe-area'] || null,
    });
  }
  return regions;
}

export function analyzeDeclaredArtboardLayout(svg, viewport = {}) {
  const width = Number(viewport.width);
  const height = Number(viewport.height);
  const safeTop = Number(viewport.safeTop ?? 0);
  const safeBottom = Number(viewport.safeBottom ?? 0);
  const regions = parseDeclaredArtboardRegions(svg);
  if (regions.length === 0) return { status: 'unannotated', issues: [], regions: [] };

  const issues = [];
  const byId = new Map();
  for (const region of regions) {
    if (!region.id || byId.has(region.id)) {
      issues.push({ code: 'duplicate_region', regions: [region.id || '(missing)'], message: 'Duplicate or missing layout region id: ' + (region.id || '(missing)') + '.' });
      continue;
    }
    byId.set(region.id, region);
    if (!region.box) {
      issues.push({ code: 'invalid_bounds', regions: [region.id], message: 'Layout region ' + region.id + ' requires data-fd-box="x y width height" with positive dimensions.' });
      continue;
    }
    if (Number.isFinite(width) && Number.isFinite(height) && !contains({ x: 0, y: 0, width, height }, region.box)) {
      issues.push({ code: 'artboard_out_of_bounds', regions: [region.id], message: 'Layout region ' + region.id + ' extends outside the artboard bounds.' });
    }
    if (region.safeArea === 'content' && Number.isFinite(width) && Number.isFinite(height)) {
      const safeBox = { x: 0, y: safeTop, width, height: Math.max(0, height - safeTop - safeBottom) };
      if (!contains(safeBox, region.box)) issues.push({ code: 'safe_area_violation', regions: [region.id], message: 'Layout region ' + region.id + ' violates the content safe area.' });
    }
  }

  for (const region of regions) {
    if (!region.box || !region.containerId) continue;
    const container = byId.get(region.containerId);
    if (!container?.box) issues.push({ code: 'container_missing', regions: [region.id, region.containerId], message: 'Layout region ' + region.id + ' references missing container ' + region.containerId + '.' });
    else if (!contains(container.box, region.box)) issues.push({ code: 'container_overflow', regions: [region.id, region.containerId], message: 'Layout region ' + region.id + ' extends outside container ' + region.containerId + '.' });
  }

  const grouped = new Map();
  for (const region of regions) {
    if (!region.box || !region.overlapGroup || region.overlapPolicy === 'allow') continue;
    const list = grouped.get(region.overlapGroup) ?? [];
    list.push(region);
    grouped.set(region.overlapGroup, list);
  }
  for (const [group, list] of grouped) {
    for (let left = 0; left < list.length; left += 1) {
      for (let right = left + 1; right < list.length; right += 1) {
        if (overlap(list[left].box, list[right].box)) issues.push({
          code: 'sibling_overlap',
          regions: [list[left].id, list[right].id],
          message: 'Layout regions ' + list[left].id + ' and ' + list[right].id + ' overlap in group ' + group + '.',
        });
      }
    }
  }

  return { status: issues.length > 0 ? 'fail' : 'pass', issues, regions };
}
