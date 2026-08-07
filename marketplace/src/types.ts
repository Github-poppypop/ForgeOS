/**
 * ForgeOS Marketplace — publish/discover skeleton types.
 */

export interface MarketplacePackage {
  /** Unique identifier, e.g. `forgeos-ui` or `gbrain` */
  name: string;
  /** Semver string */
  version: string;
  /** Where the package lives: `local`, `builtin`, `remote` */
  source: 'local' | 'builtin' | 'remote';
  /** Short description */
  description?: string;
  /** Author or agent role */
  author?: string;
  /** Homepage or docs URL */
  url?: string;
  /** Tags for discovery, e.g. `["ui", "brain"]` */
  tags?: string[];
  /** SHA256 or similar integrity hash */
  integrity?: string;
  /** Published at timestamp (ISO) */
  publishedAt?: string;
}

export interface PublishRequest {
  name: string;
  version: string;
  source: MarketplacePackage['source'];
  description?: string;
  author?: string;
  url?: string;
  tags?: string[];
  integrity?: string;
}

export interface DiscoverQuery {
  q?: string;
  tag?: string;
  source?: MarketplacePackage['source'];
  limit?: number;
}

export type PublishResult =
  | { ok: true; package: MarketplacePackage }
  | { ok: false; error: string };

export type DiscoverResult =
  | { ok: true; packages: MarketplacePackage[]; total: number }
  | { ok: false; error: string };
