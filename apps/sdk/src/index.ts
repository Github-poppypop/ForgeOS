/**
 * ForgeOS External App SDK
 *
 * Build external apps that integrate with the ForgeOS Brain Console:
 *  - Discover remote brains via federation API
 *  - Subscribe to mission/agent webhooks
 *  - Manage missions and dispatch agents
 *  - Load as a plugin in C:\ForgeOS\plugins\
 */

import type {
  ForgeOSConfig,
  RemoteBrain,
  WebhookSubscription,
  WebhookEvent,
  Mission,
  AgentState,
  PluginManifest,
  DispatchPayload,
  CapturePayload,
  SuggestionStatus,
  Suggestion,
  FeedbackEntry,
  TelemetryEvent,
  SelfImproveState,
  AgentRunStatus,
  AgentRunStatusResponse,
  AgentRunResponse,
} from "./types.ts";

function apiPath(version: "v1" | "v2", route: string): string {
  return `/api/${version}${route}`;
}

export class ForgeOSClient {
  private baseUrl: string;
  private token?: string;
  private version: "v1" | "v2";
  private timeoutMs: number;

  constructor(config: ForgeOSConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.token = config.token;
    this.version = config.apiVersion ?? "v2";
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${apiPath(this.version, path)}`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
          ...(init?.headers ?? {}),
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`ForgeOS API ${res.status}: ${text || res.statusText}`);
      }
      return res.json() as Promise<T>;
    } finally {
      clearTimeout(t);
    }
  }

  // ---------- Health ----------
  async health() {
    return this.request<{ ok: boolean; ts: number }>("/health");
  }

  // ---------- Federation / remote brains ----------
  async listRemoteBrains() {
    return this.request<{ remote_brains: RemoteBrain[]; count: number }>("/federation/remote");
  }

  async registerRemoteBrain(brain: Omit<RemoteBrain, "status" | "lastSeen">) {
    return this.request<{ ok: boolean; remote_brain: RemoteBrain }>("/federation/remote", {
      method: "POST",
      body: JSON.stringify(brain),
    });
  }

  async getRemoteBrain(id: string) {
    return this.request<{ remote_brain: RemoteBrain }>(`/federation/remote/${encodeURIComponent(id)}`);
  }

  // ---------- Missions ----------
  async listMissions() {
    return this.request<{ missions: Mission[] }>("/missions");
  }

  async advanceMission(id: string, patch: Partial<Pick<Mission, "status" | "progress" | "phase">>) {
    return this.request<Mission>(`/missions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }

  // ---------- Agents ----------
  async dispatchAgent(payload: DispatchPayload) {
    return this.request<{ queued: boolean; missionId: string; agent: string; session: string }>("/agent/dispatch", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getAgentStatus(missionId: string) {
    return this.request<{ missionId: string; status: string; agent: string; session: string; startedAt: number }>(
      `/agent/${encodeURIComponent(missionId)}/status`
    );
  }

  async getAgentLog(missionId: string) {
    return this.request<{ missionId: string; log: string[]; total: number }>(
      `/agent/${encodeURIComponent(missionId)}/log`
    );
  }

  // ---------- Webhooks ----------
  async listWebhooks() {
    return this.request<{ webhooks: WebhookSubscription[] }>("/webhooks");
  }

  async createWebhook(sub: { url: string; events: WebhookEvent[]; secret?: string }) {
    return this.request<{ webhook: WebhookSubscription }>("/webhooks", {
      method: "POST",
      body: JSON.stringify(sub),
    });
  }

  async updateWebhook(id: string, patch: { active?: boolean; events?: WebhookEvent[] }) {
    return this.request<{ webhook: WebhookSubscription }>(`/webhooks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }

  async deleteWebhook(id: string) {
    return this.request<{ ok: boolean }>(`/webhooks/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  // ---------- Brain capture ----------
  async capture(payload: CapturePayload) {
    return this.request<{ slug: string; out: string; err: string }>("/capture", {
      method: "POST",
      body: JSON.stringify({
        slug: payload.slug,
        type: payload.type ?? "note",
        body: payload.body,
      }),
    });
  }

  // ---------- Plugins ----------
  async listPlugins() {
    return this.request<{ plugins: { name: string; version: string; hasRoutes: boolean; hasHooks: boolean }[] }>("/plugins");
  }

  // ---------- Self-improvement ----------
  async getSelfImproveState() {
    return this.request<SelfImproveState>("/self-improve");
  }

  async submitFeedback(entry: Omit<FeedbackEntry, "id" | "date">) {
    return this.request<{ ok: boolean }>("/feedback", {
      method: "POST",
      body: JSON.stringify(entry),
    });
  }

  async submitTelemetry(event: Omit<TelemetryEvent, "page_views" | "errors_last_24h" | "avg_load_ms" | "api_latency_p95_ms"> & {
    page_views?: number;
    errors_last_24h?: number;
    avg_load_ms?: number;
    api_latency_p95_ms?: number;
  }) {
    return this.request<{ ok: boolean }>("/telemetry", {
      method: "POST",
      body: JSON.stringify(event),
    });
  }

  async updateSuggestionStatus(id: string | number, status: SuggestionStatus) {
    return this.request<{ ok: boolean }>(`/self-improve/suggestions/${encodeURIComponent(String(id))}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  async runLearningLoop() {
    return this.request<{ ok: boolean }>("/self-improve/learning-loop", {
      method: "POST",
    });
  }

  async getAgentRunStatus() {
    return this.request<AgentRunStatusResponse>("/agent/self-improve/status");
  }

  async runAgentSelfImprove(prompt: string, scope: string[] = []) {
    return this.request<AgentRunResponse>("/agent/self-improve/run", {
      method: "POST",
      body: JSON.stringify({ prompt, scope }),
    });
  }
}

export function createForgeOSClient(config: ForgeOSConfig) {
  return new ForgeOSClient(config);
}

/**
 * Plugin manifest helper — use this in C:\ForgeOS\plugins\ modules to
 * register routes and hooks with the Brain Console without modifying core.
 */
export function defineForgeOSPlugin(manifest: PluginManifest) {
  return {
    default: {
      name: manifest.name,
      version: manifest.version,
      routes: manifest.routes
        ? Object.fromEntries(
            Object.entries(manifest.routes).map(([path, method]) => [path, createPluginRouteHandler(path, method)])
          )
        : undefined,
    } as {
      name: string;
      version: string;
      routes?: Record<string, (req: Request) => Response | Promise<Response>>;
    },
  };
}

function createPluginRouteHandler(path: string, method: string) {
  return async (req: Request) => {
    if (req.method !== method.toUpperCase()) {
      return new Response(JSON.stringify({ error: `${method.toUpperCase()} required` }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ plugin: true, path, method, ok: true }), {
      headers: { "content-type": "application/json" },
    });
  };
}
