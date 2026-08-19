import type { ComponentType } from 'react';
import RateLimitDashboard from '../../../src/client/src/RateLimitDashboard';

export default {
  path: '/feature/ratelimit-dash',
  label: 'Rate-Limit Dashboard',
  category: 'Features',
  component: RateLimitDashboard as ComponentType,
};
