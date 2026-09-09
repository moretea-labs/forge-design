import type { CSSProperties, ReactElement } from 'react';
import { Check, ChevronRight, CircleAlert, Info, Play, Plus, Settings2, Square } from 'lucide-react';
import type { ComponentContract, ScreenNode } from '../core/schema';

type PreviewNode = NonNullable<ComponentContract['preview']>['nodes'][number];

type Props = { contract: ComponentContract; node: ScreenNode };

const toKebab = (value: string) => value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
const token = (group: string, name?: string) => name ? `var(--${group}-${toKebab(name)})` : undefined;

function boundContent(item: PreviewNode, props: Record<string, unknown> | undefined): string {
  if (!item.content) return '';
  if (item.content.kind === 'literal') return item.content.value;
  const value = props?.[item.content.value];
  if (value === undefined || value === null || value === '') return item.content.fallback ?? '';
  return String(value);
}

function previewStyle(item: PreviewNode): CSSProperties {
  const style = item.style;
  if (!style) return {};
  const typography = style.typography;
  return {
    display: item.primitive === 'stack' || item.primitive === 'surface' ? 'flex' : undefined,
    flexDirection: style.axis === 'horizontal' ? 'row' : style.axis === 'vertical' ? 'column' : undefined,
    gap: token('space', style.gap),
    padding: token('space', style.padding),
    color: token('color', style.color),
    background: token('color', style.background),
    borderRadius: token('radius', style.radius),
    alignItems: style.alignment === 'leading' ? 'flex-start' : style.alignment === 'trailing' ? 'flex-end' : style.alignment === 'stretch' ? 'stretch' : style.alignment === 'center' ? 'center' : undefined,
    justifyContent: style.justify === 'between' ? 'space-between' : style.justify === 'start' ? 'flex-start' : style.justify === 'end' ? 'flex-end' : style.justify === 'center' ? 'center' : undefined,
    width: style.width === 'fill' ? '100%' : style.width === 'hug' ? 'fit-content' : undefined,
    fontSize: typography ? token('type', `${typography}-size`) : undefined,
    lineHeight: typography ? token('type', `${typography}-line`) : undefined,
    fontWeight: typography ? token('type', `${typography}-weight`) : undefined,
  };
}

const iconMap = {
  plus: Plus,
  chevron: ChevronRight,
  settings: Settings2,
  play: Play,
  stop: Square,
  check: Check,
  warning: CircleAlert,
  info: Info,
} as const;

function renderIcon(name?: string): ReactElement {
  const Icon = name && name in iconMap ? iconMap[name as keyof typeof iconMap] : Info;
  return <Icon size={18} aria-hidden="true" />;
}

export function ComponentPreview({ contract, node }: Props): ReactElement {
  if (!contract.preview?.nodes.length) {
    return <section className="component-preview-legacy"><strong>{contract.name}</strong><p>{contract.purpose}</p><small>Legacy contract · declarative preview not defined</small></section>;
  }
  const variant = node.variant ?? contract.variants?.[0]?.id;
  const state = node.state ?? contract.states?.[0]?.id;
  const visible = contract.preview.nodes.filter((item) => {
    if (item.when?.variants?.length && (!variant || !item.when.variants.includes(variant))) return false;
    if (item.when?.states?.length && (!state || !item.when.states.includes(state))) return false;
    return true;
  });
  const byParent = new Map<string | undefined, PreviewNode[]>();
  for (const item of visible) {
    const children = byParent.get(item.parentId) ?? [];
    children.push(item);
    byParent.set(item.parentId, children);
  }

  const render = (item: PreviewNode): ReactElement => {
    const children = (byParent.get(item.id) ?? []).map((child) => render(child));
    const content = boundContent(item, node.props);
    const style = previewStyle(item);
    if (item.primitive === 'stack') return <div key={item.id} className="preview-stack" style={style}>{children}</div>;
    if (item.primitive === 'surface') return <section key={item.id} className="preview-surface" style={style}>{children}</section>;
    if (item.primitive === 'text') return <span key={item.id} className="preview-text" style={style}>{content}</span>;
    if (item.primitive === 'value') return <strong key={item.id} className="preview-value" style={style}>{content}</strong>;
    if (item.primitive === 'badge') return <span key={item.id} className="preview-badge" style={style}>{content}</span>;
    if (item.primitive === 'button') return <button key={item.id} type="button" className="preview-button" style={style}>{item.iconName && renderIcon(item.iconName)}{content}</button>;
    if (item.primitive === 'icon') return <span key={item.id} className="preview-icon" style={style}>{renderIcon(item.iconName)}</span>;
    if (item.primitive === 'divider') return <span key={item.id} className="preview-divider" style={style} />;
    if (item.primitive === 'spacer') return <span key={item.id} className="preview-spacer" style={style} />;
    const raw = Number(node.props?.[item.content?.value ?? '']);
    const percent = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 50;
    return <span key={item.id} className="preview-progress" style={style}><span style={{ width: `${percent}%` }} /></span>;
  };

  return <>{(byParent.get(undefined) ?? []).map((item) => render(item))}</>;
}
