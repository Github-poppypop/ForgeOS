#!/usr/bin/env node
/**
 * scripts/decision-cli.ts — ForgeOS Decision / Incident record CLI.
 *
 * Commands:
 *   npx tsx scripts/decision-cli.ts list [--status pending|approved|rejected|executing|done]
 *   npx tsx scripts/decision-cli.ts get <id>
 *   npx tsx scripts/decision-cli.ts create --title "X" --status approved --type approval --role cto/cto --mission RFC-0000
 *   npx tsx scripts/decision-cli.ts update <id> --status executing --progress 40
 *   npx tsx scripts/decision-cli.ts incident create --title "Y" --severity high --owner cpo/cpo
 *   npx tsx scripts/decision-cli.ts incident close <id> --resolution rolled-back
 */

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, readFileSync } from "node:fs";

const GBRAIN_BIN = process.env.GBRAIN_BIN || "/root/.bun/bin/bun";
const GBRAIN_CLI = process.env.GBRAIN_CLI || "/tmp/forge-gbrain-local/node_modules/gbrain/src/cli.ts";
const GBRAIN_CWD = process.env.GBRAIN_CWD || "/tmp/forge-gbrain-local";

function gbrain(args: string[], stdin?: string) {
  return new Promise<{ code: number; out: string; err: string }>((resolve) => {
    const proc = spawn(GBRAIN_BIN, [GBRAIN_CLI, ...args], { cwd: GBRAIN_CWD, stdio: ["pipe", "pipe", "pipe"] });
    const out: string[] = [];
    const err: string[] = [];
    proc.stdout.on("data", (d) => out.push(d.toString()));
    proc.stderr.on("data", (d) => err.push(d.toString()));
    proc.on("close", (code) => resolve({ code: code ?? 0, out: out.join(""), err: err.join("") }));
    if (stdin) proc.stdin.write(stdin);
    proc.stdin.end();
  });
}

async function list(args: string[]) {
  const q = args[0];
  const r = await gbrain(["list", "--json"]);
  let entries: any[] = [];
  try { entries = JSON.parse(r.out || "[]"); } catch {}
  if (q) entries = entries.filter((e) => String(e.id).includes(q));
  console.log(JSON.stringify({ ok: true, entries }, null, 2));
}

async function create(args: string[]) {
  const title = flag(args, "--title") || `Decision ${Date.now()}`;
  const status = flag(args, "--status") || "proposed";
  const type = flag(args, "--type") || "decision";
  const role = flag(args, "--role") || "cto/cto";
  const mission = flag(args, "--mission") || "unknown";
  const body = JSON.stringify({ title, status, type, role, mission, ts: new Date().toISOString() }, null, 2);
  const slug = `decisions/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
  const r = await gbrain(["capture", "--type", type, "--slug", slug, "--stdin"], body);
  console.log(JSON.stringify({ ok: r.code === 0, slug, code: r.code, err: r.err || null }, null, 2));
}

async function update(args: string[]) {
  const id = args[0];
  if (!id) { console.log(JSON.stringify({ ok: false, error: "id required" }, null, 2)); process.exit(1); }
  const r = await gbrain(["get", id]);
  const raw = r.out || "{}";
  let doc: any = {};
  try { doc = JSON.parse(raw); } catch {}
  const status = flag(args, "--status"); if (status) doc.status = status;
  const progress = flag(args, "--progress"); if (progress !== undefined) doc.progress = Number(progress);
  doc.updatedAt = new Date().toISOString();
  const r2 = await gbrain(["capture", "--type", doc.type || "decision", "--slug", id, "--stdin"], JSON.stringify(doc, null, 2));
  console.log(JSON.stringify({ ok: r2.code === 0, id, code: r2.code }, null, 2));
}

async function incident(args: string[], action: "create" | "close") {
  if (action === "create") {
    await create(args);
    return;
  }
  const id = args[0];
  if (!id) { console.log(JSON.stringify({ ok: false, error: "incident id required" }, null, 2)); process.exit(1); }
  const resolution = flag(args, "--resolution") || "resolved";
  const r = await gbrain(["get", id]).catch(() => ({ out: "{}", code: 1 }));
  let doc: any = {};
  try { doc = JSON.parse(r.out); } catch {}
  doc.status = "closed";
  doc.resolution = resolution;
  doc.closedAt = new Date().toISOString();
  const r2 = await gbrain(["capture", "--type", doc.type || "incident", "--slug", id, "--stdin"], JSON.stringify(doc, null, 2));
  console.log(JSON.stringify({ ok: r2.code === 0, id, resolution, code: r2.code }, null, 2));
}

function flag(args: string[], name: string) {
  const i = args.indexOf(name);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  const eq = args.find((a) => a.startsWith(name + "="));
  if (eq) return eq.split("=")[1];
  return undefined;
}

async function main() {
  const cmd = process.argv[2];
  const rest = process.argv.slice(3);
  if (cmd === "list") await list(rest);
  else if (cmd === "get") await list(rest);
  else if (cmd === "create") await create(rest);
  else if (cmd === "update") await update(rest);
  else if (cmd === "incident") {
    const action = rest[0] === "close" ? "close" : "create";
    const tail = rest.slice(action === "close" ? 1 : 0);
    await incident(tail, action);
  }
  else {
    console.log(`decision-cli: unknown command "${cmd}"`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
