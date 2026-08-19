// ForgeOS feature-discovery layer.
// Each enhancement lives in its own `features/feat-*.tsx` file that default-exports a
// `FeatureModule`. This registry discovers them at build time via Vite glob, so feature
// branches never edit App.tsx / server.ts -- eliminating merge conflicts during parallel waves.
//
// The glob is guarded: under `tsx` (npm test, Node) `import.meta.glob` is undefined, so
// `loadFeatures()` returns [] and the app behaves exactly as before.
import type { ComponentType } from 'react';

export interface FeatureModule {
  /** Route path the feature mounts at, e.g. "/feature/hello". */
  path: string;
  /** Human label shown in the sidebar / command palette. */
  label: string;
  /** Sidebar category the feature nests under. */
  category?: string;
  /** React component rendered for the route. */
  component: ComponentType;
}

type FeatureExport = FeatureModule | { default: FeatureModule };

function normalize(mod: FeatureExport): FeatureModule {
  const m = (mod as { default?: FeatureModule }).default ?? (mod as FeatureModule);
  if (!m || typeof m.path !== 'string' || !m.component) {
    throw new Error('Feature module must export { path, label, component }');
  }
  return m;
}

// `import.meta.glob` is a Vite build-time macro; it is not present under plain Node (npm test).
const modules: Record<string, FeatureExport> =
  typeof import.meta.glob === 'function'
    ? (import.meta.glob('./feat-*.tsx', { eager: true }) as Record<string, FeatureExport>)
    : {};

const discovered: FeatureModule[] = Object.values(modules).map(normalize);

/** All discovered feature modules (stable reference). */
export const FEATURES: FeatureModule[] = discovered;

/** Lookup a feature by its route path. */
export function findFeature(path: string): FeatureModule | undefined {
  return FEATURES.find((f) => f.path === path);
}

/** Sidebar entries derived from discovered features, grouped by category. */
export function featureSidebar(): { title: string; items: string[] }[] {
  const groups: Map<string, string[]> = new Map();
  for (const f of FEATURES) {
    const cat = f.category || 'Features';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(f.path);
  }
  return Array.from(groups.entries()).map(([title, items]) => ({ title, items }));
}

export function featureLabel(path: string): string {
  return findFeature(path)?.label || path.replace(/^\//, '');
}
