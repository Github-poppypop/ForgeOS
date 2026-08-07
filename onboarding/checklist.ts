/**
 * onboarding/checklist.ts
 *
 * Guided onboarding checklist for new ForgeOS users.
 */

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  category: 'setup' | 'configuration' | 'integration' | 'verification';
  completed: boolean;
  required: boolean;
}

export interface Checklist {
  id: string;
  name: string;
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  progress: number;
}

const checklists: Checklist[] = [
  {
    id: 'onboarding-default',
    name: 'Default Onboarding',
    items: [
      { id: 'chk-1', title: 'Create account', description: 'Sign up or log in to ForgeOS', category: 'setup', completed: false, required: true },
      { id: 'chk-2', title: 'Set up org', description: 'Create your first organization', category: 'setup', completed: false, required: true },
      { id: 'chk-3', title: 'Invite team', description: 'Add team members to your org', category: 'setup', completed: false, required: false },
      { id: 'chk-4', title: 'Configure roles', description: 'Assign C-suite roles', category: 'configuration', completed: false, required: true },
      { id: 'chk-5', title: 'Connect integrations', description: 'Link Slack, GitHub, or Notion', category: 'integration', completed: false, required: false },
      { id: 'chk-6', title: 'Run first mission', description: 'Launch a test mission', category: 'verification', completed: false, required: true },
    ],
    completedCount: 0,
    totalCount: 6,
    progress: 0,
  },
];

function updateProgress(checklist: Checklist): void {
  const completed = checklist.items.filter(i => i.completed).length;
  checklist.completedCount = completed;
  checklist.progress = Math.round((completed / checklist.totalCount) * 100);
}

export function getChecklists(): Checklist[] {
  return checklists.map(c => ({ ...c, progress: Math.round((c.completedCount / c.totalCount) * 100) }));
}

export function getChecklist(id: string): Checklist | undefined {
  const checklist = checklists.find(c => c.id === id);
  if (!checklist) return undefined;
  return { ...checklist, progress: Math.round((checklist.completedCount / checklist.totalCount) * 100) };
}

export function toggleChecklistItem(checklistId: string, itemId: string): boolean {
  const checklist = checklists.find(c => c.id === checklistId);
  if (!checklist) return false;
  const item = checklist.items.find(i => i.id === itemId);
  if (!item) return false;
  item.completed = !item.completed;
  updateProgress(checklist);
  return true;
}

export function completeChecklist(checklistId: string): boolean {
  const checklist = checklists.find(c => c.id === checklistId);
  if (!checklist) return false;
  checklist.items.forEach(item => item.completed = true);
  updateProgress(checklist);
  return true;
}
