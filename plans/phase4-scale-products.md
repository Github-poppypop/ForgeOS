# Phase 4 — Scale Products (M10–M12)
**Owner:** CMO (M10 docs) · CPO (M10–M11 marketplace) · CFO (M12 economics)
**Target:** 2026-11
**Prerequisites:** Phase 1–3 complete (M1–M9 merged, console operational, missions tracked)

---

## M10 — Service Catalog + Marketplace Skeleton

### Goal
Publish a discoverable service catalog in `services/` and a marketplace
skeleton in `marketplace/` that supports publish, discover, and consume flows
with governance hooks (FES-009 publish gate, CFG-001 approval).

### Exact File Paths
- `services/catalog/schema.json`
- `services/registry/index.ts`
- `marketplace/schema/publish.json`
- `marketplace/schema/discover.json`
- `marketplace/registry/index.ts`
- `governance/standards/FES-014.md` — marketplace governance standard
- `governance/forms/marketplace-approval.yaml`

### Command Sequence
```powershell
cd C:\Projects\ForgeOS

git checkout -b feat/m10-marketplace-skeleton
git push -u origin feat/m10-marketplace-skeleton

mkdir -p services/catalog marketplace/schema marketplace/registry

# 1. Service catalog schema (FES-009 compliant)
cat > services/catalog/schema.json << 'EOF'
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ForgeOS Service Catalog Entry",
  "type": "object",
  "required": ["id", "name", "owner", "version", "status", "endpoints"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "name": { "type": "string", "minLength": 3 },
    "owner": { "type": "string", "pattern": "^(CTO|CPO|COO|CMO|CFO)$" },
    "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "status": { "enum": ["draft", "beta", "stable", "deprecated"] },
    "description": { "type": "string" },
    "endpoints": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "method"],
        "properties": {
          "path": { "type": "string", "pattern": "^/" },
          "method": { "type": "string", "enum": ["GET","POST","PATCH","DELETE"] },
          "auth": { "enum": ["none","agent","admin"] }
        }
      }
    },
    "evidence": { "type": "array", "items": { "type": "string" } },
    "linkedMission": { "type": "string" }
  }
}
EOF

# 2. Marketplace publish schema
cat > marketplace/schema/publish.json << 'EOF'
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Marketplace Publish Request",
  "type": "object",
  "required": ["serviceId", "category", "publisher", "approval"],
  "properties": {
    "serviceId": { "type": "string", "format": "uuid" },
    "category": { "enum": ["app","service","skill","agent","infrastructure"] },
    "publisher": { "type": "string" },
    "approval": {
      "type": "object",
      "required": ["approvedBy", "status", "timestamp"],
      "properties": {
        "approvedBy": { "type": "string" },
        "status": { "enum": ["pending","approved","rejected"] },
        "timestamp": { "type": "string", "format": "date-time" }
      }
    },
    "pricing": {
      "type": "object",
      "required": ["model"],
      "properties": {
        "model": { "enum": ["free","seat-based","usage-based","enterprise"] },
        "price": { "type": "number", "minimum": 0 }
      }
    }
  }
}
EOF

# 3. FES-014 standard
cat > governance/standards/FES-014.md << 'EOF'
# FES-014 — Marketplace Governance
**Owner:** CPO · **Inherit:** all published capabilities
1. Every catalog entry must link to a verified Mission or approved RFC.
2. Publish requires owner C-suite approval; consumption requires CFO sign-off if monetized.
3. Capabilities are versioned; deprecated entries redirect to the current stable version.
4. No capability may consume secrets from `/infrastructure/secrets` without explicit CFO/CTO dual approval.
EOF

# 4. Registry API
cat > marketplace/registry/index.ts << 'EOF'
import fs from "fs/promises";
import path from "path";

const CATALOG_DIR = path.join(process.cwd(), "services", "catalog");
const MARKET_DIR = path.join(process.cwd(), "marketplace", "registry");

export async function publishService(input: any) {
  // validate against schema (minimal runtime guard)
  if (!input.id || !input.name) throw new Error("id and name required");
  await fs.mkdir(MARKET_DIR, { recursive: true });
  const file = path.join(MARKET_DIR, `${input.id}.json`);
  await fs.writeFile(file, JSON.stringify(input, null, 2));
  return input;
}

export async function discoverServices(category?: string): Promise<any[]> {
  const files = await fs.readdir(MARKET_DIR).catch(() => []);
  const entries: any[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(MARKET_DIR, f), "utf-8");
    const entry = JSON.parse(raw);
    if (!category || entry.category === category) entries.push(entry);
  }
  return entries;
}
EOF

git add -A
git commit -m "feat(m10): service catalog + marketplace skeleton + FES-014"
git push origin feat/m10-marketplace-skeleton
gh pr create --title "feat(m10): service catalog + marketplace skeleton" --body "Adds catalog schema, publish/discover registry, and marketplace governance standard."
```

### Acceptance Tests
| # | Command | Expected Result |
|---|---------|-----------------|
| M10-A1 | `curl -s -X POST http://localhost:7777/api/marketplace/publish -H "Content-Type: application/json" -d '{"serviceId":"123","name":"Test Service","owner":"CTO","version":"1.0.0","status":"beta","endpoints":[]}'` | `201` (publish) |
| M10-A2 | `curl -s http://localhost:7777/api/marketplace/discover` | Array containing `Test Service` |
| M10-A3 | `cat governance/standards/FES-014.md` | Exists with 4 rules |
| M10-A4 | `cat marketplace/schema/publish.json` | Valid JSON schema with `pricing.model` enum |
| M10-A5 | `ls marketplace/registry/` | Contains `123.json` |

### Rollback
```powershell
git checkout master
git branch -D feat/m10-marketplace-skeleton
gh pr close 10 --delete-branch
```

---

## M11 — External Docs Site + Onboarding Funnel

### Goal
Publish a static docs site from `docs/` (with governance docs, FES index, quick
start) and create an onboarding funnel (README → clone → `./bootstrap.sh` →
first mission) tracked as a governed product.

### Exact File Paths
- `docs/site.config.js`
- `docs/.vitepress/config.js` (or Docusaurus equivalent)
- `docs/README.md` (landing)
- `docs/onboarding/GETTING_STARTED.md`
- `scripts/bootstrap-org.sh`
- `apps/brain-console/public/onboarding-check.json`

### Command Sequence
```powershell
cd C:\Projects\ForgeOS

git checkout -b feat/m11-docs-onboarding
git push -u origin feat/m11-docs-onboarding

mkdir -p docs/onboarding

# 1. VitePress config
cat > docs/.vitepress/config.js << 'EOF'
export default {
  title: "ForgeOS Docs",
  description: "Autonomous engineering operating system docs",
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/introduction" },
      { text: "Governance", link: "/governance/constitution" },
      { text: "API", link: "/api/missions" },
    ],
    sidebar: {
      "/guide/": [
        { text: "Introduction", link: "/guide/introduction" },
        { text: "Getting Started", link: "/guide/getting-started" },
      ],
      "/governance/": [
        { text: "Constitution", link: "/governance/constitution" },
        { text: "Engineering Laws", link: "/governance/laws/EngineeringLaws" },
        { text: "FES Index", link: "/governance/standards" },
      ],
    },
  },
};
EOF

# If VitePress is not installed, install it
Set-Location docs
npm init -y
npm install -D vitepress
Set-Location ..

# 2. Landing page
cat > docs/README.md << 'EOF'
# ForgeOS Documentation
Welcome to ForgeOS — the autonomous engineering operating system.
Browse the sidebar or start at [Getting Started](onboarding/GETTING_STARTED.md).
EOF

# 3. Getting started (governed)
cat > docs/onboarding/GETTING_STARTED.md << 'EOF'
# Getting Started
## Prerequisites
- Node.js 18+, git, PowerShell 5+ (Windows) or bash.
- Isolated brain home: `C:\ForgeOS` (must exist; created by `bootstrap-org.sh`).

## Clone and Bootstrap
```powershell
git clone https://github.com/your-org/ForgeOS.git
cd ForgeOS
git checkout master
.\scripts\bootstrap-org.ps1   # Windows
# or bash scripts/bootstrap-org.sh
```

## Verify
```powershell
# Mission Center CRUD
curl -s http://localhost:7777/api/missions/index

# Knowledge Universe inspect
curl -s http://localhost:7777/api/knowledge

# Brain health
curl -s http://localhost:7777/api/brain/status
```

## Next
- Read Constitution: `governance/constitution/Constitution.md`.
- Check engineering laws: `governance/laws/EngineeringLaws.md`.
- Create your first mission via the Command Center UI.
EOF

# 4. Bootstrap script (idempotent)
cat > scripts/bootstrap-org.ps1 << 'EOF'
[CmdletBinding()]
param(
  [string]$BrainHome = "C:\ForgeOS"
)
$ErrorActionPreference = "Stop"

function New-ItemSafe($path) { if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null } }

Write-Host "Bootstrapping ForgeOS org..."
New-ItemSafe -path $BrainHome
New-ItemSafe -path "$BrainHome\pages"
New-ItemSafe -path "$BrainHome\pages\knowledge-universe"
New-ItemSafe -path "$BrainHome\agents"
New-ItemSafe -path "$BrainHome\agents\agents"

# Seed agent manifests if not already present
$src = "agents"
$dst = "$BrainHome\agents\agents"
$roles = @("ceo","cto","cpo","coo","cmo","cfo","board")
foreach ($r in $roles) {
  $source = Join-Path $src "$r.agent.md"
  $target = Join-Path $dst "$r.agent.md"
  if (Test-Path $source) { Copy-Item -Force $source $target }
}

Write-Host "Bootstrap complete. Brain home: $BrainHome"
EOF

git add -A
git commit -m "feat(m11): external docs site + onboarding funnel + bootstrap script"
git push origin feat/m11-docs-onboarding
gh pr create --title "feat(m11): external docs site + onboarding funnel" --body "Adds VitePress config, onboarding docs, and bootstrap script."
```

### Acceptance Tests
| # | Command | Expected Result |
|---|---------|-----------------|
| M11-A1 | `cd docs && npm run docs:dev` | Dev server starts, `http://localhost:5173` renders |
| M11-A2 | `powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-org.ps1` | `C:\ForgeOS\agents\agents\*.md` populated from repo |
| M11-A3 | Visit `/onboarding/GETTING_STARTED.md` in docs site | Renders with correct code blocks |
| M11-A4 | `git log --oneline | grep -c "feat(m11)"` | `1` |
| M11-A5 | `ls docs/onboarding/` | Contains `GETTING_STARTED.md` |

### Rollback
```powershell
git checkout master
git branch -D feat/m11-docs-onboarding
gh pr close 11 --delete-branch
# docs build lockfile remains; remove node_modules if desired
Remove-Item -Recurse -Force docs/node_modules -ErrorAction SilentlyContinue
```

---

## M12 — Marketplace Economics + Budgeting + Unit Economics

### Goal
Stand up the financial + economic model for the marketplace: pricing models,
CFO approval primitives, budget tracking, and a unit economics dashboard so the
org can make data-driven decisions about monetization.

### Exact File Paths
- `governance/forms/marketplace-approval.yaml`
- `marketplace/pricing/index.ts`
- `marketplace/analytics/unit-economics.ts`
- `apps/brain-console/src/components/MarketplaceEconomics.tsx`
- `apps/brain-console/src/routes/economics.tsx`
- `data/budget/2026-Q3.json`

### Command Sequence
```powershell
cd C:\Projects\ForgeOS

git checkout -b feat/m12-marketplace-economics
git push -u origin feat/m12-marketplace-economics

mkdir -p governance/forms marketplace/pricing marketplace/analytics data/budget

# 1. CFO approval form (YAML, machine-readable)
cat > governance/forms/marketplace-approval.yaml << 'EOF'
formId: "marketplace-approval"
schemaVersion: "1.0"
fields:
  - id: serviceId
    type: string
    required: true
  - id: category
    type: select
    options: [app, service, skill, agent, infrastructure]
    required: true
  - id: pricingModel
    type: select
    options: [free, seat-based, usage-based, enterprise]
    required: true
  - id: price
    type: number
    required: false
    min: 0
  - id: budgetImpact
    type: text
    required: true
  - id: unitEconomicsProjection
    type: text
    required: true
  - id: cfoSignoff
    type: boolean
    required: true
  - id: approvalDate
    type: date
    required: true
EOF

# 2. Pricing module
cat > marketplace/pricing/index.ts << 'EOF'
export interface PricingModel {
  model: "free" | "seat-based" | "usage-based" | "enterprise";
  price?: number;
  currency: string;
}

export function computeUnitEconomics(model: PricingModel, seats = 1, usage = 0): { mrr: number; arpu: number } {
  let mrr = 0;
  if (model.model === "free") { mrr = 0; }
  else if (model.model === "seat-based") { mrr = (model.price ?? 0) * seats; }
  else if (model.model === "usage-based") { mrr = (model.price ?? 0) * usage; }
  else if (model.model === "enterprise") { mrr = model.price ?? 0; }
  const arpu = mrr / Math.max(seats, 1);
  return { mrr, arpu };
}
EOF

# 3. Unit economics calculator
cat > marketplace/analytics/unit-economics.ts << 'EOF'
import { computeUnitEconomics, PricingModel } from "../pricing";

export interface UnitEconomics {
  serviceId: string;
  pricing: PricingModel;
  seats: number;
  usage: number;
  mrr: number;
  arpu: number;
  cac?: number;
  ltv?: number;
  ltvCacRatio?: number;
}

export function calculateUnitEconomics(input: Omit<UnitEconomics, "mrr" | "arpu" | "ltvCacRatio">): UnitEconomics {
  const { mrr, arpu } = computeUnitEconomics(input.pricing, input.seats, input.usage);
  const ltv = input.ltv ?? mrr * 12 * 0.6; // 60% retention, 12-month horizon heuristic
  const ltvCacRatio = input.cac ? ltv / input.cac : undefined;
  return { ...input, mrr, arpu, ltv, ltvCacRatio };
}
EOF

# 4. Economics dashboard component
cat > apps/brain-console/src/components/MarketplaceEconomics.tsx << 'EOF'
import React, { useEffect, useState } from "react";

export default function MarketplaceEconomics() {
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/marketplace/discover")
      .then((r) => r.json())
      .then(setEntries);
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-white">Marketplace Economics</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded bg-surface border border-border p-4">
          <div className="text-xs text-muted uppercase tracking-widest">Published Capabilities</div>
          <div className="text-3xl font-bold text-white mt-2">{entries.length}</div>
        </div>
        <div className="rounded bg-surface border border-border p-4">
          <div className="text-xs text-muted uppercase tracking-widest">Unit Economics Status</div>
          <div className="text-sm text-muted mt-2">Pending CFO data import</div>
        </div>
      </div>
      <div className="rounded bg-surface border border-border divide-y divide-border">
        <div className="p-3 font-semibold text-white">Capability</div>
        {entries.map((e) => (
          <div key={e.serviceId} className="p-3 flex justify-between text-sm">
            <span className="text-white">{e.name}</span>
            <span className="text-muted">{e.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
EOF

cat > apps/brain-console/src/routes/economics.tsx << 'EOF'
import React from "react";
import MarketplaceEconomics from "../components/MarketplaceEconomics";
export default function EconomicsRoute() { return <MarketplaceEconomics />; }
EOF

patch -d apps/brain-console/src/routes -p 1 << 'PATCH'
--- a/index.tsx
+++ b/index.tsx
@@
     { path: "/timeline", element: <TimelineRoute /> },
+    { path: "/economics", element: <EconomicsRoute /> },
   ];
PATCH

# 5. Seed budget track
@'
{
  "quarter": "2026-Q3",
  "owner": "CFO",
  "entries": [
    { "id": "b1", "category": "marketing", "planned": 5000, "actual": 0, "owner": "CMO" },
    { "id": "b2", "category": "cloud", "planned": 2000, "actual": 0, "owner": "CTO" },
    { "id": "b3", "category": "staffing", "planned": 15000, "actual": 0, "owner": "CPO" }
  ]
}
'@ | Out-File -FilePath data/budget/2026-Q3.json -Encoding utf8

git add -A
git commit -m "feat(m12): marketplace economics + budget model + unit economics dashboard"
git push origin feat/m12-marketplace-economics
gh pr create --title "feat(m12): marketplace economics + unit economics dashboard" --body "Adds pricing module, unit-economics calculator, economics dashboard, CFO approval form."
```

### Acceptance Tests
| # | Command / Action | Expected Result |
|---|---------|-----------------|
| M12-A1 | Create a marketplace entry via M10 publish, then hit `/economics` | Entry listed |
| M12-A2 | `node -e "const {calculateUnitEconomics}=require('./marketplace/analytics/unit-economics'); console.log(JSON.stringify(calculateUnitEconomics({serviceId:'x',pricing:{model:'seat-based',price:10,currency:'USD'},seats:5,usage:0}),null,2))"` | Output includes `mrr: 50`, `arpu: 10` |
| M12-A3 | `cat governance/forms/marketplace-approval.yaml` | Valid YAML with `cfoSignoff` boolean |
| M12-A4 | `cat data/budget/2026-Q3.json` | Contains 3 budget entries |
| M12-A5 | Visit `/economics` | Renders counts and table |

### Rollback
```powershell
git checkout master
git branch -D feat/m12-marketplace-economics
gh pr close 12 --delete-branch
```

---

## Phase 4 Exit Criteria (must satisfy ALL)
- [ ] M10–M12 merged to `master`.
- [ ] Services listable via marketplace discover API.
- [ ] FES-014 ratified by CPO.
- [ ] Finance artifact (`governance/forms/marketplace-approval.yaml`) references CFO sign-off.
- [ ] External docs site publishes to Vercel/GitHub Pages (manual step; PR link provided).
- [ ] Unit economics calculator runs without errors for all four pricing models.
- [ ] `data/budget/2026-Q3.json` present and referenced in economics dashboard.

---

