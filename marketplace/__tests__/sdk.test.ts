import { describe, it, expect } from 'bun:test';
import { validatePublishRequest, buildPackageManifest, generatePublishScript } from '../sdk';

describe('marketplace/sdk', () => {
  it('validates publish request', () => {
    const result = validatePublishRequest({ name: 'test', version: '1.0.0', source: 'local' });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid version', () => {
    const result = validatePublishRequest({ name: 'test', version: 'bad', source: 'local' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('builds manifest', () => {
    const manifest = buildPackageManifest({ name: 'pkg', version: '1.0.0', source: 'local', description: 'desc' });
    expect(manifest.name).toBe('pkg');
    expect(manifest.description).toBe('desc');
  });

  it('generates publish script', () => {
    const script = generatePublishScript({ name: 'pkg', version: '1.0.0', source: 'local' });
    expect(script).toContain('forgeos marketplace publish');
    expect(script).toContain('--name "pkg"');
  });
});
