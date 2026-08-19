import type { ComponentType } from 'react';
import RateLimitDashboard from '../RateLimitDashboard';

export default {
  path: '/feature/ratelimit-dash',
  label: 'Rate-Limit Dashboard',
  category: 'Features',
  component: RateLimitDashboard as ComponentType,
};
