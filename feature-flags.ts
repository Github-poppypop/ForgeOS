/**
 * feature-flags.ts
 *
 * Feature flags for toggling features per environment.
 */

export interface FeatureFlag {
  key: string;
  description: string;
  enabled: boolean;
  environment: 'development' | 'staging' | 'production' | 'all';
  updatedAt: string;
}

const flags: FeatureFlag[] = [
  { key: 'marketplace.enabled', description: 'Enable marketplace panel', enabled: true, environment: 'all', updatedAt: new Date().toISOString() },
  { key: 'onboarding.wizard', description: 'Enable onboarding wizard', enabled: true, environment: 'all', updatedAt: new Date().toISOString() },
  { key: 'agents.circuit-breaker', description: 'Enable circuit breaker for agents', enabled: false, environment: 'all', updatedAt: new Date().toISOString() },
  { key: 'telemetry.detailed', description: 'Enable detailed telemetry collection', enabled: false, environment: 'production', updatedAt: new Date().toISOString() },
];

export function isFeatureEnabled(key: string, environment = 'development'): boolean {
  const flag = flags.find(f => f.key === key);
  if (!flag) return false;
  return flag.enabled && (flag.environment === 'all' || flag.environment === environment);
}

export function setFeatureFlag(key: string, enabled: boolean, environment: FeatureFlag['environment'] = 'all'): boolean {
  const flag = flags.find(f => f.key === key);
  if (!flag) return false;
  flag.enabled = enabled;
  flag.environment = environment;
  flag.updatedAt = new Date().toISOString();
  return true;
}

export function listFeatureFlags(environment?: FeatureFlag['environment']): FeatureFlag[] {
  if (!environment || environment === 'all') return flags;
  return flags.filter(f => f.environment === 'all' || f.environment === environment);
}
