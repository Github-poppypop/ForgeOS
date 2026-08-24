// Client feature: Knowledge Graph viewer (backlog #40).
// Fetches /api/knowledge-graph (derived from the knowledge-universe on-disk state)
// and renders a radial SVG graph + stats + an edge table.
// Conflict-free: auto-discovered by features/registry.ts (import.meta.glob); no edits
// to App.tsx or server.ts. Note: automatic JSX runtime — do NOT import React; import
// hooks directly.
import { useEffect, useState } from "react";

type NodeType = "page" | "user" | "role" | "root";

interface ApiNode {
  id: string;
  type: NodeType;
  label: string;
  meta?: { views?: number } & Record<string, unknown>;
}

interface ApiEdge {
  source: string;
  target: string;
  label: string;
  kind: "mutation" | "access";
}

interface ApiGraph {
  ok: boolean;
  source: string;
  generated_at: string;
  stats: { pages: number; users: number; roles: number; edges: number };
  nodes: ApiNode[];
  edges: ApiEdge[];
  error?: string;
}

const W = 640;
const H = 440;
const CX = W / 2;
const CY = H / 2;
const R = 170;

function nodeClass(type: NodeType): string {
  if (type === "user") return "node root";
  if (type === "role") return "node leaf";
  return "node";
}

function labelFor(type: NodeType): string {
  if (type === "page") return "Page";
  if (type === "user") return "User";
  if (type === "role") return "Role";
  return "Root";
}

export default {
  path: "/feature/knowledge-graph",
  label: "Knowledge Graph",
  category: "Features",
  component: function KnowledgeGraphFeature() {
    const [graph, setGraph] = useState<ApiGraph | null>(null);
    const [msg, setMsg] = useState("");

    async function refresh(): Promise<void> {
      setMsg("");
      try {
        const r = await fetch("/api/knowledge-graph");
        const d = (await r.json()) as ApiGraph;
        if (!r.ok || !d.ok) {
          setMsg("Error: " + (d.error ?? String(r.status)));
          return;
        }
        setGraph(d);
      } catch {
        setMsg("Failed to load knowledge graph");
      }
    }

    useEffect(() => {
      void refresh();
    }, []);

    const positioned = (graph?.nodes ?? []).map((n, i) => {
      const denom = Math.max(1, graph?.nodes?.length ?? 1);
      const a = (i / denom) * Math.PI * 2 - Math.PI / 2;
      return {
        ...n,
        x: CX + Math.cos(a) * R,
        y: CY + Math.sin(a) * R,
      };
    });

    const posById = new Map(positioned.map((p) => [p.id, p]));

    return (
      <div className="panel">
        <h2 className="section-header">Knowledge Graph</h2>
        <p className="subtitle">
          Entity relationships derived from the knowledge-universe on-disk state
          (audit log, ACLs, analytics).
        </p>

        <div className="row gap-2 mt-2 wrap items-center">
          <button className="btn primary" onClick={() => void refresh()}>
            Refresh
          </button>
          {graph ? (
            <span className="muted">
              source: {graph.source} · generated {graph.generated_at}
            </span>
          ) : null}
          {msg ? <span className="muted">{msg}</span> : null}
        </div>

        {graph ? (
          <>
            <div className="card mt-3">
              <div className="section-header">
                <h3>Graph stats</h3>
              </div>
              <div className="stats cols-4 dashboard-stats mt-2">
                <div className="stat">
                  <div className="h3">Pages</div>
                  <div className="value">{graph.stats.pages}</div>
                  <div className="caption">entities</div>
                </div>
                <div className="stat">
                  <div className="h3">Users</div>
                  <div className="value">{graph.stats.users}</div>
                  <div className="caption">editors</div>
                </div>
                <div className="stat">
                  <div className="h3">Roles</div>
                  <div className="value">{graph.stats.roles}</div>
                  <div className="caption">ACL roles</div>
                </div>
                <div className="stat">
                  <div className="h3">Edges</div>
                  <div className="value">{graph.stats.edges}</div>
                  <div className="caption">relationships</div>
                </div>
              </div>
            </div>

            <div className="card mt-3">
              <div className="section-header">
                <h3>Graph</h3>
                <span className="subtitle">pages · users · roles</span>
              </div>
              {graph.nodes.length === 0 ? (
                <p className="muted mt-2">No graph data available.</p>
              ) : (
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  preserveAspectRatio="xMidYMid meet"
                  style={{
                    width: "100%",
                    height: "auto",
                    background: "var(--surface-2)",
                    borderRadius: "var(--radius)",
                    marginTop: "8px",
                  }}
                  role="img"
                  aria-label="Knowledge graph visualization"
                >
                  {graph.edges.map((e, i) => {
                    const s = posById.get(e.source);
                    const t = posById.get(e.target);
                    if (!s || !t) return null;
                    return (
                      <line
                        key={"e" + i}
                        className="edge"
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                      />
                    );
                  })}
                  {positioned.map((n) => (
                    <g key={n.id}>
                      <circle
                        className={nodeClass(n.type)}
                        cx={n.x}
                        cy={n.y}
                        r={n.type === "page" ? 9 : 7}
                      />
                      <text
                        className="node-label"
                        x={n.x}
                        y={n.y - 14}
                        textAnchor="middle"
                      >
                        {n.label}
                      </text>
                    </g>
                  ))}
                </svg>
              )}
              <div className="row gap-3 mt-2 wrap items-center muted">
                <span>
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: "var(--surface-3)",
                      border: "1.5px solid var(--primary)",
                      marginRight: 6,
                    }}
                  />
                  {labelFor("user")}
                </span>
                <span>
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: "var(--surface-4)",
                      border: "1.5px solid var(--primary)",
                      marginRight: 6,
                    }}
                  />
                  {labelFor("role")}
                </span>
                <span>
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      marginRight: 6,
                    }}
                  />
                  {labelFor("page")}
                </span>
              </div>
            </div>

            <div className="card mt-3">
              <div className="section-header">
                <h3>Edges</h3>
                <span className="subtitle">{graph.edges.length} relationships</span>
              </div>
              <div className="table-wrap mt-2">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Relationship</th>
                      <th>Target</th>
                      <th>Kind</th>
                    </tr>
                  </thead>
                  <tbody>
                    {graph.edges.slice(0, 100).map((e, i) => (
                      <tr key={"row" + i}>
                        <td>
                          <code>{e.source}</code>
                        </td>
                        <td>{e.label}</td>
                        <td>
                          <code>{e.target}</code>
                        </td>
                        <td>
                          <span className={`tag ${e.kind === "access" ? "info" : "done"}`}>
                            {e.kind}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {graph.edges.length === 0 && (
                      <tr>
                        <td colSpan={4} className="muted">
                          No edges.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <p className="muted mt-3">Loading…</p>
        )}
      </div>
    );
  },
};
