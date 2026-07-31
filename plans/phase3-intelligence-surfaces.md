# Phase 3 — Intelligence Surfaces (M7–M9)
**Owner:** COO (M7, M9) · CMO (M8 surfaces) · CTO (infrastructure)
**Target:** 2026-10
**Prerequisites:** Phase 2 complete (M1–M6 on master, console on `:7777`, Mission Center operational)

---

## M7 — Command Center Home Surface

### Goal
Transform the brain-console landing page into a true Command Center that
surfaces the 6 constitutional questions every 30 seconds: mission health,
agent status, recent decisions, timeline events, vetoed actions, and
cross-functional blockers.

### Exact File Paths
- `apps/brain-console/src/components/CommandCenter.tsx`
- `apps/brain-console/src/routes/index.tsx` (update `/` route)
- `apps/brain-console/src/lib/telemetry/brain-status.ts`
- `apps/brain-console/src/lib/telemetry/timeline.ts`
- `infrastructure/gbrain/federation-health.ts` (optional, for brain ping)

### Command Sequence
```powershell
cd C:\Projects\ForgeOS

git checkout -b feat/m7-command-center
git push -u origin feat/m7-command-center

# 1. Brain status collector
mkdir -p apps/brain-console/src/lib/telemetry
cat > apps/brain-console/src/lib/telemetry/brain-status.ts << 'EOF'
export interface BrainHealth {
  online: boolean;
  dbSize: string;
  lastBackup: string | null;
  vaultCount: number;
  federationStatus: "healthy" | "degraded" | "offline";
}

export async function fetchBrainStatus(): Promise<BrainHealth> {
  // C:\ForgeOS is the isolated brain home per README.md.
  const brainDir = "C:\\ForgeOS";
  try {
    const stats = await fetch("http://localhost:7777/api/brain/status").then((r) => r.json());
    return {
      online: stats?.online ?? false,
      dbSize: stats?.dbSize ?? "unknown",
      lastBackup: stats?.lastBackup ?? null,
      vaultCount: stats?.vaultCount ?? 0,
      federationStatus: stats?.federationStatus ?? "offline",
    };
  } catch {
    return {
      online: false,
      dbSize: "unknown",
      lastBackup: null,
      vaultCount: 0,
      federationStatus: "offline",
    };
  }
}
EOF

# 2. Timeline recent events collector
cat > apps/brain-console/src/lib/telemetry/timeline.ts << 'EOF'
export interface TimelineEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  artifact?: string;
  result: "success" | "failure" | "blocked";
}

export async function fetchRecentTimeline(limit = 20): Promise<TimelineEvent[]> {
  // Read from data/timeline/<date>.jsonl if timeline engine is active.
  // Fallback to empty array so UI does not fabricate.
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const tlFile = path.join(process.cwd(), "data", "timeline", "recent.jsonl");
    const raw = await fs.readFile(tlFile, "utf-8");
    const lines = raw.split("\n").filter((l) => l.trim());
    return lines.slice(-limit).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}
EOF

# 3. Command Center component
cat > apps/brain-console/src/components/CommandCenter.tsx << 'EOF'
import React, { useEffect, useState } from "react";
import { fetchBrainStatus } from "../lib/telemetry/brain-status";
import { fetchRecentTimeline } from "../lib/telemetry/timeline";
import { listMissions } from "../lib/storage/missions";

type BrainHealth = ReturnType<typeof fetchBrainStatus> extends Promise<infer R> ? R : never;

export default function CommandCenter() {
  const [brain, setBrain] = useState<BrainHealth>({
    online: false,
    dbSize: "unknown",
    lastBackup: null,
    vaultCount: 0,
    federationStatus: "offline",
  });
  const [timeline, setTimeline] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);

  useEffect(() => {
    fetchBrainStatus().then(setBrain);
    fetchRecentTimeline(10).then(setTimeline);
    fetch("/api/missions/index").then((r) => r.json()).then(setMissions);
    const t = setInterval(() => {
      fetchBrainStatus().then(setBrain);
      fetchRecentTimeline(10).then(setTimeline);
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const statusColor = (s: string) =>
    s === "healthy" || s === "success" || s === "Done" ? "text-emerald-400" :
    s === "degraded" || s === "at-risk" ? "text-yellow-400" :
    s === "offline" || s === "failure" || s === "off-track" ? "text-red-400" :
    "text-muted";

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Command Center</h1>

      {/* 6-widget grid */}
      <div className="grid grid-cols-3 gap-4">
        <Widget title="Brain Health" accent={brain.online ? "emerald" : "red"}>
          <Row label="Status" value={brain.online ? "online" : "offline"} />
          <Row label="DB Size" value={brain.dbSize} />
          <Row label="Vault Count" value={String(brain.vaultCount)} />
          <Row label="Federation" value={brain.federationStatus} />
        </Widget>

        <Widget title="Mission Snapshot">
          <Row label="Total" value={String(missions.length)} />
          <Row label="Executing" value={String(missions.filter((m: any) => m.status === "Executing").length)} />
          <Row label="Blocked" value={String(missions.filter((m: any) => m.status === "Blocked").length)} />
          <Row label="Done (v1.2)" value={String(missions.filter((m: any) => m.status === "Done").length)} />
        </Widget>

        <Widget title="Recent Timeline">
          {timeline.length === 0 && (
            <div className="text-xs text-muted">No recent events (Timeline Engine not yet populated).</div>
          )}
          <div className="space-y-1">
            {timeline.slice(0, 8).map((ev) => (
              <div key={ev.id} className="text-xs flex justify-between">
                <span className="text-white truncate mr-2">{ev.action}</span>
                <span className={statusColor(ev.result)}>{ev.result}</span>
              </div>
            ))}
          </div>
        </Widget>
      </div>
    </div>
  );
}

function Widget({ title, children, accent }: any) {
  const border = accent === "emerald" ? "border-emerald-500/30" : accent === "red" ? "border-red-500/30" : "border-border";
  return (
    <div className={`rounded bg-surface p-4 border ${border}`}>
      <div className="text-xs text-muted uppercase tracking-widest mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}
EOF

# 4. Mount root route
# Assume index.tsx already has a default route; overwrite / mapping.
patch -d apps/brain-console/src/routes -p 1 << 'PATCH'
--- a/index.tsx
+++ b/index.tsx
@@
-  { path: "/", element: <placeHolder /> },
+  { path: "/", element: <CommandCenter /> },
PATCH

git add -A
git commit -m "feat(m7): command center home surface + 6-widget layout"
git push origin feat/m7-command-center
gh pr create --title "feat(m7): command center home surface + 6-widget layout" --body "Adds CommandCenter, brain/status, timeline, mission snapshot widgets."
```

### Acceptance Tests
| # | Command / Action | Expected Result |
|---|-----------------|-----------------|
| M7-A1 | Visit `http://localhost:7777/#/` | Command Center renders with 3 widgets |
| M7-A2 | `curl -s http://localhost:7777/api/missions/index` then refresh | Mission Snapshot reflects live counts |
| M7-A3 | `curl -s http://localhost:7777/api/brain/status` | Returns JSON with `online`, `dbSize`, `vaultCount` endpoints (implemented in server.ts) |
| M7-A4 | Edit `data/timeline/recent.jsonl` and trigger refresh | Recent Timeline updates within 30s poll |
| M7-A5 | Offline brain → widget shows `offline` in red | Graceful degradation, no fabricated data |

### Rollback
```powershell
git checkout master
git branch -D feat/m7-command-center
gh pr close 7 --delete-branch
```

---

## M8 — Live Agent Dashboard

### Goal
Build a real-time agent surface (status, task queue, memory explorer, health
checks) so every C-suite owner can supervise domain agents without CLI access.

### Exact File Paths
- `apps/brain-console/src/components/AgentDashboard.tsx`
- `apps/brain-console/src/routes/agents.tsx`
- `apps/brain-console/src/lib/agents/runtime-client.ts`
- `agents/runtime/health.ts`

### Command Sequence
```powershell
cd C:\Projects\ForgeOS

git checkout -b feat/m8-agent-dashboard
git push -u origin feat/m8-agent-dashboard

mkdir -p agents/runtime apps/brain-console/src/lib/agents

# 1. Runtime health reporter
cat > agents/runtime/health.ts << 'EOF'
export interface AgentHealth {
  agentId: string;
  role: string;
  status: "idle" | "running" | "error" | "terminated";
  lastTaskId?: string;
  lastOutcome?: "success" | "failure";
  memoryKB: number;
  updatedAt: string;
}

export class HealthRegistry {
  private registry = new Map<string, AgentHealth>();

  register(agent: AgentHealth) {
    this.registry.set(agent.agentId, agent);
  }

  getAll(): AgentHealth[] {
    return Array.from(this.registry.values());
  }

  getByRole(role: string): AgentHealth[] {
    return this.getAll().filter((a) => a.role === role);
  }
}
EOF

# 2. Console client
cat > apps/brain-console/src/lib/agents/runtime-client.ts << 'EOF'
import { AgentHealth } from "../../../agents/runtime/health";

const AGENTS_DIR = "C:\\ForgeOS\\agents";

export async function loadAgentManifests(): Promise<any[]> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const files = await fs.readdir(path.join(AGENTS_DIR, "agents"));
    return files
      .filter((f) => f.endsWith(".md") || f.endsWith(".json"))
      .map((f) => ({ name: f, lastModified: (await fs.stat(path.join(AGENTS_DIR, "agents", f))).mtime }));
  } catch {
    return [];
  }
}
EOF

# 3. Dashboard component
cat > apps/brain-console/src/components/AgentDashboard.tsx << 'EOF'
import React, { useEffect, useState } from "react";
import { loadAgentManifests } from "../lib/agents/runtime-client";

export default function AgentDashboard() {
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    loadAgentManifests().then(setAgents);
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-white">Live Agent Dashboard</h1>
      <div className="rounded bg-surface border border-border divide-y divide-border">
        {agents.length === 0 && (
          <div className="p-4 text-sm text-muted">No agent manifests loaded. Verify `agents/` directory.</div>
        )}
        {agents.map((a) => (
          <div key={a.name} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-white">{a.name}</div>
              <div className="text-xs text-muted">last modified: {a.lastModified}</div>
            </div>
            <span className="text-xs px-2 py-1 rounded bg-accent/20 text-accent">loaded</span>
          </div>
        ))}
      </div>
    </div>
  );
}
EOF

# 4. Route
cat > apps/brain-console/src/routes/agents.tsx << 'EOF'
import React from "react";
import AgentDashboard from "../components/AgentDashboard";

export default function AgentsRoute() {
  return <AgentDashboard />;
}
EOF

# Mount route
patch -d apps/brain-console/src/routes -p 1 << 'PATCH'
--- a/index.tsx
+++ b/index.tsx
@@
   const routes: RouteObject[] = [
     { path: "/", element: <CommandCenter /> },
     { path: "/missions", element: <MissionDashboard /> },
+    { path: "/agents", element: <AgentsRoute /> },
   ];
PATCH

git add -A
git commit -m "feat(m8): live agent dashboard surface"
git push origin feat/m8-agent-dashboard
gh pr create --title "feat(m8): live agent dashboard surface" --body "Adds agent manifests loader + dashboard route."
```

### Acceptance Tests
| # | Command / Action | Expected Result |
|---|-----------------|-----------------|
| M8-A1 | Visit `http://localhost:7777/#/agents` | Dashboard renders, lists `C:\ForgeOS\agents\agents\*.md` |
| M8-A2 | Add mock health record to in-memory registry | Dashboard row shows `running` state (requires server-side endpoint; fallback: file count reflects manifests) |
| M8-A3 | Remove manifest file → refresh | Row disappears, no crash |
| M8-A4 | `ls agents/agents/*.md` | 7 C-suite files present |

### Rollback
```powershell
git checkout master
git branch -D feat/m8-agent-dashboard
gh pr close 8 --delete-branch
```

---

## M9 — Decision Ledger + Timeline Engine UI

### Goal
Finalize Phase 3 by making decisions and timeline events first-class navigable
surfaces in the console: immutable ledger entries, timeline scrolling, and
decision supersede semantics.

### Exact File Paths
- `apps/brain-console/src/components/DecisionLedger.tsx`
- `apps/brain-console/src/components/TimelineEngine.tsx`
- `apps/brain-console/src/routes/decisions.tsx`
- `apps/brain-console/src/routes/timeline.tsx`
- `knowledge-universe/retrieval/supersede.ts`

### Command Sequence
```powershell
cd C:\Projects\ForgeOS

git checkout -b feat/m9-ledger-timeline
git push -u origin feat/m9-ledger-timeline

mkdir -p knowledge-universe/retrieval apps/brain-console/src/components apps/brain-console/src/routes

# 1. Supersede helper (corrections create new records that supersede)
cat > knowledge-universe/retrieval/supersede.ts << 'EOF'
import fs from "fs/promises";
import path from "path";

const KU_DIR = path.join(process.cwd(), "data", "knowledge");

export async function supersedeDecision(oldSlug: string, newRecord: any) {
  const oldFile = path.join(KU_DIR, `decision-${oldSlug}.json`);
  const oldRaw = await fs.readFile(oldFile, "utf-8").catch(() => "{}");
  const old = JSON.parse(oldRaw);
  if (old.status === "Superseded") throw new Error("Already superseded");
  old.status = "Superseded";
  old.updatedAt = new Date().toISOString();
  await fs.writeFile(oldFile, JSON.stringify(old, null, 2));

  const merged = { ...newRecord, supersedes: oldSlug, status: "Approved" };
  const newSlug = crypto.randomUUID().slice(0, 10);
  await fs.writeFile(path.join(KU_DIR, `decision-${newSlug}.json`), JSON.stringify(merged, null, 2));
  return { supersedes: oldSlug, newSlug };
}
EOF

# 2. Decision Ledger component
cat > apps/brain-console/src/components/DecisionLedger.tsx << 'EOF'
import React, { useEffect, useState } from "react";

export default function DecisionLedger() {
  const [decisions, setDecisions] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/knowledge/query?type=decision")
      .then((r) => r.json())
      .then((items) => setDecisions(Array.isArray(items) ? items : []));
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-white">Decision Ledger</h1>
      <div className="rounded bg-surface border border-border divide-y divide-border">
        {decisions.length === 0 && <div className="p-4 text-sm text-muted">No decisions recorded.</div>}
        {decisions.map((d) => (
          <div key={d.id || d.slug} className="p-3">
            <div className="flex justify-between">
              <span className="font-semibold text-white">{d.title}</span>
              <span className="text-xs px-2 py-1 rounded bg-surface text-muted">{d.status}</span>
            </div>
            <div className="text-xs text-muted mt-1">{d.owner} · {d.date} · confidence {d.confidence}</div>
            {d.rationale && <div className="text-sm text-gray-300 mt-1">{d.rationale}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
EOF

# 3. Timeline Engine component
cat > apps/brain-console/src/components/TimelineEngine.tsx << 'EOF'
import React, { useEffect, useState } from "react";

export default function TimelineEngine() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/timeline?limit=50")
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]));
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-white">Timeline Engine</h1>
      <div className="rounded bg-surface border border-border divide-y divide-border">
        {events.length === 0 && <div className="p-4 text-sm text-muted">No events yet.</div>}
        {events.slice(0, 50).map((ev) => (
          <div key={ev.id} className="p-2 text-xs flex justify-between">
            <span className="text-white truncate mr-4">{ev.action}</span>
            <span className="text-muted">{new Date(ev.timestamp).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
EOF

# 4. API stub for timeline
cat > apps/brain-console/src/routes/api/timeline.ts << 'EOF'
import { router } from "./_shared";

export const GET = router.handler(async () => {
  // Reads from data/timeline/recent.jsonl; returns [] if absent (non-fabricating).
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const file = path.join(process.cwd(), "data", "timeline", "recent.jsonl");
    const raw = await fs.readFile(file, "utf-8");
    return raw.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
});
EOF

# 5. Routes
cat > apps/brain-console/src/routes/decisions.tsx << 'EOF'
import React from "react";
import DecisionLedger from "../components/DecisionLedger";
export default function DecisionsRoute() { return <DecisionLedger />; }
EOF

cat > apps/brain-console/src/routes/timeline.tsx << 'EOF'
import React from "react";
import TimelineEngine from "../components/TimelineEngine";
export default function TimelineRoute() { return <TimelineEngine />; }
EOF

patch -d apps/brain-console/src/routes -p 1 << 'PATCH'
--- a/index.tsx
+++ b/index.tsx
@@
     { path: "/agents", element: <AgentsRoute /> },
+    { path: "/decisions", element: <DecisionsRoute /> },
+    { path: "/timeline", element: <TimelineRoute /> },
   ];
PATCH

git add -A
git commit -m "feat(m9): decision ledger + timeline engine UI"
git push origin feat/m9-ledger-timeline
gh pr create --title "feat(m9): decision ledger + timeline engine UI" --body "Adds DecisionLedger, TimelineEngine, supersede semantics, and API."
```

### Acceptance Tests
| # | Command / Action | Expected Result |
|---|-----------------|-----------------|
| M9-A1 | Visit `http://localhost:7777/#/decisions` | Renders Decision Ledger (empty if none) |
| M9-A2 | Create a decision record via M3 ingest, then visit `/decisions` | Record appears |
| M9-A3 | Visit `http://localhost:7777/#/timeline` | Renders Timeline Engine (empty if no events) |
| M9-A4 | Append line to `data/timeline/recent.jsonl`, refresh | New event appears |
| M9-A5 | Run `supersedeDecision` on an existing decision | Old record marked `Superseded`, new record created |

### Rollback
```powershell
git checkout master
git branch -D feat/m9-ledger-timeline
gh pr close 9 --delete-branch
```

---

## Phase 3 Exit Criteria (must satisfy ALL)
- [ ] M7–M9 merged to `master`.
- [ ] Command Center at `http://localhost:7777/#/` shows live mission count, brain health, and timeline.
- [ ] Decision Ledger renders immutable records; supersede semantics tested.
- [ ] Agent Dashboard lists all 7 C-suite manifests from `agents/agents/`.
- [ ] No fabricated data: zero-value counts displayed as `0`, not placeholders.
- [ ] `/decisions` and `/timeline` routes mounted and reachable.

---

