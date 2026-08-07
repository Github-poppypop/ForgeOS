/**
 * marketplace/compat.ts
 *
 * Compatibility checks for marketplace packages against ForgeOS versions.
 */

export interface CompatibilityReport {
  packageName: string;
  packageVersion: string;
  forgeosVersion: string;
  compatible: boolean;
  issues: string[];
}

export interface PackageManifest {
  name: string;
  version: string;
  forgeosMin?: string;
  forgeosMax?: string;
  engine?: string;
}

const FORGEOS_VERSION = '0.1.0';

function semverCompare(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export function checkCompatibility(manifest: PackageManifest): CompatibilityReport {
  const issues: string[] = [];
  const { forgeosMin, forgeosMax } = manifest;
  if (forgeosMin && semverCompare(FORGEOS_VERSION, forgeosMin) < 0) {
    issues.push(`Requires ForgeOS >= ${forgeosMin}, running ${FORGEOS_VERSION}`);
  }
  if (forgeosMax && semverCompare(FORGEOS_VERSION, forgeosMax) > 0) {
    issues.push(`Requires ForgeOS <= ${forgeosMax}, running ${FORGEOS_VERSION}`);
  }
  return {
    packageName: manifest.name,
    packageVersion: manifest.version,
    forgeosVersion: FORGEOS_VERSION,
    compatible: issues.length === 0,
    issues,
  };
}

export function validateManifest(manifest: unknown): manifest is PackageManifest {
  if (typeof manifest !== 'object' || !manifest) return false;
  const m = manifest as Record<string, unknown>;
  return typeof m.name === 'string' && typeof m.version === 'string';
}
