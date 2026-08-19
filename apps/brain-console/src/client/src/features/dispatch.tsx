import { findFeature, featureSidebar } from './registry';
import type { ReactNode } from 'react';

/**
 * Render a discovered feature panel by route path, or null if the path is not a feature route.
 * Used from App.tsx renderPanel() so feature branches need no edits to App.tsx.
 */
export function renderFeature(route: string): ReactNode {
  const feat = findFeature(route);
  if (!feat) return null;
  const C = feat.component;
  return <C />;
}

/**
 * Whether the given route is a discovered feature route.
 */
export function isFeatureRoute(route: string): boolean {
  return Boolean(findFeature(route));
}

/**
 * Extra CATEGORIES entries contributed by features (so the sidebar auto-expands).
 * Merged into CATEGORIES in App.tsx.
 */
export const FEATURE_CATEGORIES = featureSidebar();
