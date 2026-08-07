import { describe, it, expect } from 'bun:test';
import { isFeatureEnabled, setFeatureFlag, listFeatureFlags } from '../feature-flags';

describe('feature-flags', () => {
  it('checks feature flag', () => {
    expect(isFeatureEnabled('marketplace.enabled')).toBe(true);
    expect(isFeatureEnabled('nonexistent')).toBe(false);
  });

  it('sets feature flag', () => {
    const result = setFeatureFlag('agents.circuit-breaker', true);
    expect(result).toBe(true);
    expect(isFeatureEnabled('agents.circuit-breaker')).toBe(true);
  });

  it('lists feature flags', () => {
    const flags = listFeatureFlags('all');
    expect(flags.length).toBeGreaterThan(0);
  });
});
