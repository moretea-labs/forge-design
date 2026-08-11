import { createComponentRegistry } from './registry';
import type { ComponentContractsDocument, DesignIssue, ScreenSpec } from './schema';

export function lintScreen(spec: ScreenSpec, components: ComponentContractsDocument): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const registry = createComponentRegistry(components);
  const primaryActions = spec.nodes.filter((node) => node.component === 'PrimaryAction');

  if (primaryActions.length !== 1) {
    issues.push({
      severity: 'error',
      rule: 'single-primary-action',
      message: `Screen must contain exactly one PrimaryAction; found ${primaryActions.length}.`,
    });
  }

  if (!spec.goal.trim() || !spec.primaryAction.trim()) {
    issues.push({ severity: 'error', rule: 'explicit-screen-goal', message: 'Screen goal and primary action are required.' });
  }

  if (spec.nodes.length > 6) {
    issues.push({ severity: 'warning', rule: 'focus-budget', message: 'More than six top-level nodes may dilute the screen hierarchy.' });
  }

  const nodeIds = new Set<string>();
  for (const node of spec.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({ severity: 'error', rule: 'unique-node-id', message: `Duplicate node id: ${node.id}.`, nodeId: node.id });
    }
    nodeIds.add(node.id);
    const contract = registry[node.component];
    if (!contract) {
      issues.push({ severity: 'error', rule: 'registered-components-only', message: `${node.component} is not registered.`, nodeId: node.id });
      continue;
    }

    const invalidProps = Object.keys(node.props ?? {}).filter((key) => !contract.allowedProps.includes(key));
    if (invalidProps.length) {
      issues.push({
        severity: 'error',
        rule: 'component-contract',
        message: `${node.component} uses unsupported props: ${invalidProps.join(', ')}.`,
        nodeId: node.id,
      });
    }
  }

  const trajectoryIndex = spec.nodes.findIndex((node) => node.component === 'BeatTrajectory');
  const bpmIndex = spec.nodes.findIndex((node) => node.component === 'BPMController');
  if (trajectoryIndex >= 0 && bpmIndex >= 0 && trajectoryIndex < bpmIndex) {
    issues.push({ severity: 'warning', rule: 'primary-control-first', message: 'BPMController should precede BeatTrajectory on the metronome home screen.' });
  }

  return issues;
}
