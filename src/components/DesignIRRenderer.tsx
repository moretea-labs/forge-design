import type { CSSProperties, ReactElement } from 'react';
import { Check, ChevronRight, CircleAlert, Info, Play, Plus, Settings2, Square } from 'lucide-react';
import type { DesignIR, DesignIRNode } from '../core/design-ir';
import { executeDesignInteractions, type StudioRuntimeEvent, type StudioRuntimeState } from '../core/studio-runtime';

const toKebab = (value: string) => value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
const token = (group: string, name?: string) => name ? `var(--${group}-${toKebab(name)})` : undefined;

const iconMap = { plus: Plus, chevron: ChevronRight, settings: Settings2, play: Play, stop: Square, check: Check, warning: CircleAlert, info: Info } as const;

function nodeStyle(node: DesignIRNode): CSSProperties {
  const style = node.style;
  const typography = style.typography;
  return {
    display: ['stack', 'surface', 'scroll', 'layer', 'grid', 'list', 'table', 'outline', 'collection'].includes(node.primitive) ? 'flex' : undefined,
    flexDirection: style.axis === 'horizontal' ? 'row' : style.axis === 'vertical' ? 'column' : undefined,
    gap: token('space', style.gap),
    padding: token('space', style.padding),
    color: token('color', style.color),
    background: style.material ? token('material', `${style.material}-tint`) : token('color', style.background),
    backdropFilter: style.material ? `blur(${token('material', `${style.material}-blur`)})` : undefined,
    borderRadius: token('radius', style.radius),
    boxShadow: token('shadow', style.shadow),
    alignItems: style.alignment === 'leading' ? 'flex-start' : style.alignment === 'trailing' ? 'flex-end' : style.alignment === 'stretch' ? 'stretch' : style.alignment === 'center' ? 'center' : undefined,
    justifyContent: style.justify === 'between' ? 'space-between' : style.justify === 'start' ? 'flex-start' : style.justify === 'end' ? 'flex-end' : style.justify === 'center' ? 'center' : undefined,
    width: style.width === 'fill' ? '100%' : style.width === 'hug' ? 'fit-content' : undefined,
    height: style.height === 'fill' ? '100%' : style.height === 'hug' ? 'fit-content' : undefined,
    overflow: style.overflow,
    fontSize: typography ? token('type', `${typography}-size`) : undefined,
    lineHeight: typography ? token('type', `${typography}-line`) : undefined,
    fontWeight: typography ? token('type', `${typography}-weight`) : undefined,
    gridTemplateColumns: node.primitive === 'grid' && style.columns ? `repeat(${style.columns}, minmax(0, 1fr))` : undefined,
  };
}

function renderIcon(name?: string): ReactElement {
  const Icon = name && name in iconMap ? iconMap[name as keyof typeof iconMap] : Info;
  return <Icon size={18} aria-hidden="true" />;
}

function firstBoundPath(node: DesignIRNode): string | undefined {
  for (const interaction of node.interactions) for (const action of interaction.actions) if (action.path) return action.path;
  return undefined;
}

type Props = {
  ir: DesignIR;
  runtime: StudioRuntimeState;
  onRuntimeChange: (next: StudioRuntimeState) => void;
  onNavigateScreen?: (screenId: string, stateId?: string) => void;
  onDesignAction?: (actionId: string) => void;
};

export function DesignIRRenderer({ ir, runtime, onRuntimeChange, onNavigateScreen, onDesignAction }: Props): ReactElement {
  const dispatch = (node: DesignIRNode, event: StudioRuntimeEvent, value?: string | boolean) => {
    const next = executeDesignInteractions(runtime, node.interactions, event, value);
    onRuntimeChange(next);
    if (next.screenId !== runtime.screenId) onNavigateScreen?.(next.screenId, next.screenStateId);
    const emitted = next.emittedActions.slice(runtime.emittedActions.length);
    emitted.forEach((actionId) => onDesignAction?.(actionId));
    if (next.scrollTargetId && next.scrollTargetId !== runtime.scrollTargetId) document.querySelector(`[data-design-ir-id="${CSS.escape(next.scrollTargetId)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const render = (node: DesignIRNode): ReactElement => {
    const children = node.children.map(render);
    const style = nodeStyle(node);
    const common = { key: node.id, 'data-design-ir-id': node.id, 'data-design-primitive': node.primitive, style };
    if (node.primitive === 'legacy') return <section {...common} className="component-preview-legacy"><strong>{node.component}</strong><p>{node.content}</p><small>{node.diagnostics.join(' · ') || 'Legacy component preview'}</small></section>;
    if (['stack', 'layer', 'list', 'outline', 'collection'].includes(node.primitive)) return <div {...common} className={`preview-${node.primitive}`}>{children}</div>;
    if (node.primitive === 'grid') return <div {...common} className="preview-grid" style={{ ...style, display: 'grid' }}>{children}</div>;
    if (node.primitive === 'scroll') return <div {...common} className="preview-scroll" style={{ ...style, overflow: style.overflow ?? 'auto' }}>{children}</div>;
    if (node.primitive === 'surface') return <section {...common} className="preview-surface">{children}</section>;
    if (node.primitive === 'table') return <div {...common} role="table" className="preview-table">{children}</div>;
    if (node.primitive === 'text') return <span {...common} className="preview-text">{node.content}</span>;
    if (node.primitive === 'value') return <strong {...common} className="preview-value">{node.content}</strong>;
    if (node.primitive === 'badge') return <span {...common} className="preview-badge">{node.content}</span>;
    if (node.primitive === 'button') return <button {...common} type="button" className="preview-button" onClick={() => dispatch(node, 'press')}>{node.iconName && renderIcon(node.iconName)}{node.content}{children}</button>;
    if (node.primitive === 'input') {
      const path = firstBoundPath(node); const value = path ? String(runtime.values[path] ?? node.content ?? '') : (node.content ?? '');
      return <input {...common} className="preview-input" value={value} aria-label={node.content || node.component} onChange={(event) => dispatch(node, 'change', event.target.value)} />;
    }
    if (node.primitive === 'toggle') {
      const path = firstBoundPath(node); const checked = path ? Boolean(runtime.values[path]) : false;
      return <label {...common} className="preview-toggle"><input type="checkbox" checked={checked} onChange={(event) => dispatch(node, 'toggle', event.target.checked)} /><span>{node.content}</span></label>;
    }
    if (node.primitive === 'segmented') return <button {...common} type="button" className="preview-segmented" onClick={() => dispatch(node, 'select', node.content)}>{node.content}{children}</button>;
    if (node.primitive === 'menu' || node.primitive === 'selection') return <button {...common} type="button" className="preview-selection" onClick={() => dispatch(node, 'select', node.content)}>{node.content || node.component}<ChevronRight size={16} />{children}</button>;
    if (node.primitive === 'icon') return <span {...common} className="preview-icon">{renderIcon(node.iconName)}</span>;
    if (node.primitive === 'divider') return <span {...common} className="preview-divider" />;
    if (node.primitive === 'spacer') return <span {...common} className="preview-spacer" />;
    if (node.primitive === 'image') return node.content ? <img {...common} className="preview-image" src={node.content} alt="" /> : <span {...common} className="preview-image-placeholder" />;
    if (node.primitive === 'shape' || node.primitive === 'path') return <span {...common} className={`preview-${node.primitive}`} />;
    const raw = Number(node.content); const percent = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 50;
    return <span {...common} className="preview-progress"><span style={{ width: `${percent}%` }} /></span>;
  };

  return <>{ir.nodes.map(render)}</>;
}
