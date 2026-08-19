// Server feature: outbound webhook registry + delivery self-test.
// Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts.
// Closes the "Webhook management UI" backlog gap. Webhooks persist to
// data/webhooks.json (gitignored runtime artifact, like store.json).
import express from 'express';
import type { Router } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/server/features -> ../../../data == apps/brain-console/data
const DATA_DIR = path.resolve(__dirname, '../../../data');
const WEBHOOKS_FILE = path.join(DATA_DIR, 'webhooks.json');

export interface Webhook {
  id: string;
  url: string;
  event: string;
  active: boolean;
  createdAt: string;
  lastTestedAt?: string;
  lastTestStatus?: 'ok' | 'error';
  lastTestError?: string;
  lastDeliveredAt?: string;
  lastDeliveryStatus?: 'ok' | 'error';
  lastDeliveryError?: string;
}

// Event types a webhook can subscribe to. '*' = all platform events.
export const WEBHOOK_EVENTS = [
  '*',
  'mission.created',
  'mission.updated',
  'decision.recorded',
  'incident.opened',
  'audit.exported',
  'feedback.submitted',
];

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): Webhook[] {
  ensureDir();
  try {
    const raw = fs.readFileSync(WEBHOOKS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Webhook[]) : [];
  } catch {
    return [];
  }
}

function save(list: Webhook[]): void {
  ensureDir();
  const tmp = WEBHOOKS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
  fs.renameSync(tmp, WEBHOOKS_FILE);
}

function isUrl(s: unknown): s is string {
  return typeof s === 'string' && /^https?:\/\//i.test(s.trim());
}

function genId(): string {
  return 'wh_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function payloadFor(wh: Webhook) {
  return {
    type: 'webhook.test',
    webhookId: wh.id,
    event: wh.event,
    ts: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Webhook delivery engine
// ---------------------------------------------------------------------------
// Registered webhooks previously never fired on real platform events. This
// engine lets any part of the runtime publish an event; every active webhook
// subscribed to that event (or '*') receives a POST. Delivery is fire-and-forget
// and never breaks the calling code; results are recorded on the webhook record.
const bus = new EventEmitter();
bus.setMaxListeners(0);

export interface PlatformEvent {
  type: string;
  payload: Record<string, unknown>;
}

// Publish a platform event. Producers (feedback, audit export, missions, ...)
// call this; matching webhooks are delivered asynchronously.
export function publishWebhookEvent(type: string, payload: Record<string, unknown> = {}): void {
  const evt: PlatformEvent = { type, payload };
  bus.emit('platform-event', evt);
}

async function deliverOne(
  wh: Webhook,
  evt: PlatformEvent
): Promise<{ id: string; status: 'ok' | 'error'; error?: string; at: string }> {
  const at = new Date().toISOString();
  try {
    const r = await fetch(wh.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forgeos-event': evt.type },
      body: JSON.stringify({ type: evt.type, payload: evt.payload, ts: Date.now() }),
    });
    return { id: wh.id, status: r.ok ? 'ok' : 'error', error: r.ok ? undefined : 'HTTP ' + r.status, at };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { id: wh.id, status: 'error', error: msg, at };
  }
}

async function deliverToMatching(evt: PlatformEvent): Promise<void> {
  const matches = load().filter((w) => w.active && (w.event === '*' || w.event === evt.type));
  const results = await Promise.all(matches.map((w) => deliverOne(w, evt)));
  if (results.length === 0) return;
  const fresh = load();
  let changed = false;
  for (const r of results) {
    const idx = fresh.findIndex((x) => x.id === r.id);
    if (idx !== -1) {
      fresh[idx] = {
        ...fresh[idx],
        lastDeliveredAt: r.at,
        lastDeliveryStatus: r.status,
        lastDeliveryError: r.error,
      };
      changed = true;
    }
  }
  if (changed) save(fresh);
}

bus.on('platform-event', (evt: PlatformEvent) => {
  void deliverToMatching(evt);
});

export default function registerWebhooks(router: Router): void {
  router.get('/api/webhooks', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, webhooks: load(), events: WEBHOOK_EVENTS });
  });

  router.post('/api/webhooks', (req, res) => {
    const body = (req.body ?? {}) as { url?: unknown; event?: unknown; active?: unknown };
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    const event = typeof body.event === 'string' && body.event ? body.event : '*';
    const active = body.active !== false;
    if (!isUrl(url)) {
      res.status(400).json({ ok: false, error: 'url must be an http(s) URL' });
      return;
    }
    const list = load();
    const wh: Webhook = {
      id: genId(),
      url,
      event,
      active,
      createdAt: new Date().toISOString(),
    };
    list.push(wh);
    save(list);
    res.status(201).json({ ok: true, webhook: wh });
  });

  router.post('/api/webhooks/:id/test', (req, res) => {
    const list = load();
    const wh = list.find((w) => w.id === req.params.id);
    if (!wh) {
      res.status(404).json({ ok: false, error: 'webhook not found' });
      return;
    }
    fetch(wh.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forgeos-webhook': 'test' },
      body: JSON.stringify(payloadFor(wh)),
    })
      .then((r) => {
        wh.lastTestedAt = new Date().toISOString();
        wh.lastTestStatus = r.ok ? 'ok' : 'error';
        wh.lastTestError = r.ok ? undefined : 'HTTP ' + r.status;
        save(list);
        res.status(200).json({ ok: true, status: r.status, webhook: wh });
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        wh.lastTestedAt = new Date().toISOString();
        wh.lastTestStatus = 'error';
        wh.lastTestError = msg;
        save(list);
        res.status(200).json({ ok: true, status: 'error', error: msg, webhook: wh });
      });
  });

  router.delete('/api/webhooks/:id', (req, res) => {
    const list = load();
    const idx = list.findIndex((w) => w.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ ok: false, error: 'webhook not found' });
      return;
    }
    list.splice(idx, 1);
    save(list);
    res.status(200).json({ ok: true });
  });

  // Publish a platform event so subscribers receive a POST. This is the
  // integration point that closes the "registered webhooks never fire" gap;
  // any producer can call publishWebhookEvent(type, payload) equivalently.
  router.post('/api/webhooks/publish', express.json(), (req, res) => {
    const body = (req.body ?? {}) as { type?: unknown; payload?: unknown };
    const type = typeof body.type === 'string' && body.type ? body.type : '';
    if (!type) {
      res.status(400).json({ ok: false, error: 'type required' });
      return;
    }
    const payload =
      body.payload && typeof body.payload === 'object'
        ? (body.payload as Record<string, unknown>)
        : {};
    const subscribers = load().filter((w) => w.active && (w.event === '*' || w.event === type));
    publishWebhookEvent(type, payload);
    res.status(202).json({ ok: true, type, delivered: subscribers.length });
  });

  // Echo target: lets the console (and external tools) verify a delivery POST
  // actually reaches an endpoint.
  router.post('/api/webhooks/echo', express.json(), (req, res) => {
    res.status(200).json({ ok: true, received: true, body: req.body ?? null, ts: Date.now() });
  });
}
