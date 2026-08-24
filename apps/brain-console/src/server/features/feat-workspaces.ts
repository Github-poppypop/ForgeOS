/**
 * src/server/features/feat-workspaces.ts — Auto-loaded by loadServerFeatures.
 * Shared multi-agent workspaces (CRUD + members + append-only activity feed).
 * Persisted to data/workspaces.json so collaboration state survives restarts.
 * Extracted from runtime.ts to keep features as self-contained feat-* modules.
 */
import type { Router, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

function dataDir(): string {
  return process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), "data");
}

const WORKSPACES_FILE = path.join(dataDir(), "workspaces.json");
const WORKSPACE_FEED_CAP = 200;

interface WorkspaceMember {
  name: string;
  joinedAt: string;
}
interface WorkspaceFeedEntry {
  ts: string;
  agent: string;
  text: string;
}
interface WorkspaceRecord {
  id: string;
  name: string;
  createdAt: string;
  members: WorkspaceMember[];
  feed: WorkspaceFeedEntry[];
}

function loadWorkspaces(): WorkspaceRecord[] {
  try {
    const raw = fs.readFileSync(WORKSPACES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WorkspaceRecord[]) : [];
  } catch {
    return [];
  }
}

function saveWorkspaces(ws: WorkspaceRecord[]): void {
  fs.mkdirSync(path.dirname(WORKSPACES_FILE), { recursive: true });
  fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(ws, null, 2));
}

function sanitize(input: unknown, fallback = ""): string {
  if (typeof input !== "string") return fallback;
  return input.replace(/[<>]/g, "").trim().slice(0, 200) || fallback;
}

function json(res: Response, body: unknown, status = 200): Response {
  return res.status(status).json(body);
}

export default function registerWorkspaces(router: Router): void {
  router.get("/api/workspaces", (_req: Request, res: Response) => {
    const ws = loadWorkspaces();
    json(res, {
      ok: true,
      workspaces: ws.map((w) => ({
        id: w.id,
        name: w.name,
        createdAt: w.createdAt,
        members: w.members,
      })),
    });
  });

  router.post("/api/workspaces", (req: Request, res: Response) => {
    const name = sanitize((req.body as Record<string, unknown>).name);
    if (!name) return json(res, { error: "name is required" }, 400);
    const current = loadWorkspaces();
    const record: WorkspaceRecord = {
      id: randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      members: [],
      feed: [],
    };
    current.push(record);
    saveWorkspaces(current);
    return json(res, { ok: true, workspace: record }, 201);
  });

  router.get("/api/workspaces/:id", (req: Request, res: Response) => {
    const id = sanitize(req.params.id);
    const ws = loadWorkspaces().find((w) => w.id === id);
    if (!ws) return json(res, { error: "workspace not found" }, 404);
    return json(res, { ok: true, workspace: ws });
  });

  router.post("/api/workspaces/:id/members", (req: Request, res: Response) => {
    const id = sanitize(req.params.id);
    const name = sanitize((req.body as Record<string, unknown>).name);
    if (!name) return json(res, { error: "name is required" }, 400);
    const action = sanitize((req.body as Record<string, unknown>).action, "join");
    const all = loadWorkspaces();
    const ws = all.find((w) => w.id === id);
    if (!ws) return json(res, { error: "workspace not found" }, 404);
    if (action === "leave") {
      ws.members = ws.members.filter((m) => m.name !== name);
    } else if (!ws.members.some((m) => m.name === name)) {
      ws.members.push({ name, joinedAt: new Date().toISOString() });
    }
    saveWorkspaces(all);
    return json(res, { ok: true, action, members: ws.members });
  });

  router.post("/api/workspaces/:id/feed", (req: Request, res: Response) => {
    const id = sanitize(req.params.id);
    const agent = sanitize((req.body as Record<string, unknown>).agent);
    const text = sanitize((req.body as Record<string, unknown>).text);
    if (!agent || !text)
      return json(res, { error: "agent and text are required" }, 400);
    const all = loadWorkspaces();
    const ws = all.find((w) => w.id === id);
    if (!ws) return json(res, { error: "workspace not found" }, 404);
    const entry: WorkspaceFeedEntry = {
      ts: new Date().toISOString(),
      agent,
      text,
    };
    ws.feed.push(entry);
    if (ws.feed.length > WORKSPACE_FEED_CAP)
      ws.feed = ws.feed.slice(ws.feed.length - WORKSPACE_FEED_CAP);
    saveWorkspaces(all);
    return json(res, { ok: true, entry }, 201);
  });

  router.get("/api/workspaces/:id/feed", (req: Request, res: Response) => {
    const id = sanitize(req.params.id);
    const ws = loadWorkspaces().find((w) => w.id === id);
    if (!ws) return json(res, { error: "workspace not found" }, 404);
    return json(res, { ok: true, feed: ws.feed.slice(-WORKSPACE_FEED_CAP) });
  });
}
