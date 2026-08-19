// Server feature: alerting configuration status + self-test endpoint.
// Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts.
// Closes the "Add config-status + test endpoint" backlog gap. It mirrors the
// env-gated alertError() dispatch in server.ts so a self-test fires the SAME
// outbound Sentry/webhook request a real error would (without depending on
// server.ts internals, which are not exported).
import type { Router } from 'express';

const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL ?? '';
const SENTRY_DSN = process.env.SENTRY_DSN ?? '';

type AlertMode = 'sentry' | 'webhook' | 'disabled';

function alertMode(): AlertMode {
  if (SENTRY_DSN) return 'sentry';
  if (ALERT_WEBHOOK_URL) return 'webhook';
  return 'disabled';
}

function statusPayload() {
  const mode = alertMode();
  return {
    ok: true,
    sentryConfigured: Boolean(SENTRY_DSN),
    webhookConfigured: Boolean(ALERT_WEBHOOK_URL),
    mode,
    note:
      mode === 'disabled'
        ? 'Alerting is a silent no-op. Set SENTRY_DSN or ALERT_WEBHOOK_URL to forward errors.'
        : 'Alerting is armed; errors are forwarded to the configured sink.',
  };
}

// Replicates server.ts alertError() dispatch so a self-test exercises the real path.
function dispatchAlert(message: string): void {
  if (ALERT_WEBHOOK_URL) {
    fetch(ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `ForgeOS alert self-test: ${message}` }),
    }).catch(() => {});
    return;
  }
  if (SENTRY_DSN) {
    const m = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(SENTRY_DSN);
    if (!m) return;
    const [, key, host, projectId] = m;
    fetch(`https://${host}/api/${projectId}/store/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${key}`,
      },
      body: JSON.stringify({ message, level: 'error', platform: 'node' }),
    }).catch(() => {});
  }
}

export default function registerAlertStatus(router: Router): void {
  router.get('/api/alerting/status', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(statusPayload());
  });

  router.post('/api/alerting/test', (req, res) => {
    const body = (req.body ?? {}) as { message?: unknown };
    const message =
      typeof body.message === 'string' && body.message.trim()
        ? body.message.trim()
        : 'Manual self-test from /api/alerting/test';
    const mode = alertMode();
    if (mode === 'disabled') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(200).json({ ok: true, dispatched: false, mode, note: statusPayload().note });
      return;
    }
    dispatchAlert(message);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ ok: true, dispatched: true, mode, message });
  });
}
