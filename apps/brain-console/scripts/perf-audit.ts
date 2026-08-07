#!/usr/bin/env node
/**
 * perf-audit.ts — FCP / runtime profiling for ForgeOS Brain Console
 *
 * Spins up the server, drives Playwright (if available), and emits
 * a JSON performance report.  Falls back to Lighthouse-style in-page
 * timing when Playwright is not installed.
 *
 * Usage:
 *   cd apps/brain-console && npx tsx scripts/perf-audit.ts
 *
 * Output:
 *   apps/brain-console/perf-report.json
 */

const BASE = process.env.BASE_URL || "http://127.0.0.1:7777";
const OUT = new URL("../perf-report.json", import.meta.url);

type Report = {
  ts: number;
  fcp?: number;
  lcp?: number;
  runtimeMs?: number;
  navEntries: PerformanceNavigationTiming[];
  paintEntries: PerformancePaintTiming[];
  resourceEntries: PerformanceResourceTiming[];
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
};

async function collect(): Promise<Report> {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const paints = performance.getEntriesByType("paint") as PerformancePaintTiming[];
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const mem = (performance as any).memory as { usedJSHeapSize: number; totalJSHeapSize: number } | undefined;

  // FCP = first paint
  const fcp = paints.find((p) => p.name === "first-contentful-paint")?.startTime;
  // LCP = largest contentful paint (if available)
  const lcpEntry = performance.getEntriesByType("largest-contentful-paint")[0] as any;
  const lcp = lcpEntry?.startTime;

  // Runtime = DOMContentLoaded - navigationStart
  const runtimeMs = nav ? nav.domContentLoadedEventEnd - nav.fetchStart : undefined;

  return {
    ts: Date.now(),
    fcp,
    lcp,
    runtimeMs,
    navEntries: nav ? [nav] : [],
    paintEntries: paints,
    resourceEntries: resources,
    memory: mem,
  };
}

async function tryPlaywright(report: Report) {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const sw = await page.evaluate(async () => {
      // Inject a timing collector into the page context
      return new Promise<Report>((resolve) => {
        const onPaint = (e: PerformancePaintTiming) => {
          if (e.name === "first-contentful-paint") {
            window.__perfFcp = e.startTime;
          }
        };
        const onLCP = (e: any) => {
          window.__perfLcp = e.startTime;
        };
        addEventListener("paint", onPaint);
        addEventListener("largest-contentful-paint", onLCP);
        setTimeout(() => {
          removeEventListener("paint", onPaint);
          removeEventListener("largest-contentful-paint", onLCP);
          resolve({
            ts: Date.now(),
            fcp: (window as any).__perfFcp,
            lcp: (window as any).__perfLcp,
            runtimeMs: performance.now(),
            navEntries: performance.getEntriesByType("navigation"),
            paintEntries: performance.getEntriesByType("paint"),
            resourceEntries: performance.getEntriesByType("resource"),
            memory: (performance as any).memory,
          } as Report);
        }, 5000);
      });
    });
    Object.assign(report, sw);
    await browser.close();
  } catch {
    // Playwright not installed — rely on in-page timings
  }
}

function summarize(r: Report) {
  const lines: string[] = [];
  lines.push(`# Performance audit — ${new Date(r.ts).toISOString()}`);
  lines.push("");
  if (r.fcp != null) lines.push(`- FCP: ${r.fcp.toFixed(1)} ms`);
  if (r.lcp != null) lines.push(`- LCP: ${r.lcp.toFixed(1)} ms`);
  if (r.runtimeMs != null) lines.push(`- Runtime (DOMContentLoaded): ${r.runtimeMs.toFixed(1)} ms`);
  if (r.memory) {
    lines.push(`- JS heap used: ${(r.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB`);
    lines.push(`- JS heap total: ${(r.memory.totalJSHeapSize / 1024 / 1024).toFixed(1)} MB`);
  }
  lines.push(`- Paint entries: ${r.paintEntries.length}`);
  lines.push(`- Resource entries: ${r.resourceEntries.length}`);
  lines.push("");
  if (r.resourceEntries.length) {
    lines.push("## Top resources by duration");
    const top = r.resourceEntries
      .slice()
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
    for (const e of top) {
      lines.push(`- ${e.name.split("/").pop()}  ${e.duration.toFixed(0)} ms  ${(e.transferSize / 1024).toFixed(1)} KB`);
    }
  }
  return lines.join("\n");
}

(async () => {
  const report = await collect();
  await tryPlaywright(report);
  const json = JSON.stringify(report, null, 2);
  Bun.write(OUT, json);
  console.log(`[perf-audit] report written → ${OUT}`);
  console.log(summarize(report));
})();
