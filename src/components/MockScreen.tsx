import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { compileScreenToDesignIR } from '../core/design-ir';
import { createStudioRuntimeState, type StudioRuntimeState } from '../core/studio-runtime';
import type { ComponentContractsDocument, DesignReviewProfile, ScreenSpec } from '../core/schema';
import { DesignIRRenderer } from './DesignIRRenderer';

export function MockScreen({ spec, components, profile = null, onNavigateScreen, fullPage = false }: { spec: ScreenSpec; components: ComponentContractsDocument; profile?: DesignReviewProfile | null; onNavigateScreen?: (screenId: string, stateId?: string) => void; fullPage?: boolean }): ReactElement {
  const initialIr = useMemo(() => compileScreenToDesignIR(spec, components, profile), [components, profile, spec]);
  const [runtime, setRuntime] = useState<StudioRuntimeState>(() => createStudioRuntimeState(initialIr));
  const ir = useMemo(() => compileScreenToDesignIR(spec, components, profile, runtime.screenStateId), [components, profile, runtime.screenStateId, spec]);
  useEffect(() => setRuntime(createStudioRuntimeState(initialIr)), [initialIr]);
  return (
    <main className={fullPage ? 'mock-screen mock-screen-full-page' : 'mock-screen'} data-design-platform={ir.viewport.platform} data-design-viewport-kind={ir.viewport.kind}>
      <DesignIRRenderer ir={ir} runtime={runtime} onRuntimeChange={setRuntime} onNavigateScreen={onNavigateScreen} />
    </main>
  );
}
