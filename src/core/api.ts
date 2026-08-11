import { lintScreen } from './lint';
import { getComponentContract as readComponentContract, listComponentContracts } from './registry';
import type { DesignProjectContext, ScreenSpec } from './schema';

export const designHarnessCapabilities = [
  'list_projects',
  'get_project',
  'get_design_context',
  'validate_project',
  'get_design_tokens',
  'put_design_tokens',
  'list_components',
  'get_component_contract',
  'put_components',
  'list_screens',
  'get_screen_spec',
  'create_screen',
  'put_screen_spec',
  'lint_screen',
] as const;

export type DesignHarnessCapability = (typeof designHarnessCapabilities)[number];

export function getDesignTokens(context: DesignProjectContext) {
  return structuredClone(context.tokens);
}

export function listComponents(context: DesignProjectContext) {
  return listComponentContracts(context.components);
}

export function getComponentContract(context: DesignProjectContext, name: string) {
  return readComponentContract(context.components, name);
}

export function listScreens(context: DesignProjectContext) {
  return context.screens.map(({ id, name, device, goal, primaryAction }) => ({ id, name, device, goal, primaryAction }));
}

export function getScreenSpec(context: DesignProjectContext, id: string) {
  const screen = context.screens.find((candidate) => candidate.id === id);
  return screen ? structuredClone(screen) : null;
}

export function lintScreenSpec(context: DesignProjectContext, spec: ScreenSpec) {
  return lintScreen(structuredClone(spec), context.components);
}
