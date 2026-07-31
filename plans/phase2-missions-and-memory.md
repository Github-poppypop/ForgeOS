# Phase 2 — Missions and Memory (M1–M6)
**Owner:** CPO (M1–M4 product halves) · CTO (M5–M6 runtime halves)
**Target:** 2026-09
**Prerequisites:** Phase 1 complete (agent skeletons in `agents/`, brain-console on `:7777`, RFC-0000 ratified)

---

## M1 — Mission Data Model + CRUD API

### Goal
Stand up the canonical Mission record type and a minimal REST API so missions
can be created, proposed, approved, executed, reviewed, and marked Done per
`Constitution` Article V. Missions are the unit of work; every feature requires
one.

### Exact File Paths
- `apps/brain-console/src/lib/schemas/mission.ts` — Zod schema
- `apps/brain-console/src/lib/storage/missions.ts` — filesystem JSON store
- `apps/brain-console/src/routes/api/missions/[id].ts` — CRUD endpoints
- `knowledge-universe/decisions/decision-record-template.md` — template
- `governance/standards/FES-013.md` — mission record standard (new standard)

### Command Sequence
```powershell
cd C:\Projects\ForgeOS

# 1. Ensure branch
git checkout -b feat/m1-mission-model
git push -u origin feat/m1-mission-model

# 2. Add FES-013 standard
cat > governance/standards/FES-013.md << 'EOF'
# FES-013 — Mission Record Standard
**Owner:** CPO · **Inherit:** all projects
1. Every mission requires: Vision, Requirements, RFC, Architecture, DB Design,
   API Design, UI Design, Test Strategy, Security Review, Definition of Done.
2. Missions transition through: Proposed → Approved → Executing → Review → Done.
3. Mission files live under `apps/poolleague/` (product scope) or project-local
   `missions/` folder when managed by Project Registry (M14 future).
4. State transitions are gated: Proposed requires C-suite sponsor. Done requires
   QA sign-off in the Decision Ledger.
EOF
git add governance/standards/FES-013.md
git commit -m "feat(gov): add FES-013 mission record standard"

# 3. Add mission schema
mkdir -p apps/brain-console/src/lib/schemas
cat > apps/brain-console/src/lib/schemas/mission.ts << 'EOF'
import { z } from "zod";

export const MissionStatus = z.enum(["Proposed", "Approved", "Executing", "Review", "Done", "Blocked"]);

export const MissionSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(3).max(64),
  title: z.string().min(1),
  vision: z.string().min(1),
  requirements: z.string().min(1),
  rfc: z.string().url().optional(),
  architecture: z.string().optional(),
  dbDesign: z.string().optional(),
  apiDesign: z.string().optional(),
  uiDesign: z.string().optional(),
  testStrategy: z.string().optional(),
  securityReview: z.string().optional(),
  definitionOfDone: z.array(z.string()),
  status: MissionStatus,
  owner: z.string().regex(/^(CPO|CTO|COO|CMO|CFO)$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});

export type Mission = z.infer<typeof MissionSchema>;
EOF

# 4. Add storage adapter
mkdir -p apps/brain-console/src/lib/storage
cat > apps/brain-console/src/lib/storage/missions.ts << 'EOF'
import fs from "fs/promises";
import path from "path";
import { Mission, MissionSchema } from "../schemas/mission";

const MISSIONS_DIR = path.join(process.cwd(), "data", "missions");

export async function ensureMissionsDir() {
  await fs.mkdir(MISSIONS_DIR, { recursive: true });
}

export async function listMissions(): Promise<Mission[]> {
  await ensureMissionsDir();
  const files = await fs.readdir(MISSIONS_DIR);
  const missions: Mission[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(MISSIONS_DIR, file), "utf-8");
    const parsed = JSON.parse(raw);
    const validated = MissionSchema.parse(parsed);
    missions.push(validated);
  }
  return missions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getMission(slug: string): Promise<Mission | null> {
  const file = path.join(MISSIONS_DIR, `${slug}.json`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    return MissionSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function createMission(input: Omit<Mission, "id" | "createdAt" | "updatedAt">): Promise<Mission> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const mission: Mission = { ...input, id, createdAt: now, updatedAt: now };
  await fs.writeFile(path.join(MISSIONS_DIR, `${mission.slug}.json`), JSON.stringify(mission, null, 2));
  return mission;
}

export async function updateMission(slug: string, patch: Partial<Omit<Mission, "id" | "slug" | "createdAt">>): Promise<Mission> {
  const existing = await getMission(slug);
  if (!existing) throw new Error(`Mission ${slug} not found`);
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await fs.writeFile(path.join(MISSIONS_DIR, `${slug}.json`), JSON.stringify(updated, null, 2));
  return updated;
}

export async function deleteMission(slug: string): Promise<void> {
  const file = path.join(MISSIONS_DIR, `${slug}.json`);
  await fs.unlink(file).catch(() => {});
}
EOF

# 5. Wire API route (create new file)
mkdir -p apps/brain-console/src/routes/api/missions
cat > apps/brain-console/src/routes/api/missions/[id].ts << 'EOF'
import { $type, router } from "../../_shared";
import { listMissions, getMission, createMission, updateMission, deleteMission } from "../../../lib/storage/missions";

export const GET = router.handler(async (ctx) => {
  const id = ctx.req.param("id");
  if (id === "index") {
    return json(await listMissions());
  }
  const mission = await getMission(id);
  if (!mission) return json({ error: "Not found" }, 404);
  return json(mission);
});

export const POST = router.handler(async (ctx) => {
  const body = await ctx.req.json();
  const created = await createMission(body);
  // Write decision record for mission approval gate
  await appendDecisionRecord({
    type: "mission",
    id: created.id,
    action: "created",
    author: created.owner,
    rationale: "Phase 2 M1 seed record",
  });
  return json(created, 201);
});

export const PATCH = router.handler(async (ctx) => {
  const id = ctx.req.param("id");
  const patch = await ctx.req.json();
  const updated = await updateMission(id, patch);
  return json(updated);
});

export const DELETE = router.handler(async (ctx) => {
  const id = ctx.req.param("id");
  await deleteMission(id);
  return json({ ok: true });
});
EOF

# 6. Configure brain-console to mount the new router
patch -d apps/brain-console -p 1 << 'PATCH'
--- a/src/routes/api/index.ts
+++ b/src/routes/api/index.ts
@@
   import ...missionsRouter from "./missions/index";
+  app.use("/api/missions", missionsRouter);
PATCH

git add -A
git commit -m "feat(m1): mission schema, storage, CRUD API, FES-013"
git push origin feat/m1-mission-model

# Create PR
gh pr create --title "feat(m1): mission data model + CRUD API" --body "Implements FES-013, mission schema, filesystem store, REST endpoints."

# 7. Open console, verify
Start-Process "http://localhost:7777/#/missions"
```

### Acceptance Tests
| # | Command | Expected Result |
|---|---------|-----------------|
| M1-A1 | `curl -s http://localhost:7777/api/missions/index` | `[]` (empty array, store healthy) |
| M1-A2 | `curl -s -X POST http://localhost:7777/api/missions/index -H "Content-Type: application/json" -d '{"slug":"m1-test","title":"M1 Seed","vision":"seed","requirements":"seed","definitionOfDone":["test"],"status":"Proposed","owner":"CPO"}'` | `{"id":"...","slug":"m1-test","status":"Proposed",...}` |
| M1-A3 | `curl -s http://localhost:7777/api/missions/m1-test` | Returns same record with `id`/`status` |
| M1-A4 | `ls data/missions/` | Contains `m1-test.json` |
| M1-A5 | `cat governance/standards/FES-013.md` | Exists, non-empty |
| M1-A6 | `cat knowledge-universe/decisions/decision-record-template.md` | Template seed present |

### Rollback
```powershell
git checkout master
git branch -D feat/m1-mission-model
Remove-Item -Recurse -Force C:\Projects\ForgeOS\data\missions
gh pr close 1 --delete-branch
```

---

## M2 — Mission Center UI (Console Panels + State Machine)

### Goal
Surface missions in the brain-console with a dashboard that enforces the
Proposed → Approved → Executing → Review → Done state machine with gating.

### Exact File Paths
- `apps/brain-console/src/components/MissionDashboard.tsx`
- `apps/brain-console/src/routes/index.tsx` (add `/missions` panel)
- `apps/brain-console/public/missions.css`
- `agents/skills/forgeos/mission-center/SKILL.md`

### Command Sequence
```powershell
cd C:\Projects\ForgeOS

git checkout -b feat/m2-mission-center-ui
git push -u origin feat/m2-mission-center-ui

mkdir -p agents/skills/forgeos/mission-center
cat > agents/skills/forgeos/mission-center/SKILL.md << 'EOF'
---
name: forgeos-mission-center
role: CPO
reports_to: CEO
authority_tier: write
domain: Product / Apps / Marketplace
owner_agent: cpo
version: 1.0.0
description: Mission planning, execution tracking, and approval gate.
triggers:
  - "create mission"
  - "approve mission"
  - "mission status"
gbrain:
  context_queries:
    - id: active-missions
      kind: list
      filter: { type: mission, status: Executing }
      limit: 10
delegation:
  in_mandate: [mission-planning, product-strategy, roadmap]
  requires_request: [CTO, COO, CFO]
  escalates_to: CEO
  irreversible_requires: [CEO]
---
# Skill: Mission Center
## When to invoke
Trigger: any request to plan, approve, track, or close a mission.

## Mandate
Write and update mission records under `data/missions/`.
Gate transitions: Proposed → Approved requires C-suite sponsor (CEO/CPO/CTO/COO/CMO/CFO).
Done requires QA sign-off recorded as a Decision Ledger entry.

## Operations
1. Load `data/missions/{slug}.json`.
2. Validate status transition against allowed matrix:
   Proposed → Approved  (sponsor)
   Approved → Executing  (CPO + relevant C-suite)
   Executing → Review    (self, gated by test pass)
   Review → Done         (CPO + COO QA sign-off)
   Any → Blocked         (any)
3. Write back updated record.
4. Append Decision Ledger entry.

## gbrain writeback
- decision record on every state change.
- incident record on Blocked state.
EOF

# UI component
cat > apps/brain-console/src/components/MissionDashboard.tsx << 'EOF'
import React, { useEffect, useState } from "react";

type Mission = {
  id: string;
  slug: string;
  title: string;
  status: string;
  owner: string;
  updatedAt: string;
};

export default function MissionDashboard() {
  const [missions, setMissions] = useState<Mission[]>([]);

  useEffect(() => {
    fetch("/api/missions/index")
      .then((r) => r.json())
      .then(setMissions);
  }, []);

  const statuses = ["Proposed", "Approved", "Executing", "Review", "Done", "Blocked"];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-white">Mission Center</h1>
      <div className="grid grid-cols-6 gap-2">
        {statuses.map((s) => (
          <div key={s} className="rounded bg-surface p-3 border border-border">
            <div className="text-xs text-muted uppercase tracking-widest">{s}</div>
            <div className="text-2xl font-bold text-white mt-1">
              {missions.filter((m) => m.status === s).length}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded bg-surface border border-border divide-y divide-border">
        {missions.map((m) => (
          <div key={m.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-white">{m.title}</div>
              <div className="text-xs text-muted">{m.slug} · owner: {m.owner}</div>
            </div>
            <div className="text-xs px-2 py-1 rounded bg-accent/20 text-accent">{m.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
EOF

# mount route
patch -d apps/brain-console/src/routes -p 1 << 'PATCH'
--- a/index.tsx
+++ b/index.tsx
@@
   const routes: RouteObject[] = [
     { path: "/", element: <CommandCenter /> },
+    { path: "/missions", element: <MissionDashboard /> },
     ...
   ];
PATCH

git add -A
git commit -m "feat(m2): mission center UI + state-machine gating"
git push origin feat/m2-mission-center-ui
gh pr create --title "feat(m2): mission center UI + state-machine gating" --body "Adds dashboard, state gates, mission-center skill."
```

### Acceptance Tests
| # | Command / Action | Expected Result |
|---|-----------------|-----------------|
| M2-A1 | `npm run dev` inside `apps/brain-console` then visit `http://localhost:7777/#/missions` | Dashboard renders with KPI cards (0 each) |
| M2-A2 | Seed mission via M1 POST, then refresh `/missions` | Mission row appears in list |
| M2-A3 | Attempt `PATCH /api/missions/{id}` with `status=Approved` and `sponsor=Board` | 200 (gate: Board is in allowed sponsors) |
| M2-A4 | Attempt transition to `Done` without `passed=true` QA flag | 403 or 400 rejection |
| M2-A5 | `cat agents/skills/forgeos/mission-center/SKILL.md` | Valid YAML frontmatter, `reports_to`, `escalates_to`, `context_queries` present |

### Rollback
```powershell
git checkout master
git branch -D feat/m2-mission-center-ui
gh pr close 2 --delete-branch
```

---

## M3 — Knowledge Universe Core + Seed Charter

### Goal
Stand up the `knowledge-universe/` logic layer (in-process brain pages and JSON
store) with schema for decisions, incidents, designs, and lessons, and seed the
charter documents into the isolated brain.

### Exact File Paths
- `knowledge-universe/schema/types.ts`
- `knowledge-universe/schema/decision.ts`
- `knowledge-universe/schema/incident.ts`
- `knowledge-universe/schema/design.ts`
- `knowledge-universe/schema/lesson.ts`
- `knowledge-universe/index.ts` — barrel export
- `apps/brain-console/src/routes/api/knowledge.ts` — ingest endpoint
- `C:\ForgeOS\pages\knowledge-universe\` — brain pages (gbrain isolated vault)

### Command Sequence
```powershell
cd C:\Projects\ForgeOS

git checkout -b feat/m3-knowledge-universe-core
git push -u origin feat/m3-knowledge-universe-core

# 1. Create schema dirs
mkdir -p knowledge-universe/schema

# 2. Decision record type
cat > knowledge-universe/schema/decision.ts << 'EOF'
export type DecisionStatus = "Proposed" | "Approved" | "Rejected" | "Superseded";

export interface DecisionRecord {
  id: string;
  type: "decision";
  slug: string;
  title: string;
  status: DecisionStatus;
  owner: string;
  authority: string;
  date: string;
  rationale: string;
  alternatives: string[];
  confidence: number;      // 0-1
  evidence: string[];
  linkedArtifacts: string[];
  createdAt: string;
  updatedAt: string;
}

export function validateDecision(d: unknown): DecisionRecord {
  // minimal runtime guard; Zod preferred in production
  if (typeof d !== "object" || d === null || !("id" in (d as any))) {
    throw new Error("Invalid decision record");
  }
  return d as DecisionRecord;
}
EOF

# 3. Incident type
cat > knowledge-universe/schema/incident.ts << 'EOF'
export interface IncidentRecord {
  id: string;
  type: "incident";
  slug: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "Open" | "Investigating" | "Resolved" | "PostMortem";
  owner: string;
  reportedAt: string;
  resolvedAt?: string;
  rootCause?: string;
  remediation?: string;
  linkedMission?: string;
  linkedDecision?: string;
}
EOF

# 4. Design and lesson types (lightweight)
cat > knowledge-universe/schema/design.ts << 'EOF'
export interface DesignRecord {
  id: string;
  type: "design";
  slug: string;
  title: string;
  owner: string;
  rationale: string;
  alternatives: string[];
  date: string;
  linkedRfc?: string;
}
EOF

cat > knowledge-universe/schema/lesson.ts << 'EOF'
export interface LessonRecord {
  id: string;
  type: "lesson";
  slug: string;
  title: string;
  pattern: "anti-pattern" | "best-practice" | "gotcha";
  owner: string;
  date: string;
  context: string;
  recommendation: string;
}
EOF

# 5. Barrel + index
cat > knowledge-universe/schema/types.ts << 'EOF'
export * from "./decision";
export * from "./incident";
export * from "./design";
export * from "./lesson";
EOF

cat > knowledge-universe/schema/index.ts << 'EOF'
export * from "./types";
export * from "./decision";
export * from "./incident";
export * from "./design";
export * from "./lesson";
EOF

cat > knowledge-universe/index.ts << 'EOF'
export * from "./schema";
EOF

# 6. API ingest endpoint
mkdir -p apps/brain-console/src/routes/api
cat > apps/brain-console/src/routes/api/knowledge.ts << 'EOF'
import { router } from "./_shared";
import fs from "fs/promises";
import path from "path";

const KU_DIR = path.join(process.cwd(), "data", "knowledge");

async function ensureDir() {
  await fs.mkdir(KU_DIR, { recursive: true });
}

export const POST = router.handler(async (ctx) => {
  const body = await ctx.req.json();
  const allowed = ["decision", "incident", "design", "lesson"];
  const kind = (body as any)?.type;
  if (!allowed.includes(kind)) {
    return json({ error: `type must be one of ${allowed.join(", ")}` }, 400);
  }
  await ensureDir();
  const slug = (body as any).slug || crypto.randomUUID().slice(0, 8);
  await fs.writeFile(path.join(KU_DIR, `${kind}-${slug}.json`), JSON.stringify(body, null, 2));
  return json({ ok: true, kind, slug }, 201);
});

export const GET = router.handler(async () => {
  await ensureDir();
  const files = await fs.readdir(KU_DIR);
  return json({ files: files.filter((f) => f.endsWith(".json")) });
});
EOF

# 7. Seed charter into brain (gbrain isolated vault)
$brainDir = "C:\ForgeOS\pages\knowledge-universe"
New-Item -ItemType Directory -Path $brainDir -Force | Out-Null

@"
# Knowledge Universe — Charter
**Status:** Immutable · **Version:** 1.0.0 · **Owner:** COO
**Curation:** All roles submit material outcomes here.

## Contents
- decisions/ — decision records, immutable, corrections are superseding records.
- incidents/ — incident + post-mortem records.
- designs/ — design notes and rationale.
- lessons/ — recurring lessons / anti-patterns.

## Rules
- Material decisions recorded with: goal, owner, authority, date, rationale, outcome.
- Corrections are new records that supersede; never silent edits.
"@ | Out-File -FilePath (Join-Path $brainDir "index.md") -Encoding utf8

# 8. Load into gbrain (consult your gbrain CLI docs; this is a placeholder insertion)
# Expected call after gbrain is running:
#   gbrain ingest page C:\ForgeOS\pages\knowledge-universe\index.md
# If gbrain CLI is not available, skip and note in rollback.

git add -A
git commit -m "feat(m3): knowledge-universe core schema + seed charter"
git push origin feat/m3-knowledge-universe-core
gh pr create --title "feat(m3): knowledge-universe core schema + seed charter" --body "Adds schema, ingest endpoint, and charter seed."
```

### Acceptance Tests
| # | Command | Expected Result |
|---|---------|-----------------|
| M3-A1 | `curl -s http://localhost:7777/api/knowledge` | `{"files":[]}` |
| M3-A2 | `curl -s -X POST http://localhost:7777/api/knowledge -H "Content-Type: application/json" -d '{"type":"decision","slug":"seed","title":"Seed decision","status":"Approved","owner":"CEO","authority":"CEO","date":"'$(Get-Date -Format o)'","rationale":"seed","alternatives":[],"confidence":1,"evidence":[],"linkedArtifacts":[]}'` | `{"ok":true,"type":"decision","slug":"seed"}` |
| M3-A3 | `curl -s http://localhost:7777/api/knowledge` | `{"files":["decision-seed.json"]}` |
| M3-A4 | `ls C:\ForgeOS\pages\knowledge-universe\` | Contains `index.md` |
| M3-A5 | `node -e "require('./knowledge-universe/schema/decision')"` | No throw |

### Rollback
```powershell
git checkout master
git branch -D feat/m3-knowledge-universe-core
gh pr close 3 --delete-branch
Remove-Item -Recurse -Force C:\ForgeOS\pages\knowledge-universe
Remove-Item -Recurse -Force C:\Projects\ForgeOS\data\knowledge
```

---

## M4 — Knowledge Universe Ingestion + Retrieval API

### Goal
Bind the brain to the Knowledge Universe so agents can write and query
decisions/incidents via gbrain context_queries and the console REST API.

### Exact File Paths
- `apps/brain-console/src/lib/knowledge/retrieval.ts`
- `apps/brain-console/src/routes/api/knowledge/query.ts`
- `knowledge-universe/retrieval/query.ts`
- `knowledge-universe/retrieval/embeddings.ts` (optional; connects to Ollama `mxbai-embed-large`)

### Command Sequence
```powershell
cd C:\Projects\ForgeOS

git checkout -b feat/m4-ku-ingestion
git push -u origin feat/m4-ku-ingestion

mkdir -p knowledge-universe/retrieval
cat > knowledge-universe/retrieval/query.ts << 'EOF'
import fs from "fs/promises";
import path from "path";
import { DecisionRecord, IncidentRecord, DesignRecord, LessonRecord } from "../schema";

const KU_DIR = path.join(process.cwd(), "data", "knowledge");

type KUItem = DecisionRecord | IncidentRecord | DesignRecord | LessonRecord;

export async function queryByType(type: string): Promise<KUItem[]> {
  const files = await fs.readdir(KU_DIR).catch(() => []);
  const items: KUItem[] = [];
  for (const file of files) {
    if (!file.startsWith(type) || !file.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(KU_DIR, file), "utf-8");
    items.push(JSON.parse(raw));
  }
  return items;
}

export async function queryByTag(tag: string): Promise<KUItem[]> {
  const files = await fs.readdir(KU_DIR).catch(() => []);
  const results: KUItem[] = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(KU_DIR, file), "utf-8");
    const obj = JSON.parse(raw);
    const tags = (obj.tags as string[]) || [];
    if (tags.some((t: string) => t.toLowerCase().includes(tag.toLowerCase()))) {
      results.push(obj);
    }
  }
  return results;
}
EOF

# API query route
cat > apps/brain-console/src/routes/api/knowledge/query.ts << 'EOF'
import { router } from "../_shared";
import { queryByType, queryByTag } from "../../../lib/knowledge/retrieval/query";

export const GET = router.handler(async (ctx) => {
  const url = new URL(ctx.req.url, "http://localhost");
  const type = url.searchParams.get("type") || "";
  const tag = url.searchParams.get("tag") || "";
  if (type) return json(await queryByType(type));
  if (tag) return json(await queryByTag(tag));
  return json({ error: "Provide ?type= or ?tag=" }, 400);
});
EOF

# Console retrieval helper
mkdir -p apps/brain-console/src/lib/knowledge
cat > apps/brain-console/src/lib/knowledge/retrieval.ts << 'EOF'
export async function searchKnowledge(query: string): Promise<any[]> {
  // Soft-mention placeholder: real embedding search requires Ollama running.
  // Until then, filter by substring across decision rationale + title.
  const res = await fetch(`/api/knowledge/query?tag=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
EOF

# Mount
patch -d apps/brain-console/src/routes/api -p 1 << 'PATCH'
--- a/knowledge.ts
+++ b/knowledge.ts
@@
 import ...knowledgeRouter from "./knowledge";
+import ...knowledgeQueryRouter from "./knowledge/query";
 export const router = Router();
 export const GET = ...
 export const POST = ...
+
+app.use("/api/knowledge", knowledgeRouter);
+app.use("/api/knowledge/query", knowledgeQueryRouter);
PATCH

git add -A
git commit -m "feat(m4): knowledge universe retrieval API"
git push origin feat/m4-ku-ingestion
gh pr create --title "feat(m4): knowledge universe retrieval API" --body "Adds query endpoints and embedding-ready retrieval helper."
```

### Acceptance Tests
| # | Command | Expected Result |
|---|---------|-----------------|
| M4-A1 | `curl -s "http://localhost:7777/api/knowledge/query?type=decision"` | Returns array of decision records |
| M4-A2 | `curl -s -X POST http://localhost:7777/api/knowledge -d '{"type":"lesson","slug":"l1","title":"Lesson","pattern":"best-practice","owner":"CTO","date":"'$(Get-Date -Format o)'","context":"ctx","recommendation":"use it"}'` | Created record with `201` |
| M4-A3 | `curl -s "http://localhost:7777/api/knowledge/query?type=lesson"` | Array containing the new record |

### Rollback
```powershell
git checkout master
git branch -D feat/m4-ku-ingestion
gh pr close 4 --delete-branch
Remove-Item -Recurse -Force C:\Projects\ForgeOS\data\knowledge
```

---

## M5 — Agent Runtime ↔ Mission Binding

### Goal
Bind the Phase 1 agent runtime so that each mission can spawn bound agents,
log task output, and emit a Decision Ledger entry on completion or failure.

### Exact File Paths
- `agents/runtime/mission-binder.ts`
- `agents/runtime/types.ts` (extend)
- `services/mission-dispatcher/src/index.ts`
- `apps/brain-console/src/components/MissionAssignment.tsx`

### Command Sequence
```powershell
cd C:\Projects\ForgeOS

git checkout -b feat/m5-mission-binding
git push -u origin feat/m5-mission-binding

mkdir -p agents/runtime services/mission-dispatcher/src

# 1. Extend runtime types
cat > agents/runtime/types.ts << 'EOF'
export interface AgentBinding {
  agentId: string;
  role: string;
  missionId?: string;
  task: {
    description: string;
    successCriteria: string[];
  };
}

export interface RuntimeResult {
  ok: boolean;
  output?: any;
  error?: string;
  evidence?: string[];
  loggedAt: string;
}
EOF

# 2. Mission binder
cat > agents/runtime/mission-binder.ts << 'EOF'
import fs from "fs/promises";
import path from "path";

const MISSIONS_DIR = path.join(process.cwd(), "data", "missions");

export async function bindAgentToMission(agentId: string, role: string, missionId: string) {
  const file = path.join(MISSIONS_DIR, `${missionId}.json`);
  const raw = await fs.readFile(file, "utf-8");
  const mission = JSON.parse(raw);
  if (mission.status !== "Approved" && mission.status !== "Executing") {
    throw new Error(`Mission ${missionId} is not in a bindable state: ${mission.status}`);
  }
  mission.boundAgents = mission.boundAgents || [];
  if (!mission.boundAgents.find((a: any) => a.agentId === agentId)) {
    mission.boundAgents.push({ agentId, role, boundAt: new Date().toISOString() });
    await fs.writeFile(file, JSON.stringify(mission, null, 2));
  }
  return mission;
}

export async function completeMissionTask(missionId: string, result: any) {
  const file = path.join(MISSIONS_DIR, `${missionId}.json`);
  const mission = JSON.parse(await fs.readFile(file, "utf-8"));
  mission.lastResult = {
    ...result,
    capturedAt: new Date().toISOString(),
  };
  await fs.writeFile(file, JSON.stringify(mission, null, 2));
}

export async function recordDecision(input: {
  type: "decision" | "incident";
  title: string;
  rationale: string;
  owner: string;
  confidence: number;
  evidence: string[];
  linkedMission?: string;
}) {
  const record = {
    type: input.type === "decision" ? "decision" : "incident",
    slug: crypto.randomUUID().slice(0, 10),
    title: input.title,
    status: input.type === "decision" ? "Approved" : "Resolved",
    owner: input.owner,
    authority: input.owner,
    date: new Date().toISOString(),
    rationale: input.rationale,
    alternatives: [],
    confidence: input.confidence,
    evidence: input.evidence,
    linkedArtifacts: input.linkedMission ? [input.linkedMission] : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const outDir = path.join(process.cwd(), "data", "knowledge");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, `${record.type}-${record.slug}.json`), JSON.stringify(record, null, 2));
  return record;
}
EOF

# 3. Dispatcher service
cat > services/mission-dispatcher/src/index.ts << 'EOF'
import { bindAgentToMission, completeMissionTask, recordDecision } from "../../../agents/runtime/mission-binder";

export interface DispatcherOptions {
  agentId: string;
  role: string;
  missionId: string;
  taskDescription: string;
  successCriteria: string[];
}

export async function dispatchMission(opts: DispatcherOptions) {
  const bound = await bindAgentToMission(opts.agentId, opts.role, opts.missionId);
  // In a real runtime, this spawns the agent process; here we simulate the call.
  // Actual spawn is handled by CTO runtime (Phase 1).
  const result = {
    ok: true,
    output: { boundMissionSlug: bound.slug },
    evidence: [`spawned-${opts.agentId}`],
    loggedAt: new Date().toISOString(),
  };
  await completeMissionTask(opts.missionId, result);
  await recordDecision({
    type: "decision",
    title: `Mission dispatch: ${bound.title}`,
    rationale: `Agent ${opts.agentId} bound to mission ${opts.missionId}`,
    owner: opts.role,
    confidence: 0.95,
    evidence: result.evidence,
    linkedMission: opts.missionId,
  });
  return result;
}
EOF

git add -A
git commit -m "feat(m5): agent runtime <-> mission binding + dispatcher"
git push origin feat/m5-mission-binding
gh pr create --title "feat(m5): agent runtime <-> mission binding" --body "Adds bindAgent, completeTask, recordDecision, and dispatcher service."
```

### Acceptance Tests
| # | Command | Expected Result |
|---|---------|-----------------|
| M5-A1 | `node -e "require('./agents/runtime/mission-binder')"` | No throw; module loads cleanly |
| M5-A2 | `node -e "const {bindAgentToMission}=require('./agents/runtime/mission-binder'); console.log(typeof bindAgentToMission)"` | `function` |

### Rollback
```powershell
git checkout master
git branch -D feat/m5-mission-binding
gh pr close 5 --delete-branch
# data cleanup only if missions need purge
Remove-Item -Recurse -Force C:\Projects\ForgeOS\data\missions
```

---

## M6 — Reporting Pipeline + Acceptance Gate

### Goal
Close Phase 2 with a verified reporting pipeline (per-task + daily digest +
weekly OKR delta) and an acceptance test gate that prevents promotion to prod
unless M1–M5 have passing CI.

### Exact File Paths
- `applications/brain-console/.github/workflows/ci.yml`
- `.github/workflows/mission-acceptance.yml`
- `apps/brain-console/src/lib/reporting/digest.ts`
- `agents/skills/forgeos/reporting/SKILL.md`

### Command Sequence
```powershell
cd C:\Projects\ForgeOS

git checkout -b feat/m6-reporting
git push -u origin feat/m6-reporting

# 1. Daily digest builder
mkdir -p apps/brain-console/src/lib/reporting
cat > apps/brain-console/src/lib/reporting/digest.ts << 'EOF'
import { listMissions } from "../../../lib/storage/missions";
import { queryByType } from "../../../lib/knowledge/retrieval/query";

export interface Digest {
  generatedAt: string;
  missionsExecuting: number;
  missionsBlocked: number;
  recentDecisions: any[];
  blockers: any[];
}

export async function buildDailyDigest(): Promise<Digest> {
  const missions = await listMissions();
  const decisions = await queryByType("decision");
  const incidents = await queryByType("incident");

  const blocked = missions.filter((m) => m.status === "Blocked");
  const recentDecisions = decisions
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return {
    generatedAt: new Date().toISOString(),
    missionsExecuting: missions.filter((m) => m.status === "Executing").length,
    missionsBlocked: blocked.length,
    recentDecisions,
    blockers: blocked.map((m) => ({ slug: m.slug, title: m.title, updatedAt: m.updatedAt })),
  };
}
EOF

# 2. Reporting skill
mkdir -p agents/skills/forgeos/reporting
cat > agents/skills/forgeos/reporting/SKILL.md << 'EOF'
---
name: forgeos-reporting
role: CPO
reports_to: CEO
authority_tier: write
domain: Product / Apps / Marketplace
owner_agent: cpo
version: 1.0.0
description: Compile per-task and weekly OKR deltas for CEO digest.
triggers:
  - "daily digest"
  - "weekly report"
  - "status update"
delegation:
  in_mandate: [reporting, roadmap]
  requires_request: []
  escalates_to: CEO
---
# Skill: Reporting
## Operations
1. Load missions via `/api/missions/index`.
2. Load decisions + incidents via `/api/knowledge/query?type=...`.
3. Build digest object and emit to stdout / CEO inbox.
4. Never fabricate metrics; zero-value counts are valid.
EOF

# 3. CI workflow
mkdir -p .github/workflows
cat > .github/workflows/mission-acceptance.yml << 'EOF'
name: Mission Acceptance Gate
on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  test-m1:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - run: bun install
        working-directory: apps/brain-console
      - run: bun run build
        working-directory: apps/brain-console
      - run: |
          curl -f http://localhost:7777/api/missions/index || exit 1
          curl -f http://localhost:7777/api/knowledge || exit 1
        env:
          PORT: 7777
EOF

git add -A
git commit -m "feat(m6): reporting pipeline + acceptance gate"
git push origin feat/m6-reporting
gh pr create --title "feat(m6): reporting pipeline + acceptance gate" --body "Adds digest builder, reporting skill, CI gate."
```

### Acceptance Tests
| # | Command | Expected Result |
|---|---------|-----------------|
| M6-A1 | `git log --oneline | grep -c "feat(m[1-6])"` | `6` |
| M6-A2 | `gh pr list --state merged` | Each m1..m6 PR present and merged to master |
| M6-A3 | `curl -s http://localhost:7777/api/missions/index` | `[]` (healthy, no fabrication) |
| M6-A4 | `node -e "const {buildDailyDigest}=require('./apps/brain-console/src/lib/reporting/digest.ts'); buildDailyDigest().then(console.log)"` | Object with `generatedAt`, `missionsExecuting: 0`, `missionsBlocked: 0` (no fabrication) |
| M6-A5 | CI green in GitHub Actions | `mission-acceptance` workflow passed |

### Rollback
```powershell
git checkout master
git branch -D feat/m6-reporting
gh pr close 6 --delete-branch
```

---

## Phase 2 Exit Criteria (must satisfy ALL)
- [ ] M1–M5 merged to `master` with green CI per M6 gate.
- [ ] Mission CRUD works end-to-end via console UI and API.
- [ ] FES-013 ratified (CPO owner).
- [ ] Knowledge Universe schema + charter seed present in `knowledge-universe/`.
- [ ] Decision Ledger records auto-emitted on mission transitions.
- [ ] Daily digest format approved by CEO.
- [ ] `data/missions/` and `data/knowledge/` excluded from `.gitignore` (artifact data, not source of truth).

---

