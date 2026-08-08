import { chunkText, embedChunks, search, buildIndex, ollamaEmbedder } from '../ingest';

describe('ingest', () => {
  const markdown = `# Title\n\nIntro paragraph.\n\n## Section A\n\nContent for section A.\n\n### Sub A1\n\nMore detail here.\n\n## Section B\n\nFinal content.`;

  const yaml = `---\nname: Alice\nrole: CEO\n---\nname: Bob\nrole: CTO`;

  it('chunks markdown by headings', () => {
    const chunks = chunkText(markdown, 'markdown');
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.some((c) => c.heading?.includes('Section A'))).toBe(true);
    expect(chunks.some((c) => c.heading?.includes('Section B'))).toBe(true);
  });

  it('chunks yaml by document separator', () => {
    const chunks = chunkText(yaml, 'yaml');
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it('produces real Ollama embeddings or fallback vector', async () => {
    const chunks = chunkText(markdown, 'markdown');
    const embedded = await embedChunks(chunks, ollamaEmbedder);
    for (const chunk of embedded) {
      expect(chunk.embedding.length).toBeGreaterThan(0);
    }
  });

  it('searches chunks with BM25-lite', () => {
    const chunks = chunkText(markdown, 'markdown');
    const index = buildIndex(chunks);
    const results = search('section A detail', index, 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.text.toLowerCase()).toContain('section a');
  });

  it('returns empty results for irrelevant queries', () => {
    const chunks = chunkText(markdown, 'markdown');
    const index = buildIndex(chunks);
    const results = search('zzzznotpresent', index, 5);
    expect(results).toHaveLength(0);
  });
});
