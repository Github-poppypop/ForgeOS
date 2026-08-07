/**
 * agents/reporting.ts — Agent → Owner → CEO reporting pipeline.
 *
 * Provides:
 *  1. A typed Report model
 *  2. A compileReport() helper that builds a report envelope for a given
 *     agent role, forwarding to the owner chain.
 *  3. A simple in-memory store so callers can retrieve last-known state
 *     without hitting a DB.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentRole = "ceo" | "cto" | "cpo" | "coo" | "cmo" | "cfo" | "board";

export interface AgentProfile {
  id: AgentRole;
  role: string;
  reportsTo: string;
  ownerDomain: string;
  version: string;
}

export type ReportStatus = "green" | "yellow" | "red";

export interface AgentReport {
  id: string;
  agentId: AgentRole;
  agentRole: string;
  ownerChain: string[];       // [..., "CEO", "Board"]
  status: ReportStatus;
  summary: string;
  metrics: Record<string, string | number | boolean>;
  risks: string[];
  timestamp: number;
  /** Parent report id if this was escalated from a sub-agent */
  parentReportId?: string;
}

// ---------------------------------------------------------------------------
// Profile helpers
// ---------------------------------------------------------------------------

const REPORTS_TO: Record<AgentRole, string> = {
  ceo: "board",
  cto: "ceo",
  cpo: "ceo",
  coo: "ceo",
  cmo: "ceo",
  cfo: "ceo",
  board: "charter",
};

const ROLE_NAME: Record<AgentRole, string> = {
  ceo: "CEO",
  cto: "CTO",
  cpo: "CPO",
  coo: "COO",
  cmo: "CMO",
  cfo: "CFO",
  board: "Board",
};

/**
 * Build the full reporting chain for an agent, from the agent up to the CEO
 * (and beyond if reporting to Board). Returns e.g. ["CTO", "CEO", "Board"].
 */
export function buildOwnerChain(agentId: AgentRole): string[] {
  const chain: string[] = [ROLE_NAME[agentId]];
  let cursor: string = REPORTS_TO[agentId] ?? "ceo";
  const seen = new Set<string>();
  while (cursor && cursor !== "charter" && !seen.has(cursor)) {
    seen.add(cursor);
    const normalized = cursor.toLowerCase() as AgentRole;
    chain.push(ROLE_NAME[normalized] ?? cursor);
    cursor = REPORTS_TO[normalized] ?? cursor;
  }
  if (cursor === "charter") {
    chain.push("Board");
  }
  return chain;
}

// ---------------------------------------------------------------------------
// In-memory report store
// ---------------------------------------------------------------------------

interface StoredReport extends AgentReport {
  createdAt: number;
}

class ReportStore {
  private reports = new Map<string, StoredReport>();

  put(report: AgentReport) {
    this.reports.set(report.id, { ...report, createdAt: Date.now() });
  }

  get(id: string) {
    return this.reports.get(id);
  }

  byAgent(agentId: AgentRole) {
    return Array.from(this.reports.values()).filter((r) => r.agentId === agentId);
  }

  chain(reportId: string): StoredReport[] {
    const chain: StoredReport[] = [];
    let cur = this.reports.get(reportId);
    while (cur) {
      chain.push(cur);
      cur = cur.parentReportId ? this.reports.get(cur.parentReportId) : undefined;
    }
    return chain;
  }

  all() {
    return Array.from(this.reports.values());
  }
}

export const reports = new ReportStore();

// ---------------------------------------------------------------------------
// Report compilation
// ---------------------------------------------------------------------------

let _counter = 0;

/**
 * Compile an AgentReport for the given agent. The report is forwarded up the
 * owner chain automatically (each owner gets a summarized view).
 */
export function compileReport(opts: {
  agentId: AgentRole;
  summary: string;
  status?: ReportStatus;
  metrics?: Record<string, string | number | boolean>;
  risks?: string[];
  parentReportId?: string;
}): AgentReport {
  const id = `rpt-${opts.agentId}-${Date.now()}-${++_counter}`;
  const report: AgentReport = {
    id,
    agentId: opts.agentId,
    agentRole: ROLE_NAME[opts.agentId],
    ownerChain: buildOwnerChain(opts.agentId),
    status: opts.status ?? "green",
    summary: opts.summary,
    metrics: opts.metrics ?? {},
    risks: opts.risks ?? [],
    timestamp: Date.now(),
    parentReportId: opts.parentReportId,
  };
  reports.put(report);
  return report;
}

/**
 * Convenience: fetch the latest report for a given agent role.
 */
export function latestForAgent(agentId: AgentRole): AgentReport | undefined {
  const all = reports.byAgent(agentId);
  if (!all.length) return undefined;
  return all.sort((a, b) => b.timestamp - a.timestamp)[0];
}

/**
 * Convenience: fetch the latest report submitted to the CEO (or Board).
 */
export function latestForCEO(): AgentReport | undefined {
  const all = reports.all();
  const ceoReports = all.filter(
    (r) => r.ownerChain.includes("CEO") || r.ownerChain.includes("Board")
  );
  if (!ceoReports.length) return undefined;
  return ceoReports.sort((a, b) => b.timestamp - a.timestamp)[0];
}
