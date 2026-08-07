#!/usr/bin/env node
/**
 * knowledge-universe/seed.ts — CLI to ingest MISSION.md, VISION.md, ORG.md,
 * ROADMAP.md into the ForgeOS knowledge universe (gbrain).
 *
 * Usage:
 *   npx tsx knowledge-universe/seed.ts [--root /path/to/repo] [--dry-run]
 *
 * Flags:
 *   --root    Repository root (defaults to CWD / FORGEOS_ROOT env var)
 *   --dry-run Print what would be ingested without calling gbrain
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = process.env.FORGEOS_ROOT || process.cwd();

const SEED_FILES = [
  { slug: "mission", file: "MISSION.md", type: "mission" },
  { slug: "vision", file: "VISION.md", type: "vision" },
  { slug: "org", file: "ORG.md", type: "org" },
  { slug: "roadmap", file: "ROADMAP.md", type: "roadmap" },
];

// ---------------------------------------------------------------------------
// GBrain wrapper (mirrors apps/brain-console/server.ts gbrain helpers)
// ---------------------------------------------------------------------------

type RunResult = { ok: boolean; out: string; err: string };

function detectGBrainBin(): string {
  const candidates = [
    join(__dirname, "..", "gbrain"),
    join(DEFAULT_ROOT, "gbrain"),
    process.env.GBRAIN_BIN || "gbrain",
  ];
  for (const bin of candidates) {
    try {
      if (existsSync(bin)) return bin;
    } catch {
      // ignore
    }
  }
  return "gbrain";
}

const GBRAIN_BIN = detectGBrainBin();
const GBRAIN_CLI = "gbrain";

function runGbrain(args: string[], opts: { stdin?: string; timeoutMs?: number } = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(GBRAIN_BIN, [GBRAIN_CLI, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => {
      resolve({ ok: false, out: "", err: String(e) });
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, out, err });
    });
    if (opts.stdin && child.stdin) {
      child.stdin.write(opts.stdin);
      child.stdin.end();
    }
    if (opts.timeoutMs) {
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
        resolve({ ok: false, out, err: "timeout" });
      }, opts.timeoutMs);
    }
  });
}

// ---------------------------------------------------------------------------
// Ingestion
// ---------------------------------------------------------------------------

interface SeedRecord {
  slug: string;
  type: string;
  sourceFile: string;
  bytes: number;
  status: "ok" | "skip" | "error";
  detail: string;
}

async function ingestFile(root: string, rec: typeof SEED_FILES[0]): Promise<SeedRecord> {
  const src = join(root, rec.file);
  try {
    if (!existsSync(src)) {
      return { slug: rec.slug, type: rec.type, sourceFile: rec.file, bytes: 0, status: "skip", detail: "file not found" };
    }
    const body = readFileSync(src, "utf8");
    const bytes = body.length;
    // Use gbrain capture to ingest
    const r = await runGbrain(
      ["capture", "--type", rec.type, "--slug", rec.slug, "--stdin"],
      { stdin: body, timeoutMs: 30000 }
    );
    if (r.ok) {
      return { slug: rec.slug, type: rec.type, sourceFile: rec.file, bytes, status: "ok", detail: r.out.trim() };
    }
    return { slug: rec.slug, type: rec.type, sourceFile: rec.file, bytes, status: "error", detail: r.err || r.out || "unknown" };
  } catch (e: any) {
    return { slug: rec.slug, type: rec.type, sourceFile: rec.file, bytes: 0, status: "error", detail: String(e?.message || e) };
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: { root?: string; dryRun: boolean } = { dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root" && args[i + 1]) { opts.root = args[++i]; }
    else if (args[i] === "--dry-run") { opts.dryRun = true; }
  }
  return opts;
}

async function main() {
  const { root, dryRun } = parseArgs();
  const repoRoot = root || DEFAULT_ROOT;

  console.log(`ForgeOS Knowledge Universe Seeder`);
  console.log(`  root:      ${repoRoot}`);
  console.log(`  gbrain:    ${GBRAIN_BIN}`);
  console.log(`  dry-run:   ${dryRun}`);
  console.log("");

  const results: SeedRecord[] = [];

  for (const rec of SEED_FILES) {
    if (dryRun) {
      const src = join(repoRoot, rec.file);
      let exists = false;
      try { exists = existsSync(src); } catch { /* ignore */ }
      console.log(`[dry-run] ${rec.slug} (${rec.file}) => ${exists ? "would ingest" : "missing"}`);
      results.push({
        slug: rec.slug,
        type: rec.type,
        sourceFile: rec.file,
        bytes: exists ? (() => { try { return readFileSync(src, "utf8").length; } catch { return 0; } })().length : 0,
        status: exists ? "skip" : "skip",
        detail: exists ? "dry-run" : "file not found",
      });
    } else {
      console.log(`ingesting ${rec.slug} (${rec.file})...`);
      const r = await ingestFile(repoRoot, rec);
      results.push(r);
      const icon = r.status === "ok" ? "✓" : r.status === "skip" ? "⏭" : "✗";
      console.log(`  ${icon} ${r.slug}: ${r.detail} (${r.bytes} bytes)`);
    }
  }

  console.log("");
  console.log("Summary:");
  const ok = results.filter((r) => r.status === "ok").length;
  const skip = results.filter((r) => r.status === "skip").length;
  const err = results.filter((r) => r.status === "error").length;
  console.log(`  ok=${ok}  skip=${skip}  error=${err}`);

  if (!dryRun && err > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
