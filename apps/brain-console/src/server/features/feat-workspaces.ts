// Server feature: multi-agent collaboration via shared workspaces (in-memory, mock-first).
// Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts.
// Provides workspace CRUD + member join/leave + an append-only activity feed.
import type { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

interface Member {
  name: string;
  joinedAt: string;
}

interface FeedEntry {
  ts: string;
  agent: string;
  text: string;
}

interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  members: Member[];
  feed: FeedEntry[];
}

// In-memory store (process-local; resets on restart). Intentional for mock-first.
const workspaces: Map<string, Workspace> = new Map();

const FEED_CAP = 200;

function json(res: Response, status: number, body: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

function getWorkspace(id: string): Workspace | undefined {
  return workspaces.get(id);
}

function notFound(res: Response, message: string): void {
  json(res, 404, { ok: false, error: message });
}

function strField(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export default function registerWorkspaces(router: Router): void {
  // List all workspaces.
  router.get('/api/workspaces', (_req: Request, res: Response) => {
    const list = Array.from(workspaces.values()).map((w) => ({
      id: w.id,
      name: w.name,
      createdAt: w.createdAt,
      members: w.members,
    }));
    json(res, 200, { ok: true, workspaces: list });
  });

  // Create a workspace.
  router.post('/api/workspaces', (req: Request, res: Response) => {
    const name = strField((req.body ?? {})['name']);
    if (!name) {
      json(res, 400, { ok: false, error: 'name is required' });
      return;
    }
    const ws: Workspace = {
      id: randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      members: [],
      feed: [],
    };
    workspaces.set(ws.id, ws);
    json(res, 201, { ok: true, workspace: ws });
  });

  // List members of a workspace.
  router.get('/api/workspaces/:id/members', (req: Request, res: Response) => {
    const ws = getWorkspace(req.params.id);
    if (!ws) {
      notFound(res, 'workspace not found');
      return;
    }
    json(res, 200, { ok: true, members: ws.members });
  });

  // Join or leave a workspace (agents as members).
  // Body: { name: string, action?: 'join' | 'leave' } (default 'join').
  router.post('/api/workspaces/:id/members', (req: Request, res: Response) => {
    const ws = getWorkspace(req.params.id);
    if (!ws) {
      notFound(res, 'workspace not found');
      return;
    }
    const name = strField((req.body ?? {})['name']);
    if (!name) {
      json(res, 400, { ok: false, error: 'name is required' });
      return;
    }
    const action = strField((req.body ?? {})['action']) || 'join';
    if (action === 'leave') {
      const before = ws.members.length;
      ws.members = ws.members.filter((m) => m.name !== name);
      json(res, 200, {
        ok: true,
        action: 'leave',
        removed: before !== ws.members.length,
        members: ws.members,
      });
      return;
    }
    if (!ws.members.some((m) => m.name === name)) {
      ws.members.push({ name, joinedAt: new Date().toISOString() });
    }
    json(res, 200, { ok: true, action: 'join', members: ws.members });
  });

  // Append an activity entry to the feed.
  // Body: { agent: string, text: string }.
  router.post('/api/workspaces/:id/feed', (req: Request, res: Response) => {
    const ws = getWorkspace(req.params.id);
    if (!ws) {
      notFound(res, 'workspace not found');
      return;
    }
    const agent = strField((req.body ?? {})['agent']);
    const text = strField((req.body ?? {})['text']);
    if (!agent || !text) {
      json(res, 400, { ok: false, error: 'agent and text are required' });
      return;
    }
    const entry: FeedEntry = { ts: new Date().toISOString(), agent, text };
    ws.feed.push(entry);
    if (ws.feed.length > FEED_CAP) {
      ws.feed = ws.feed.slice(ws.feed.length - FEED_CAP);
    }
    json(res, 201, { ok: true, entry });
  });

  // Recent activity (cap 200, newest last).
  router.get('/api/workspaces/:id/feed', (req: Request, res: Response) => {
    const ws = getWorkspace(req.params.id);
    if (!ws) {
      notFound(res, 'workspace not found');
      return;
    }
    json(res, 200, { ok: true, feed: ws.feed.slice(-FEED_CAP) });
  });
}
