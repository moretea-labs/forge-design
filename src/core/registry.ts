import type { ComponentContract, ComponentContractsDocument } from './schema';

export type ComponentRegistry = Record<string, ComponentContract>;

export function createComponentRegistry(document: ComponentContractsDocument): ComponentRegistry {
  return Object.fromEntries(document.components.map((component) => [component.name, component]));
}

export function listComponentContracts(document: ComponentContractsDocument): ComponentContract[] {
  return structuredClone(document.components);
}

export function getComponentContract(document: ComponentContractsDocument, name: string): ComponentContract | null {
  const contract = document.components.find((component) => component.name === name);
  return contract ? structuredClone(contract) : null;
}
