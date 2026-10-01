import type { DesignIR, DesignIRNode } from './design-ir';
import type { DesignIssue, DesignTokens, ScreenSpec } from './schema';

function walk(nodes: DesignIRNode[], visit: (node: DesignIRNode) => void): void {
  for (const node of nodes) { visit(node); walk(node.children, visit); }
}

function tokenExists(tokens: DesignTokens, group: string, value?: string): boolean {
  if (!value) return true;
  if (group === 'spacing') return Object.prototype.hasOwnProperty.call(tokens.spacing, value);
  if (group === 'radius') return Object.prototype.hasOwnProperty.call(tokens.radius, value);
  if (group === 'shadow') return Object.prototype.hasOwnProperty.call(tokens.shadow, value);
  if (group === 'typography') return Object.prototype.hasOwnProperty.call(tokens.typography, value);
  if (group === 'material') return Boolean(tokens.material && Object.prototype.hasOwnProperty.call(tokens.material, value));
  return Object.prototype.hasOwnProperty.call(tokens.color, value);
}

export function inspectDesignIR(ir: DesignIR, spec: ScreenSpec, tokens?: DesignTokens): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const viewport = ir.viewport;
  if (viewport.safeTop + viewport.safeBottom >= viewport.height) issues.push({ severity: 'error', rule: 'viewport-safe-area', message: 'Safe areas consume the full review viewport.' });
  if (viewport.kind === 'desktop' && viewport.width < 800) issues.push({ severity: 'warning', rule: 'desktop-review-width', message: `Desktop review viewport is only ${viewport.width}px wide.` });
  for (const required of spec.quality?.requiredStateIds ?? []) {
    if (!(spec.states ?? []).some((state) => state.id === required)) issues.push({ severity: 'error', rule: 'required-screen-state', message: `Required screen state ${required} is missing.` });
  }
  const ids = new Set<string>();
  walk(ir.nodes, (node) => {
    if (ids.has(node.id)) issues.push({ severity: 'error', rule: 'unique-ir-node-id', message: `Duplicate Design IR node id ${node.id}.`, nodeId: node.sourceNodeId });
    ids.add(node.id);
    if (node.diagnostics.length) issues.push(...node.diagnostics.map((diagnostic) => ({ severity: 'error' as const, rule: 'design-ir-compile', message: `${node.component}: ${diagnostic}.`, nodeId: node.sourceNodeId })));
    const interactive = ['button', 'input', 'toggle', 'segmented', 'menu', 'selection'].includes(node.primitive);
    if (interactive && node.interactionRole && node.interactionRole !== 'display' && node.interactions.length === 0) issues.push({ severity: 'warning', rule: 'interactive-preview-action', message: `${node.component} is interactive but has no declarative preview interaction.`, nodeId: node.sourceNodeId });
    if (tokens && spec.quality?.requireTokenReferences) {
      const refs: Array<[string, string | undefined]> = [['spacing', node.style.gap], ['spacing', node.style.padding], ['typography', node.style.typography], ['color', node.style.color], ['color', node.style.background], ['radius', node.style.radius], ['shadow', node.style.shadow], ['material', node.style.material]];
      for (const [group, value] of refs) if (value && !tokenExists(tokens, group, value)) issues.push({ severity: 'error', rule: 'design-token-reference', message: `${node.component} references unknown ${group} token ${value}.`, nodeId: node.sourceNodeId });
    }
  });
  return issues;
}
