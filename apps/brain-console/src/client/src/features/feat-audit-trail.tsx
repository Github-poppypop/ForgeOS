// Client feature: Page-Mutation Audit viewer (backlog #38).
// Renders a chronological audit trail of knowledge-universe page mutations
// (create / update / delete / rename / move) sourced from a localStorage log so
// it works offline (mock-first). A server-backed persistence layer can replace
// the localStorage source later without changing this UI.
// Conflict-free: auto-discovered by features/registry.ts (import.meta.glob); no
// edits to App.tsx or server.ts. Automatic JSX runtime — do NOT import React.
import { useEffect, useMemo, useState } from "react";

type Action = "create" | "update" | "delete" | "rename" | "move";
type Status = "applied" | "rolled-back";

interface AuditEntry {
  id: string;
  ts: number;
  page: string;
  action: Action;
  actor: string;
  role: string;
  source: string;
  status: Status;
}

const STORAGE_KEY = "forgeos_page_audit";

const SAMPLE: Omit<AuditEntry, "ts">[] = [
  { id: "a1", page: "charter", action: "create", actor: "drew", role: "CEO", source: "capture", status: "applied" },
  { id: "a2", page: "org-charter", action: "update", actor: "drew", role: "CEO", source: "sync", status: "applied" },
  { id: "a3", page: "roadmap-v2", action: "rename", actor: "wei", role: "CTO", source: "manual", status: "applied" },
  { id: "a4", page: "deprecated-policy", action: "delete", actor: "system", role: "Agent", source: "api", status: "applied" },
  { id: "a5", page: "mission-2026", action: "move", actor: "wei", role: "CTO", source: "manual", status: "rolled-back" },
  { id: "a6", page: "vision", action: "update", actor: "drew", role: "CEO", source: "capture", status: "applied" },
];

function seed(): AuditEntry[] {
  const now = Date.now();
  return SAMPLE.map((s, i) => ({ ...s, ts: now - (i + 1) * 3600_000 }));
}

function load(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

function save(entries: AuditEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable — keep in-memory only */
  }
}

function fmt(ts: number): string {
  return new Date(ts).toLocaleString();
}

function actionTag(a: Action): string {
  if (a === "create") return "tag done";
  if (a === "delete") return "tag bad";
  if (a === "rename") return "tag info";
  if (a === "move") return "tag warn";
  return "tag";
}

function statusTag(s: Status): string {
  return s === "applied" ? "tag done" : "tag warn";
}

const ACTIONS: Action[] = ["create", "update", "delete", "rename", "move"];

export default {
  path: "/feature/audit-trail",
  label: "Page Mutation Audit",
  category: "Observability",
  component: function PageMutationAuditFeature() {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [filter, setFilter] = useState<string>("all");
    const [search, setSearch] = useState<string>("");
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
      let data = load();
      if (data.length === 0) {
        data = seed();
        save(data);
      }
      data = [...data].sort((a, b) => b.ts - a.ts);
      setEntries(data);
      setLoaded(true);
    }, []);

    const counts = useMemo(() => {
      const c: Record<string, number> = { all: entries.length };
      for (const e of entries) c[e.action] = (c[e.action] ?? 0) + 1;
      return c;
    }, [entries]);

    const filtered = useMemo(() => {
      const f = filter === "all" ? null : filter;
      const q = search.trim().toLowerCase();
      return entries.filter((e) => {
        if (f && e.action !== f) return false;
        if (q && !e.page.toLowerCase().includes(q) && !e.actor.toLowerCase().includes(q)) return false;
        return true;
      });
    }, [entries, filter, search]);

    function reseed() {
      const data = [...seed()].sort((a, b) => b.ts - a.ts);
      setEntries(data);
      save(data);
    }
    function clearAll() {
      setEntries([]);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }

    return (
      <div className="panel">
        <h2 className="section-header">Page Mutation Audit</h2>
        <p className="subtitle">
          Chronological audit trail of knowledge-universe page mutations (create / update /
          delete / rename / move). Mock-first: sourced from local storage so it works offline; a
          server-backed persistence layer can replace the source without changing this UI.
        </p>

        <div className="row gap-2 mt-2 wrap items-center">
          <label className="muted" htmlFor="at-filter">
            Action
          </label>
          <select
            id="at-filter"
            className="input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All ({counts.all ?? 0})</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a} ({counts[a] ?? 0})
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Search page or actor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn primary sm" onClick={reseed}>
            Seed sample
          </button>
          <button className="btn sm" onClick={clearAll}>
            Clear
          </button>
        </div>

        {loaded ? (
          filtered.length === 0 ? (
            <div className="card mt-3">
              <p className="muted">No page-mutation audit entries match.</p>
            </div>
          ) : (
            <div className="table-wrap mt-3">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Page</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Role</th>
                    <th>Source</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td className="muted">{fmt(e.ts)}</td>
                      <td>
                        <code>{e.page}</code>
                      </td>
                      <td>
                        <span className={actionTag(e.action)}>{e.action}</span>
                      </td>
                      <td>{e.actor}</td>
                      <td className="muted">{e.role}</td>
                      <td className="muted">{e.source}</td>
                      <td>
                        <span className={statusTag(e.status)}>{e.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <p className="muted mt-3">Loading…</p>
        )}
      </div>
    );
  },
};
