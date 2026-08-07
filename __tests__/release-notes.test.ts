import { describe, it, expect } from 'bun:test';
import { generateReleaseNotes, getLatestReleaseNotes } from '../release-notes';

describe('release-notes', () => {
  it('generates release notes', () => {
    const notes = generateReleaseNotes({ version: '1.0.0' });
    expect(notes.version).toBe('1.0.0');
    expect(notes.date).toBeDefined();
    expect(Array.isArray(notes.commits)).toBe(true);
  });

  it('returns latest release notes', () => {
    const notes = getLatestReleaseNotes(3);
    expect(notes.length).toBe(3);
  });
});
