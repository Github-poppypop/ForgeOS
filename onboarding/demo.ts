/**
 * onboarding/demo.ts
 *
 * Demo data seeder: seed demo orgs, brains, and pages for onboarding.
 */

export interface DemoOrg {
  id: string;
  name: string;
  slug: string;
  description: string;
  roles: string[];
  pages: string[];
}

export interface DemoPage {
  slug: string;
  title: string;
  content: string;
  tags: string[];
}

const demoOrgs: DemoOrg[] = [
  {
    id: 'demo-org-1',
    name: 'Acme Corp',
    slug: 'acme',
    description: 'Demo organization for testing ForgeOS features.',
    roles: ['CEO', 'CTO', 'CPO'],
    pages: ['welcome', 'getting-started', 'api-reference'],
  },
  {
    id: 'demo-org-2',
    name: 'Globex Inc',
    slug: 'globex',
    description: 'Secondary demo org for multi-org testing.',
    roles: ['CEO', 'CTO'],
    pages: ['introduction', 'architecture'],
  },
];

const demoPages: DemoPage[] = [
  {
    slug: 'welcome',
    title: 'Welcome to ForgeOS',
    content: '# Welcome\n\nForgeOS is your engineering brain. Capture decisions, run missions, and govern with clarity.',
    tags: ['onboarding', 'welcome'],
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    content: '# Getting Started\n\n1. Create your org\n2. Add roles\n3. Run your first mission',
    tags: ['onboarding', 'guide'],
  },
  {
    slug: 'api-reference',
    title: 'API Reference',
    content: '# API Reference\n\n## Endpoints\n\n- GET /api/status\n- POST /api/capture\n- GET /api/search',
    tags: ['api', 'reference'],
  },
  {
    slug: 'introduction',
    title: 'Introduction to Globex',
    content: '# Introduction\n\nGlobex Inc uses ForgeOS to coordinate engineering across distributed teams.',
    tags: ['demo', 'globex'],
  },
  {
    slug: 'architecture',
    title: 'Architecture Overview',
    content: '# Architecture\n\nForgeOS uses a brain-console SPA backed by gbrain and PGLite.',
    tags: ['demo', 'architecture'],
  },
];

export function seedDemoData(): { orgs: DemoOrg[]; pages: DemoPage[] } {
  return {
    orgs: demoOrgs,
    pages: demoPages,
  };
}

export function getDemoOrgs(): DemoOrg[] {
  return demoOrgs;
}

export function getDemoPages(): DemoPage[] {
  return demoPages;
}

export function getDemoPageBySlug(slug: string): DemoPage | undefined {
  return demoPages.find(p => p.slug === slug);
}
