#!/usr/bin/env node
/**
 * scripts/bootstrap-org.ts — Bootstrap ForgeOS org brain from gbrain schema pack
 *
 * Reads the `forgeos` schema pack under:
 *   C:/Users/pop/forge-gbrain/.gbrain/schema-packs/forgeos/pack.yaml
 *
 * and writes a scaffold of entity pages, link verbs, and frontmatter mappings
 * into a target directory (default: `knowledge-universe/org-brain/`).
 *
 * The scaffold is gbrain-ready markdown: each file has YAML frontmatter so
 * the pack's page types and link inference regexes apply immediately.
 *
 * Usage:
 *   tsx scripts/bootstrap-org.ts
 *   tsx scripts/bootstrap-org.ts --target ./org-brain
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/* ─────────────────────────────────────────────
 * Minimal YAML parser (no external deps)
 * ───────────────────────────────────────────── */

export function parseSimpleYaml(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lines = text.split(/\r?\n/);
  const stack: { key: string; obj: Record<string, unknown> }[] = [
    { key: 'root', obj: out },
  ];
  let lastKey: string | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line || line.startsWith('#')) continue;

    const indent = line.search(/\S|$/);
    const content = line.trim();

    if (content.startsWith('- ')) {
      // array item
      const item = content.slice(2).trim();
      const parent = stack[stack.length - 1].obj;
      const parentKey = stack[stack.length - 1].key;

      if (Array.isArray(parent[parentKey])) {
        if (item.includes(':')) {
          const [k, ...rest] = item.split(':');
          const map: Record<string, unknown> = {};
          (parent[parentKey] as Record<string, unknown>[]).push(map);
          stack.push({ key: k.trim(), obj: map });
          lastKey = k.trim();
        } else {
          (parent[parentKey] as string[]).push(item);
        }
      }
      continue;
    }

    if (content.includes(':')) {
      const [k, ...rest] = content.split(':');
      const v = rest.join(':').trim();
      const targetObj = stack[stack.length - 1].obj;
      if (v === '' || v === '>-') {
        targetObj[k.trim()] = '';
        stack.push({ key: k.trim(), obj: targetObj as Record<string, unknown> });
        lastKey = k.trim();
      } else if (v === '[]') {
        targetObj[k.trim()] = [];
        lastKey = k.trim();
      } else if (v === 'true') {
        targetObj[k.trim()] = true;
        lastKey = k.trim();
      } else if (v === 'false') {
        targetObj[k.trim()] = false;
        lastKey = k.trim();
      } else if (/^-?\d+$/.test(v)) {
        targetObj[k.trim()] = parseInt(v, 10);
        lastKey = k.trim();
      } else {
        targetObj[k.trim()] = v.replace(/^["']|["']$/g, '');
        lastKey = k.trim();
      }
    }
  }

  return out;
}

/* ─────────────────────────────────────────────
 * Pack types (loose, derived from schema)
 * ───────────────────────────────────────────── */

interface PackPageType {
  name: string;
  primitive: string;
  path_prefixes: string[];
  extractable: boolean;
  expert_routing: boolean;
}

interface PackLinkType {
  name: string;
  inference?: { regex: string };
}

interface PackFrontmatterLink {
  page_type: string;
  fields: string[];
  link_type: string;
}

interface SchemaPack {
  api_version: string;
  name: string;
  version: string;
  page_types: PackPageType[];
  link_types: PackLinkType[];
  frontmatter_links: PackFrontmatterLink[];
}

/* ─────────────────────────────────────────────
 * Org scaffold definitions
 * ───────────────────────────────────────────── */

interface RoleDef {
  id: string;
  title: string;
  reportsTo: string;
  owns: string[];
  domain: string;
  description: string;
  authorityTier: 'read' | 'write' | 'admin';
}

const ROLES: RoleDef[] = [
  {
    id: 'board',
    title: 'Board',
    reportsTo: 'Charter / Stakeholders',
    owns: ['charter', 'constitution'],
    domain: 'Governance',
    description: 'Ultimate authority / constitutional owner.',
    authorityTier: 'admin',
  },
  {
    id: 'ceo',
    title: 'CEO',
    reportsTo: 'Board',
    owns: ['whole-org', 'strategy'],
    domain: 'Whole Organization',
    description: 'Accountable for the entire organization.',
    authorityTier: 'admin',
  },
  {
    id: 'cto',
    title: 'CTO',
    reportsTo: 'CEO',
    owns: ['services', 'infrastructure', 'agent-runtime'],
    domain: 'Technology / Platform / Infrastructure',
    description: 'Owns technology, platform, infrastructure, and agent runtime.',
    authorityTier: 'write',
  },
  {
    id: 'cpo',
    title: 'CPO',
    reportsTo: 'CEO',
    owns: ['apps', 'marketplace', 'product-roadmap'],
    domain: 'Product / Apps / Marketplace',
    description: 'Owns product strategy, apps, UX, and the marketplace.',
    authorityTier: 'write',
  },
  {
    id: 'coo',
    title: 'COO',
    reportsTo: 'CEO',
    owns: ['delivery', 'qa', 'incident-response', 'knowledge-universe'],
    domain: 'Operations / Delivery / Knowledge',
    description: 'Owns operations, delivery, process, and cross-functional execution.',
    authorityTier: 'write',
  },
  {
    id: 'cmo',
    title: 'CMO',
    reportsTo: 'CEO',
    owns: ['docs', 'marketing', 'community'],
    domain: 'Brand / Growth / Community',
    description: 'Owns brand, growth, community, and go-to-market.',
    authorityTier: 'write',
  },
  {
    id: 'cfo',
    title: 'CFO',
    reportsTo: 'CEO',
    owns: ['finance', 'budgeting', 'compliance'],
    domain: 'Finance / Capital / Compliance',
    description: 'Owns finance, capital, budgeting, and compliance.',
    authorityTier: 'write',
  },
];

const SHARED_CAPABILITIES = [
  'architecture-reviews',
  'security-audits',
  'marketplace-listings',
  'incident-runbooks',
  'onboarding-kit',
];

/* ─────────────────────────────────────────────
 * Writers
 * ───────────────────────────────────────────── */

function writeFileSafe(path: string, content: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, content, 'utf-8');
}

export function frontmatter(meta: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(meta)) {
    const rendered =
      typeof value === 'string'
        ? value
        : JSON.stringify(value);
    lines.push(`${key}: ${rendered}`);
  }
  lines.push('---');
  return lines.join('\n') + '\n\n';
}

export function rolePage(role: RoleDef): string {
  const meta: Record<string, unknown> = {
    id: `role-${role.id}`,
    name: role.title,
    type: 'role',
    primitive: 'entity',
    reports_to: role.reportsTo,
    owns: role.owns,
    domain: role.domain,
    authority_tier: role.authorityTier,
    version: '1.0.0',
  };
  return (
    frontmatter(meta) +
    `# Role: ${role.title}\n\n${role.description}\n\n## Responsibilities\n\n- ${role.domain}\n- Governed by ORG.md §3\n\n## Reporting\n\n- **Reports to:** ${role.reportsTo}\n\n## Decision Rights\n\n- Authorized within mandate at tier **${role.authorityTier}**.\n\n## Delegation\n\n- Escalates to **${role.reportsTo}** for out-of-mandate actions.\n- Irreversible actions require owner sign-off.\n`
  );
}

export function orgPage(): string {
  return (
    frontmatter({
      id: 'org',
      name: 'ForgeOS Org',
      type: 'org',
      primitive: 'concept',
      version: '1.0.0',
    }) +
    `# ForgeOS Organizational Memory\n\nThis directory is the canonical org brain scaffold. It is generated from\nthe forgeos schema pack.\n\n## Structure\n\n- /org — compiled truth above the line, history below.\n- /board /exec /cto /cpo /coo /cmo /cfo — scoped role pages.\n- /decisions — material decision records (ORG §3.5).\n- /incidents — escalation and post-mortem records (ORG §3.3).\n- /capabilities — marketplace capability definitions.\n- /apps-feed — governance uplinks from apps.\n\n## Operational Discipline\n\n1. MECE directories — every record has exactly one primary home.\n2. Compiled truth + timeline — above the line = current state; below = evidence.\n3. Enrichment on every signal — every action enriches the relevant entity page.\n`
  );
}

function decisionPage(id: string, title: string, owner: string): string {
  return (
    frontmatter({
      id,
      name: title,
      type: 'decision',
      primitive: 'annotation',
      owner,
      status: 'proposed',
      tags: ['bootstrap'],
      created_at: new Date().toISOString(),
    }) +
    `# Decision: ${title}\n\n## Rationale\n\n_To be filled._\n\n## Outcome\n\n_To be filled._\n`
  );
}

function incidentPage(id: string, title: string, owner: string, escalatedTo: string): string {
  return (
    frontmatter({
      id,
      name: title,
      type: 'incident',
      primitive: 'annotation',
      reported_by: owner,
      escalated_to: escalatedTo,
      severity: 'medium',
      tags: ['bootstrap'],
      created_at: new Date().toISOString(),
    }) +
    `# Incident: ${title}\n\n## Description\n\n_To be filled._\n\n## Resolution\n\n_To be filled._\n`
  );
}

function capabilityPage(id: string, title: string): string {
  return (
    frontmatter({
      id,
      name: title,
      type: 'capability',
      primitive: 'concept',
      version: '1.0.0',
      tags: ['bootstrap', 'marketplace'],
    }) +
    `# Capability: ${title}\n\n## Summary\n\n_To be filled._\n\n## Publisher\n\n_To be filled._\n`
  );
}

function appFeedPage(id: string, instance: string): string {
  return (
    frontmatter({
      id,
      name: instance,
      type: 'app',
      primitive: 'entity',
      instance,
      read_token: '',
      version: '1.0.0',
    }) +
    `# App: ${instance}\n\n## Governance Uplink\n\n_To be filled._\n`
  );
}

/* ─────────────────────────────────────────────
 * Main bootstrap
 * ───────────────────────────────────────────── */

interface Args {
  target?: string;
  packPath?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if ((token === '--target' || token === '-t') && argv[i + 1]) {
      args.target = argv[++i];
    }
    if ((token === '--pack' || token === '-p') && argv[i + 1]) {
      args.packPath = argv[++i];
    }
  }
  return args;
}

function main(): void {
  const cliArgs = parseArgs(process.argv);
  const target = resolve(cliArgs.target || join('knowledge-universe', 'org-brain'));
  const packPath = resolve(
    cliArgs.packPath ||
      'C:/Users/pop/forge-gbrain/.gbrain/schema-packs/forgeos/pack.yaml',
  );

  if (!existsSync(packPath)) {
    console.error(`Schema pack not found: ${packPath}`);
    process.exit(1);
  }

  const raw = readFileSync(packPath, 'utf-8');
  const parsed = parseSimpleYaml(raw) as SchemaPack;

  console.log(`Loaded schema pack: ${parsed.name}@${parsed.version}`);

  // Org page
  writeFileSafe(join(target, 'org', 'index.md'), orgPage());

  // Roles
  for (const role of ROLES) {
    const roleDir = join(target, role.id);
    writeFileSafe(join(roleDir, 'index.md'), rolePage(role));
  }

  // Shared directories per page types
  for (const pt of parsed.page_types) {
    for (const prefix of pt.path_prefixes) {
      if (pt.name === 'role') continue; // handled above
      const dir = join(target, prefix);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      if (pt.name === 'decision') {
        writeFileSafe(
          join(dir, 'bootstrap-seed.md'),
          decisionPage('decision-bootstrap-001', 'Org bootstrap complete', 'CEO'),
        );
      } else if (pt.name === 'incident') {
        writeFileSafe(
          join(dir, 'bootstrap-seed.md'),
          incidentPage('incident-bootstrap-001', 'Initial bootstrap', 'COO', 'CTO'),
        );
      } else if (pt.name === 'capability') {
        for (const cap of SHARED_CAPABILITIES) {
          writeFileSafe(join(dir, `${cap}.md`), capabilityPage(`cap-${cap}`, cap));
        }
      } else if (pt.name === 'app') {
        writeFileSafe(
          join(dir, 'forgeos-bootstrap.md'),
          appFeedPage('app-bootstrap-001', 'forgeos'),
        );
      }
    }
  }

  console.log(`Bootstrap scaffold written to: ${target}`);
  console.log(`Page types: ${parsed.page_types.map((pt) => pt.name).join(', ')}`);
  console.log(`Link types: ${parsed.link_types.map((lt) => lt.name).join(', ')}`);
  console.log(`Roles seeded: ${ROLES.map((r) => r.title).join(', ')}`);
  console.log('Next steps:');
  console.log('  1. Activate schema pack: gbrain schema use forgeos');
  console.log('  2. Seed entity pages into the org brain.');
  console.log('  3. Wire C-suite agent tokens to scoped slices.');
}

// Run only when invoked directly (not when imported by tests).
const __invoked = process.argv[1] ? realpathSync(process.argv[1]) : "";
const __this = realpathSync(fileURLToPath(import.meta.url));
if (__invoked === __this) {
  main();
}
