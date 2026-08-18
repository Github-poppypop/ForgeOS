/**
 * ForgeOS Shared Types — governance, roles, and decisions.
 *
 * These types are consumed by `agents/`, `knowledge-universe/`,
 * `scripts/`, and any ForgeOS app that needs to understand the org
 * charter programmatically.
 */

/* ─────────────────────────────────────────────
 * Authority & Scope
 * ───────────────────────────────────────────── */

export type AuthorityTier = 'read' | 'write' | 'admin';

export type CsuiteRole =
  | 'Board'
  | 'CEO'
  | 'CTO'
  | 'CPO'
  | 'COO'
  | 'CMO'
  | 'CFO';

export type Domain = string; // e.g. "Technology / Platform / Infrastructure"

/* ─────────────────────────────────────────────
 * Governance & Delegation
 * ───────────────────────────────────────────── */

export interface DelegationRules {
  /** Actions the agent may take without asking. */
  inMandate: string[];
  /** Cross-domain actions that require a formal request. */
  requiresRequest: string[];
  /** Role the agent escalates to when blocked. */
  escalatesTo: CsuiteRole;
  /** Actions that require explicit owner sign-off (ORG §3.6). */
  irreversibleRequires: CsuiteRole[];
}

export interface DecisionRight {
  description: string;
  authority: 'sole' | 'conditional' | 'outside-mandate';
  coSign?: CsuiteRole[]; // for conditional
}

export interface ReportingLine {
  from: CsuiteRole;
  to: CsuiteRole | 'Board' | null;
}

/* ─────────────────────────────────────────────
 * Role / Agent Identity
 * ───────────────────────────────────────────── */

export interface RoleProfile {
  id: string;           // e.g. "agent-ceo"
  role: CsuiteRole;
  reportsTo: CsuiteRole | 'Board';
  ownerDomain: Domain;
  authorityTier: AuthorityTier;
  version: string;
  description: string;
  responsibilities: string[];
  decisionRights: Record<string, DecisionRight>;
  delegation: DelegationRules;
  escalation: {
    upTo: CsuiteRole | 'Board';
    cadence: string;
  };
  kpis: KPI[];
}

export interface KPI {
  name: string;
  description: string;
  target?: string;
  unit?: string;
}

/* ─────────────────────────────────────────────
 * Decisions & Incidents
 * ───────────────────────────────────────────── */

export type DecisionStatus = 'proposed' | 'approved' | 'rejected' | 'superseded';

export interface DecisionRecord {
  id: string;
  type: 'decision';
  title: string;
  owner: CsuiteRole;
  authority: AuthorityTier;
  rationale: string;
  outcome?: string;
  status: DecisionStatus;
  tags: string[];
  createdAt: string;     // ISO date
  supersededBy?: string; // decision ID
  frontmatterLinks?: FrontmatterLink[];
}

export interface IncidentRecord {
  id: string;
  type: 'incident';
  title: string;
  reportedBy: CsuiteRole;
  escalatedTo: CsuiteRole | 'Board';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  resolution?: string;
  tags: string[];
  createdAt: string;
  frontmatterLinks?: FrontmatterLink[];
}

/* ─────────────────────────────────────────────
 * Graph / Link Types (from gbrain schema pack)
 * ───────────────────────────────────────────── */

export type LinkType =
  | 'reports_to'
  | 'owns'
  | 'escalated_to'
  | 'derived_from'
  | 'parent_of'
  | 'publishes'
  | 'reports_up_to';

export interface FrontmatterLink {
  pageType: string;
  fields: string[];
  linkType: LinkType;
}

/* ─────────────────────────────────────────────
 * Guardrails Policy
 * ───────────────────────────────────────────── */

export type GuardrailRule =
  | 'single-reporting-line'
  | 'mandate-boundary'
  | 'escalate-dont-bypass'
  | 'delegate-dont-abdicate'
  | 'write-it-down'
  | 'reversibility-check'
  | 'autonomy-ceiling'
  | 'no-silent-failure';

export interface GuardrailViolation {
  rule: GuardrailRule;
  agent: string;
  action: string;
  detail: string;
  severity: 'warning' | 'error';
}

export interface PolicyContext {
  agentId: string;
  agentRole: CsuiteRole;
  authorityTier: AuthorityTier;
  mandate: string[];
  requiresRequest: string[];
  escalatesTo: CsuiteRole | 'Board';
  irreversibleRequires: CsuiteRole[];
}

/* ─────────────────────────────────────────────
 * Knowledge Universe — Ingestion / Retrieval
 * ───────────────────────────────────────────── */

export interface Chunk {
  id: string;
  sourcePath: string;
  text: string;
  heading?: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface EmbeddedChunk extends Chunk {
  embedding: number[];
}

export interface RetrievalResult {
  chunk: Chunk;
  score: number;
}

export interface IngestSource {
  path: string;
  format: 'markdown' | 'yaml';
}

/* ─────────────────────────────────────────────
 * Self-improvement surface
 * ───────────────────────────────────────────── */

export type SuggestionStatus = 'proposed' | 'in-progress' | 'done';

export interface Suggestion {
  id: string | number;
  title: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  status: SuggestionStatus;
  detail: string;
  confidence: number;
  created_at: string;
}

export interface FeedbackEntry {
  id: string | number;
  source: string;
  rating: number;
  comment: string;
  date: string;
}

export interface TelemetryEvent {
  page_views: number;
  errors_last_24h: number;
  avg_load_ms: number;
  api_latency_p95_ms: number;
  route_events: Record<string, number>;
}

export interface SelfImproveState {
  learning_rate: number;
  confidence: number;
  iterations: number;
  last_improvement: string;
  suggestions: Suggestion[];
  telemetry: TelemetryEvent;
  feedback: FeedbackEntry[];
}

export type AgentRunStatus = 'idle' | 'running' | 'error';

export interface AgentRunStatusResponse {
  status: AgentRunStatus;
  latestLog: string[];
}

export interface AgentRunResponse {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}
