// Backbone feature bridge: serves the PWA manifest so /manifest.webmanifest returns 200.
// Self-contained — no edits to runtime.ts. Loaded by features/loader.ts.
import type { Router } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

export default function registerPwa(router: Router): void {
  router.get('/manifest.webmanifest', (_req, res) => {
    const file = path.join(PUBLIC_DIR, 'manifest.webmanifest');
    if (!fs.existsSync(file)) {
      res.status(404).json({ error: 'manifest not found' });
      return;
    }
    res.setHeader('Content-Type', 'application/manifest+json');
    res.send(fs.readFileSync(file, 'utf8'));
  });
}
