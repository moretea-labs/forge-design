import type { ReactElement } from 'react';
import { ComponentPreview } from './ComponentPreview';
import { createComponentRegistry } from '../core/registry';
import type { ComponentContractsDocument, ScreenSpec } from '../core/schema';

export function MockScreen({ spec, components, fullPage = false }: { spec: ScreenSpec; components: ComponentContractsDocument; onNavigateScreen?: (screenId: string) => void; fullPage?: boolean }): ReactElement {
  const registry = createComponentRegistry(components);
  return (
    <main className={fullPage ? 'mock-screen mock-screen-full-page' : 'mock-screen'}>
      {spec.nodes.map((node) => {
        const contract = registry[node.component];
        if (!contract) return <section className="component-preview-legacy" key={node.id}><strong>{node.component}</strong><p>Unregistered component</p></section>;
        return <ComponentPreview key={node.id} contract={contract} node={node} />;
      })}
    </main>
  );
}
