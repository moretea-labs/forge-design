import type { DesignTokens } from '../core/schema';

const toKebab = (value: string) => value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

export function installTokenVariables(tokens: DesignTokens, root: HTMLElement = document.documentElement): void {
  Object.entries(tokens.color).forEach(([name, value]) => root.style.setProperty(`--color-${toKebab(name)}`, value));
  Object.entries(tokens.spacing).forEach(([name, value]) => root.style.setProperty(`--space-${toKebab(name)}`, `${value}px`));
  Object.entries(tokens.radius).forEach(([name, value]) => root.style.setProperty(`--radius-${toKebab(name)}`, `${value}px`));
  Object.entries(tokens.shadow).forEach(([name, value]) => root.style.setProperty(`--shadow-${toKebab(name)}`, value));
  Object.entries(tokens.typography).forEach(([name, style]) => {
    root.style.setProperty(`--type-${toKebab(name)}-size`, `${style.size}px`);
    root.style.setProperty(`--type-${toKebab(name)}-line`, `${style.lineHeight}px`);
    root.style.setProperty(`--type-${toKebab(name)}-weight`, String(style.weight));
  });
}
