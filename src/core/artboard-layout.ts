export type LayoutBox = { x: number; y: number; width: number; height: number };
export type LayoutRegion = {
  id: string;
  box: LayoutBox | null;
  containerId: string | null;
  overlapGroup: string | null;
  overlapPolicy: string;
  safeArea: string | null;
};
export type LayoutIssue = { code: string; regions: string[]; message: string };
export type LayoutReport = { status: 'pass' | 'fail' | 'unannotated'; issues: LayoutIssue[]; regions: LayoutRegion[] };

const epsilon = 0.5;

function parseBox(value: string | null): LayoutBox | null {
  const numbers = String(value ?? '').trim().split(/[\s,]+/).map(Number);
  if (numbers.length !== 4 || numbers.some((item) => !Number.isFinite(item))) return null;
  const [x, y, width, height] = numbers;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

function contains(outer: LayoutBox, inner: LayoutBox, tolerance = epsilon): boolean {
  return inner.x >= outer.x - tolerance
    && inner.y >= outer.y - tolerance
    && inner.x + inner.width <= outer.x + outer.width + tolerance
    && inner.y + inner.height <= outer.y + outer.height + tolerance;
}

function overlap(a: LayoutBox, b: LayoutBox): boolean {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > epsilon && height > epsilon;
}

export function parseDeclaredLayoutRegions(svg: string): LayoutRegion[] {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return [...parsed.querySelectorAll('[data-fd-region]')].map((element) => ({
    id: element.getAttribute('data-fd-region') ?? '',
    box: parseBox(element.getAttribute('data-fd-box')),
    containerId: element.getAttribute('data-fd-container'),
    overlapGroup: element.getAttribute('data-fd-overlap-group'),
    overlapPolicy: element.getAttribute('data-fd-overlap') ?? 'forbid',
    safeArea: element.getAttribute('data-fd-safe-area'),
  }));
}

export function analyzeDeclaredLayout(
  regions: LayoutRegion[],
  viewport: { width: number; height: number; safeTop?: number; safeBottom?: number },
  artboardDimensions: { width: number; height: number } = viewport,
): LayoutReport {
  if (regions.length === 0) return { status: 'unannotated', issues: [], regions };
  const issues: LayoutIssue[] = [];
  const byId = new Map<string, LayoutRegion>();
  const artboard = { x: 0, y: 0, width: artboardDimensions.width, height: artboardDimensions.height };
  const safeBox = { x: 0, y: viewport.safeTop ?? 0, width: viewport.width, height: Math.max(0, viewport.height - (viewport.safeTop ?? 0) - (viewport.safeBottom ?? 0)) };

  for (const region of regions) {
    if (!region.id || byId.has(region.id)) {
      issues.push({ code: 'duplicate_region', regions: [region.id || '(missing)'], message: 'Duplicate or missing layout region id: ' + (region.id || '(missing)') + '.' });
      continue;
    }
    byId.set(region.id, region);
    if (!region.box) {
      issues.push({ code: 'invalid_bounds', regions: [region.id], message: region.id + ' has invalid declared bounds.' });
      continue;
    }
    if (!contains(artboard, region.box)) issues.push({ code: 'artboard_out_of_bounds', regions: [region.id], message: region.id + ' extends outside the artboard.' });
    if (region.safeArea === 'content' && !contains(safeBox, region.box)) issues.push({ code: 'safe_area_violation', regions: [region.id], message: region.id + ' violates the content safe area.' });
  }

  for (const region of regions) {
    if (!region.box || !region.containerId) continue;
    const container = byId.get(region.containerId);
    if (!container?.box) issues.push({ code: 'container_missing', regions: [region.id, region.containerId], message: region.id + ' references missing container ' + region.containerId + '.' });
    else if (!contains(container.box, region.box)) issues.push({ code: 'container_overflow', regions: [region.id, region.containerId], message: region.id + ' extends outside ' + region.containerId + '.' });
  }

  const groups = new Map<string, LayoutRegion[]>();
  for (const region of regions) {
    if (!region.box || !region.overlapGroup || region.overlapPolicy === 'allow') continue;
    groups.set(region.overlapGroup, [...(groups.get(region.overlapGroup) ?? []), region]);
  }
  for (const [group, list] of groups) {
    for (let left = 0; left < list.length; left += 1) {
      for (let right = left + 1; right < list.length; right += 1) {
        if (overlap(list[left].box!, list[right].box!)) issues.push({
          code: 'sibling_overlap',
          regions: [list[left].id, list[right].id],
          message: list[left].id + ' overlaps ' + list[right].id + ' in ' + group + '.',
        });
      }
    }
  }
  return { status: issues.length > 0 ? 'fail' : 'pass', issues, regions };
}

export function renderedOverflowIssues(regions: LayoutRegion[], actual: Map<string, LayoutBox>, tolerance = 1.5): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  for (const region of regions) {
    if (!region.box) continue;
    const rendered = actual.get(region.id);
    if (!rendered) continue;
    if (!contains(region.box, rendered, tolerance)) issues.push({
      code: 'rendered_content_overflow',
      regions: [region.id],
      message: 'Rendered content escapes the declared bounds for ' + region.id + '.',
    });
  }
  return issues;
}
