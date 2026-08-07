/**
 * marketplace/sdk.ts
 *
 * SDK publish helper: validates and registers packages for publishing.
 */

import type { PublishRequest, PublishResult, MarketplacePackage } from './types';

export interface PublishValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePublishRequest(req: Partial<PublishRequest>): PublishValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!req.name || req.name.trim().length === 0) errors.push('Package name is required');
  if (!req.version || !/^\d+\.\d+\.\d+$/.test(req.version)) errors.push('Version must be semver (e.g. 1.0.0)');
  if (!req.source) errors.push('Source is required (local|builtin|remote)');
  if (req.name && req.name.length > 64) warnings.push('Package name exceeds 64 characters');
  if (req.description && req.description.length > 500) warnings.push('Description exceeds 500 characters');
  return { valid: errors.length === 0, errors, warnings };
}

export function buildPackageManifest(req: PublishRequest): MarketplacePackage {
  return {
    name: req.name,
    version: req.version,
    source: req.source,
    description: req.description,
    author: req.author,
    url: req.url,
    tags: req.tags,
    integrity: req.integrity,
    publishedAt: new Date().toISOString(),
  };
}

export function generatePublishScript(pkg: MarketplacePackage): string {
  return `forgeos marketplace publish \\
  --name "${pkg.name}" \\
  --version "${pkg.version}" \\
  --source "${pkg.source}" \\
  ${pkg.description ? `--description "${pkg.description}"` : ''} \\
  ${pkg.author ? `--author "${pkg.author}"` : ''} \\
  ${pkg.url ? `--url "${pkg.url}"` : ''} \\
  ${pkg.tags?.length ? `--tags "${pkg.tags.join(',')}"` : ''}`;
}
