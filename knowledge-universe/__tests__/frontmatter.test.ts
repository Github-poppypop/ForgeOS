import { describe, it, expect } from 'bun:test';
import { normalizeFrontmatter } from '../frontmatter';

describe('knowledge-universe/frontmatter', () => {
  it('normalizes markdown frontmatter', () => {
    const input = '---\ntitle: hello\n---\n# Hello\nWorld';
    const out = normalizeFrontmatter(input);
    expect(out).toContain('title');
    expect(out).toContain('Hello');
  });
});
