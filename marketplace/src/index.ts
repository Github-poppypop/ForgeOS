/**
 * ForgeOS Marketplace — publish/discover skeleton.
 *
 * This is a minimal in-memory implementation intended to be swapped
 * for a real registry (filesystem, SQLite, or remote HTTP) later.
 */

import type {
  DiscoverQuery,
  DiscoverResult,
  MarketplacePackage,
  PublishRequest,
  PublishResult,
} from './types';

const store = new Map<string, MarketplacePackage>();

export async function publish(req: PublishRequest): Promise<PublishResult> {
  const id = `${req.name}@${req.version}`;
  const pkg: MarketplacePackage = {
    name: req.name,
    version: req.version,
    source: req.source,
    description: req.description,
    author: req.author,
    url: req.url,
    tags: req.tags,
    integrity: req.integrity,
    publishedAt: new Date().toISOString(),
  };
  store.set(id, pkg);
  return { ok: true, package: pkg };
}

export async function discover(query: DiscoverQuery): Promise<DiscoverResult> {
  let results = Array.from(store.values());

  if (query.source) {
    results = results.filter((p) => p.source === query.source);
  }
  if (query.tag) {
    results = results.filter((p) => (p.tags ?? []).includes(query.tag));
  }
  if (query.q) {
    const q = query.q.toLowerCase();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.author ?? '').toLowerCase().includes(q)
    );
  }

  const limit = query.limit ?? 50;
  const page = results.slice(0, Math.max(1, limit));

  return { ok: true, packages: page, total: results.length };
}

export function listAll(): MarketplacePackage[] {
  return Array.from(store.values());
}
