import { describe, it, expect } from 'bun:test';
import { checkCompatibility, validateManifest } from '../compat';

describe('marketplace/compat', () => {
  it('checks compatibility with valid manifest', () => {
    const report = checkCompatibility({ name: 'pkg', version: '1.0.0' });
    expect(report.compatible).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it('detects version mismatch', () => {
    const report = checkCompatibility({ name: 'pkg', version: '1.0.0', forgeosMin: '2.0.0' });
    expect(report.compatible).toBe(false);
    expect(report.issues.length).toBeGreaterThan(0);
  });

  it('validates manifest shape', () => {
    expect(validateManifest({ name: 'x', version: '1.0.0' })).toBe(true);
    expect(validateManifest({})).toBe(false);
  });
});
