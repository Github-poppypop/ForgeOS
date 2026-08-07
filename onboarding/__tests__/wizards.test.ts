import { describe, it, expect } from 'bun:test';
import { getWizards, getWizardByRole, completeStep, getWizardProgress } from '../wizards';

describe('onboarding/wizards', () => {
  it('returns all wizards', () => {
    const wizards = getWizards();
    expect(wizards.length).toBeGreaterThan(0);
  });

  it('finds wizard by role', () => {
    const wizard = getWizardByRole('CTO');
    expect(wizard).toBeDefined();
    expect(wizard?.role).toBe('CTO');
  });

  it('completes a step', () => {
    const wizard = getWizardByRole('CTO')!;
    const result = completeStep(wizard.id, wizard.steps[0].id);
    expect(result).toBe(true);
    expect(getWizardProgress(wizard.id)).toBeGreaterThan(0);
  });
});
