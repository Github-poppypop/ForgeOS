/**
 * onboarding/wizards.ts
 *
 * Role-based quickstart wizards for ForgeOS onboarding.
 */

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  action: string;
  completed: boolean;
}

export interface Wizard {
  id: string;
  role: string;
  title: string;
  description: string;
  steps: WizardStep[];
}

const wizards: Wizard[] = [
  {
    id: 'wizard-cto',
    role: 'CTO',
    title: 'CTO Quickstart',
    description: 'Set up engineering org structure and delegate governance.',
    steps: [
      { id: 'cto-1', title: 'Create org', description: 'Initialize org structure', action: '/api/org/create', completed: false },
      { id: 'cto-2', title: 'Add roles', description: 'Seed C-suite roles', action: '/api/roles/seed', completed: false },
      { id: 'cto-3', title: 'Run missions', description: 'Launch first engineering mission', action: '/api/missions/create', completed: false },
    ],
  },
  {
    id: 'wizard-engineering',
    role: 'Engineering',
    title: 'Engineering Quickstart',
    description: 'Set up code repos, CI/CD, and team workflows.',
    steps: [
      { id: 'eng-1', title: 'Connect repos', description: 'Link GitHub repos', action: '/api/integrations/github', completed: false },
      { id: 'eng-2', title: 'Configure CI', description: 'Set up CI pipeline', action: '/api/workflows/create', completed: false },
      { id: 'eng-3', title: 'Add team', description: 'Invite engineering team', action: '/api/roles/assign', completed: false },
    ],
  },
  {
    id: 'wizard-product',
    role: 'Product',
    title: 'Product Quickstart',
    description: 'Set up product roadmap and feature tracking.',
    steps: [
      { id: 'prod-1', title: 'Create roadmap', description: 'Initialize product roadmap', action: '/api/projects/create', completed: false },
      { id: 'prod-2', title: 'Add features', description: 'Track first features', action: '/api/capture', completed: false },
      { id: 'prod-3', title: 'Set metrics', description: 'Configure product metrics', action: '/api/telemetry/metrics', completed: false },
    ],
  },
];

export function getWizards(): Wizard[] {
  return wizards;
}

export function getWizardByRole(role: string): Wizard | undefined {
  return wizards.find(w => w.role.toLowerCase() === role.toLowerCase());
}

export function completeStep(wizardId: string, stepId: string): boolean {
  const wizard = wizards.find(w => w.id === wizardId);
  if (!wizard) return false;
  const step = wizard.steps.find(s => s.id === stepId);
  if (!step) return false;
  step.completed = true;
  return true;
}

export function getWizardProgress(wizardId: string): number {
  const wizard = wizards.find(w => w.id === wizardId);
  if (!wizard) return 0;
  const completed = wizard.steps.filter(s => s.completed).length;
  return Math.round((completed / wizard.steps.length) * 100);
}
