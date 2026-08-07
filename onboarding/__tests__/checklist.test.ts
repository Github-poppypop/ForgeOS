import { describe, it, expect } from 'bun:test';
import { getChecklists, getChecklist, toggleChecklistItem, completeChecklist } from '../checklist';

describe('onboarding/checklist', () => {
  it('returns checklists', () => {
    const lists = getChecklists();
    expect(lists.length).toBeGreaterThan(0);
  });

  it('gets checklist by id', () => {
    const list = getChecklist('onboarding-default');
    expect(list).toBeDefined();
    expect(list?.totalCount).toBeGreaterThan(0);
  });

  it('toggles checklist item', () => {
    const list = getChecklist('onboarding-default')!;
    const item = list.items[0];
    const result = toggleChecklistItem(list.id, item.id);
    expect(result).toBe(true);
  });

  it('completes entire checklist', () => {
    const result = completeChecklist('onboarding-default');
    expect(result).toBe(true);
    const list = getChecklist('onboarding-default')!;
    expect(list.progress).toBe(100);
  });
});
