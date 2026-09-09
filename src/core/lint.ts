import { componentPropNames, componentStateIds, componentVariantIds, createComponentRegistry } from './registry';
import type { ComponentContract, ComponentContractsDocument, DesignIssue, ScreenSpec } from './schema';

function propTypeValid(contract: ComponentContract, key: string, value: unknown): boolean {
  const definition = contract.props?.find((prop) => prop.name === key);
  if (!definition) return true;
  if (definition.type === 'string') return typeof value === 'string';
  if (definition.type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (definition.type === 'boolean') return typeof value === 'boolean';
  if (definition.type === 'enum') return typeof value === 'string' && Boolean(definition.enumValues?.includes(value));
  return false;
}

export function lintScreen(spec: ScreenSpec, components: ComponentContractsDocument): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const registry = createComponentRegistry(components);
  const primaryActions = spec.nodes.filter((node) => {
    const contract = registry[node.component];
    return contract?.interactionRole === 'primary_action' || (!contract?.interactionRole && node.component === 'PrimaryAction');
  });

  if (primaryActions.length !== 1) {
    issues.push({ severity: 'error', rule: 'single-primary-action', message: `Screen must contain exactly one primary-action component; found ${primaryActions.length}.` });
  }
  if (!spec.goal.trim() || !spec.primaryAction.trim()) {
    issues.push({ severity: 'error', rule: 'explicit-screen-goal', message: 'Screen goal and primary action are required.' });
  }
  if (spec.nodes.length > 6) {
    issues.push({ severity: 'warning', rule: 'focus-budget', message: 'More than six top-level nodes may dilute the screen hierarchy.' });
  }

  const nodeIds = new Set<string>();
  for (const node of spec.nodes) {
    if (nodeIds.has(node.id)) issues.push({ severity: 'error', rule: 'unique-node-id', message: `Duplicate node id: ${node.id}.`, nodeId: node.id });
    nodeIds.add(node.id);
    const contract = registry[node.component];
    if (!contract) {
      issues.push({ severity: 'error', rule: 'registered-components-only', message: `${node.component} is not registered.`, nodeId: node.id });
      continue;
    }
    const propNames = componentPropNames(contract);
    const invalidProps = Object.keys(node.props ?? {}).filter((key) => !propNames.includes(key));
    if (invalidProps.length) {
      issues.push({ severity: 'error', rule: 'component-contract', message: `${node.component} uses unsupported props: ${invalidProps.join(', ')}.`, nodeId: node.id });
    }
    for (const definition of contract.props ?? []) {
      const value = node.props?.[definition.name];
      if (definition.required && value === undefined) {
        issues.push({ severity: 'error', rule: 'required-component-prop', message: `${node.component} requires prop ${definition.name}.`, nodeId: node.id });
      } else if (value !== undefined && !propTypeValid(contract, definition.name, value)) {
        issues.push({ severity: 'error', rule: 'typed-component-prop', message: `${node.component}.${definition.name} does not match type ${definition.type}.`, nodeId: node.id });
      }
    }
    if (node.variant && !componentVariantIds(contract).includes(node.variant)) {
      issues.push({ severity: 'error', rule: 'component-variant', message: `${node.component} uses unknown variant ${node.variant}.`, nodeId: node.id });
    }
    if (node.state && !componentStateIds(contract).includes(node.state)) {
      issues.push({ severity: 'error', rule: 'component-state', message: `${node.component} uses unknown state ${node.state}.`, nodeId: node.id });
    }
  }
  return issues;
}
