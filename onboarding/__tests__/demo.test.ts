import { describe, it, expect } from 'bun:test';
import { seedDemoData, getDemoOrgs, getDemoPages, getDemoPageBySlug } from '../demo';

describe('onboarding/demo', () => {
  it('seeds demo data', () => {
    const data = seedDemoData();
    expect(data.orgs.length).toBeGreaterThan(0);
    expect(data.pages.length).toBeGreaterThan(0);
  });

  it('returns demo orgs', () => {
    const orgs = getDemoOrgs();
    expect(orgs.length).toBeGreaterThan(0);
    expect(orgs[0].name).toBeDefined();
  });

  it('returns demo pages', () => {
    const pages = getDemoPages();
    expect(pages.length).toBeGreaterThan(0);
    expect(pages[0].slug).toBeDefined();
  });

  it('finds page by slug', () => {
    const page = getDemoPageBySlug('welcome');
    expect(page).toBeDefined();
    expect(page?.title).toBe('Welcome to ForgeOS');
  });
});
