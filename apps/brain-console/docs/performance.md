# Performance

## Tooling

Run `node scripts/perf-audit.ts` to collect a performance report.
The script emits `perf-report.json` and prints a human-readable summary
to stdout.

### What it measures

| Metric | Source |
|--------|--------|
| FCP | `paint` entries (`first-contentful-paint`) |
| LCP | `largest-contentful-paint` entries |
| Runtime | `DOMContentLoadedEventEnd − fetchStart` |
| Memory | `performance.memory` (Chrome/Bun only) |
| Resources | `performance.getEntriesByType("resource")` |

If Playwright is installed the script launches a headless Chromium
instance and captures in-page timings from the live page context.
Otherwise it falls back to in-page `performance.now()` timings.

### Budget targets

| Metric | Budget |
|--------|--------|
| FCP | < 1.2 s on localhost |
| LCP | < 2.5 s on localhost |
| Runtime | < 1.5 s on localhost |
| JS heap | < 80 MB |

### Known slow paths

- `/api/search` hits Ollama — expect 1–4 s depending on model load.
- `/api/capture` and `/api/embed` spawn the gbrain CLI and can block
  the single-writer mutex for up to 60 s.
- Large vault file lists render as a single `<ul>`; pagination is set
  to 10 items per page to keep DOM size bounded.

### Optimizations already in place

- Static assets served with `cache-control: no-cache` to avoid stale
  brain data after captures.
- Panel lazy-loading via `lazyPanel()` — init runs once per panel.
- SSE health stream uses keepalive pings to avoid connection drops.
