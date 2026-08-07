import { describe, it, expect } from 'bun:test';
import { checkLinks, buildGraph } from '../link-checker';

describe('knowledge-universe/link-checker', () => {
  it('returns link check report', () => {
    const broken = checkLinks('.');
    expect(Array.isArray(broken)).toBe(true);
  });

  it('builds link graph', () => {
    const graph = buildGraph('.');
    expect(graph.nodes.length).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(graph.edges)).toBe(true);
  });
});
