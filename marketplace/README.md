# /marketplace — ForgeOS Capability Marketplace

**Primary owner:** CPO · **Economics co-owner:** CFO
**Purpose:** The composable economy of ForgeOS — publish, discover, and consume
apps, services, and agent skills as tradable capabilities.

## Skeleton
- `src/types.ts` — `MarketplacePackage`, `PublishRequest`, `DiscoverQuery`
- `src/index.ts` — in-memory `publish()` / `discover()` (swap for SQLite/HTTP later)
- `package.json` — `@forgeos/marketplace` workspace package

## Usage
```ts
import { publish, discover } from './src/index';

await publish({
  name: 'forgeos-ui',
  version: '1.0.0',
  source: 'builtin',
  description: 'Brain Console UI',
  tags: ['ui', 'brain'],
});

const results = await discover({ tag: 'ui', limit: 10 });
```

## Rules
- Every listing has a manifest: id, type (app|service|skill), owner, version,
  pricing.
- Pricing/economics requires CFO concurrence (ORG repo mapping).
- Listings must reference a real artifact in `/apps`, `/services`, or `/agents`.
- Discovery is open; consumption is governed by the delegation protocol.
