/**
 * services/mock-search.ts
 *
 * Mock search service over seeded pages.
 */

import { registry, MockRequest } from './mock-service-registry';

type Page = { slug: string; title: string; body: string; tags: string[] };

const pages: Page[] = [
  { slug: 'mission/2026-08', title: 'August mission', body: 'Ship marketplace + onboarding wizards + SDK', tags: ['mission', 'product'] },
  { slug: 'rfc/0000', title: 'RFC-0000', body: 'Constitutional governance build for ForgeOS', tags: ['rfc', 'governance'] },
  { slug: 'runbook/incident-response', title: 'Incident response runbook', body: 'P1/P2/P3 triage steps and escalation paths', tags: ['ops', 'runbook'] },
];

registry.register('GET', '/api/search', (req) => {
  const q = String(req.query.q || '').toLowerCase();
  const tag = String(req.query.tag || '').toLowerCase();
  let rows = pages;
  if (tag) rows = rows.filter((p) => (p.tags || []).some((t) => t.toLowerCase().includes(tag)));
  if (q) rows = rows.filter((p) => p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
  return { status: 200, body: { query: q, results: rows.slice(0, 50), total: rows.length } };
});

registry.register('GET', '/api/search/suggest', (req) => {
  const q = String(req.query.q || '').toLowerCase();
  const matches = pages.filter((p) => p.title.toLowerCase().includes(q)).map((p) => ({ slug: p.slug, title: p.title }));
  return { status: 200, body: { suggestions: matches.slice(0, 10) } };
});
