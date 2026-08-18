/**
 * ForgeOS External App SDK — type definitions
 */

export interface ForgeOSConfig {
  /** Brain Console base URL (e.g. http://localhost:7777) */
  baseUrl: string;
  /** Optional bearer token for authenticated requests */
  token?: string;
  /** API version to use: "v1" or "v2" (default: "v2") */
  apiVersion?: "v1" | "v2";
  /** Request timeout in ms */
  timeoutMs?: number;
}

export interface RemoteBrain {
  id: string;
  name: string;
  url: string;
  status: "online" | "offline" | "unknown";
  lastSeen?: number;
  roles?: string[];
}

export interface WebhookSubscription {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  createdAt: number;
  active: boolean;
}

export type WebhookEvent =
  | "mission.created"
  | "mission.updated"
  | "agent.started"
  | "agent.completed"
  | "agent.failed";

export interface Mission {
  id: string;
  title: string;
  status: string;
  phase: string;
  progress: number;
  eta: string;
  dependencies: string[];
  owner: string;
}

export interface AgentState {
  status: "pending" | "running" | "done" | "failed";
  agent: string;
  session: string;
  startedAt: number;
  log: string[];
}

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  routes?: Record<string, string>;
  permissions?: string[];
}

export interface DispatchPayload {
  missionId: string;
  agent: string;
}

export interface CapturePayload {
  slug: string;
  type?: string;
  body: unknown;
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
