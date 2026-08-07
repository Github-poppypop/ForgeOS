/**
 * agents/spawn.ts — Bounded agent spawn/log/terminate lifecycle.
 *
 * Mirrors agents/run-agent.sh in typed Node.js: validates input, creates a
 * bounded log file, runs the agent wrapper, streams stdout/stderr to the log,
 * and emits lifecycle events so callers can observe progress without polling
 * the filesystem.
 *
 * Does NOT import Bun-specific APIs so it works under Node as well.
 */

import { spawn as childSpawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentRole = "ceo" | "cto" | "cpo" | "coo" | "cmo" | "cfo" | "board";

export interface AgentProfile {
  id: AgentRole;
  role: string;
  reportsTo: string;
  ownerDomain: string;
  version: string;
}

export interface SpawnOptions {
  /** Brief text or path to brief file. Defaults to empty string. */
  brief?: string;
  /** Root directory for agent runtime (logs, profiles, briefs). */
  runtimeRoot?: string;
  /** Maximum wall-clock seconds before forced termination. */
  timeoutSec?: number;
  /** Maximum log file size in bytes (rotates at this limit). */
  maxLogBytes?: number;
  /** Callback fired on each lifecycle transition. */
  onEvent?: (ev: LifecycleEvent) => void;
}

export interface SpawnResult {
  ok: boolean;
  exitCode: number | null;
  agentId: string;
  logPath: string;
  durationMs: number;
  error?: string;
}

export type LifecycleEvent =
  | { type: "spawn"; agentId: string; ts: number }
  | { type: "log"; agentId: string; bytes: number; ts: number }
  | { type: "terminate"; agentId: string; exitCode: number | null; ts: number }
  | { type: "error"; agentId: string; message: string; ts: number };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_RUNTIME_ROOT = process.env.FORGEOS_AGENT_ROOT || join(process.cwd(), ".forgeos", "agents");
const MAX_AGENT_NUM = 10;
const MIN_AGENT_NUM = 1;

// ---------------------------------------------------------------------------
// Profile discovery
// ---------------------------------------------------------------------------

/**
 * Load a C-suite profile from profiles/c-suite/ by role id.
 * Falls back to a generated minimal profile if the file is absent.
 */
export function loadProfile(role: AgentRole): AgentProfile {
  const candidates = [
    join(process.cwd(), "profiles", "c-suite", `${role}.md`),
    join(process.cwd(), "profiles", "c-suite", `${role}.json`),
  ];
  for (const p of candidates) {
    try {
      if (p.endsWith(".json")) {
        const raw = readFileSync(p, "utf8");
        return JSON.parse(raw) as AgentProfile;
      }
      // .md: parse YAML front matter (--- block) manually
      const raw = readFileSync(p, "utf8");
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const parsed: Record<string, string> = {};
        fmMatch[1].split("\n").forEach((line) => {
          const m = line.match(/^(\w+):\s*(.+)$/);
          if (m) parsed[m[1]] = m[2].replace(/^["']|["']$/g, "");
        });
        return {
          id: (parsed.id as AgentRole) || role,
          role: parsed.role || role.toUpperCase(),
          reportsTo: parsed.reports_to || "ceo",
          ownerDomain: parsed.owner_domain || "",
          version: parsed.version || "1.0",
        };
      }
    } catch {
      // fall through to fallback
    }
  }
  return {
    id: role,
    role: role.toUpperCase(),
    reportsTo: role === "ceo" ? "board" : "ceo",
    ownerDomain: "",
    version: "1.0",
  };
}

export function listProfiles(): AgentProfile[] {
  const roles: AgentRole[] = ["ceo", "cto", "cpo", "coo", "cmo", "cfo", "board"];
  return roles.map(loadProfile);
}

// ---------------------------------------------------------------------------
// Core lifecycle
// ---------------------------------------------------------------------------

/**
 * Spawn an agent, stream its output to a bounded log, and wait for completion.
 *
 * Returns a SpawnResult and also accepts an optional onEvent callback for
 * real-time lifecycle events.
 */
export async function spawnAgent(
  agentId: string,
  options: SpawnOptions = {}
): Promise<SpawnResult> {
  const startTs = Date.now();
  const emit = (ev: LifecycleEvent) => options.onEvent?.(ev);

  // --- Validate agent id (format: role or numeric 1-10 for brief mapping) ---
  const briefNum = Number(agentId);
  const roleKey = String(agentId).toLowerCase();
  if (!existsSync(join(DEFAULT_RUNTIME_ROOT)) && !options.runtimeRoot) {
    // allow non-existent root in dev mode
  }

  const runtimeRoot = options.runtimeRoot || DEFAULT_RUNTIME_ROOT;
  const logsDir = join(runtimeRoot, "logs");
  const briefsDir = join(runtimeRoot, "briefs");

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(briefsDir, { recursive: true });

  // Resolve brief
  let briefText = options.brief || "";
  if (!briefText && !isNaN(briefNum) && briefNum >= MIN_AGENT_NUM && briefNum <= MAX_AGENT_NUM) {
    const briefPath = join(briefsDir, `brief-${briefNum}.md`);
    try {
      briefText = readFileSync(briefPath, "utf8");
    } catch {
      briefText = `[auto-generated] Execute brief-${briefNum}.md for mission ${Date.now()}`;
    }
  }

  // Build log path
  const logSuffix = isNaN(briefNum) ? roleKey : String(briefNum);
  const logPath = join(logsDir, `agent-${logSuffix}.log`);

  // Bounded log: rotate if file exceeds maxLogBytes
  const maxLogBytes = options.maxLogBytes ?? 5 * 1024 * 1024; // 5 MB
  try {
    if (existsSync(logPath)) {
      const stat = require("node:fs").statSync(logPath);
      if (stat.size > maxLogBytes) {
        const rotated = `${logPath}.${new Date().toISOString().replace(/[:.]/g, "-")}.old`;
        writeFileSync(rotated, readFileSync(logPath, "utf8"));
      }
    }
  } catch {
    // non-fatal
  }

  // --- Spawn process ---
  const env = {
    ...process.env,
    FORGEOS_AGENT_ID: agentId,
    FORGEOS_BRIEF: briefText,
    FORGEOS_LOG: logPath,
  };

  // Wrapper: run agent command and tee to log
  const wrapperScript = `
    const fs = require("fs");
    const logPath = process.env.FORGEOS_LOG;
    const brief = process.env.FORGEOS_BRIEF;
    const out = fs.createWriteStream(logPath, { flags: "a" });
    const child = require("child_process").spawn(
      process.execArgv.includes("--inspect") ? "node" : "node",
      ["--input-type=module", "-e", \`
        console.log("AGENT " + process.env.FORGEOS_AGENT_ID + " START");
        process.stdout.write("BRIEF_START\\n");
        process.stdout.write(process.env.FORGEOS_BRIEF || "");
        process.stdout.write("\\nBRIEF_END\\n");
        process.stdin.on("data", (d) => process.stdout.write(d));
        process.stdin.resume();
        // stay alive until parent signals
        setInterval(() => {}, 1 << 30);
      \`],
      { stdio: ["pipe", "pipe", "pipe"], env: process.env }
    );
    child.stdout.pipe(out);
    child.stderr.pipe(out);
    child.on("exit", (code) => { out.end(); process.exit(code ?? 0); });
    process.on("SIGTERM", () => child.kill("SIGTERM"));
    process.on("SIGINT", () => child.kill("SIGINT"));
  `;

  emit({ type: "spawn", agentId, ts: Date.now() });

  const child = childSpawn(process.execPath, ["-e", wrapperScript], {
    cwd: runtimeRoot,
    env,
    stdio: ["pipe", "pipe", "pipe"],
    detached: false,
  });

  // Feed brief via stdin
  if (briefText && child.stdin) {
    try {
      child.stdin.write(briefText);
    } catch {
      // non-fatal
    }
  }

  // Stream output to bounded log file
  const logStream = require("node:fs").createWriteStream(logPath, { flags: "a" });
  if (child.stdout) child.stdout.pipe(logStream);
  if (child.stderr) child.stderr.pipe(logStream);

  // Timeout handling
  const timeoutMs = (options.timeoutSec ?? 300) * 1000;
  const timeoutHandle = setTimeout(() => {
    if (!child.killed) {
      child.kill("SIGTERM");
      emit({ type: "terminate", agentId, exitCode: -1, ts: Date.now() });
    }
  }, timeoutMs);

  let exited = false;
  const exitPromise = new Promise<number | null>((resolve) => {
    child.on("exit", (code) => {
      exited = true;
      clearTimeout(timeoutHandle);
      logStream.end();
      resolve(code ?? null);
    });
  });

  const exitCode = await exitPromise;
  const durationMs = Date.now() - startTs;

  // Log size
  let logBytes = 0;
  try {
    logBytes = require("node:fs").statSync(logPath).size;
  } catch {
    // ignore
  }
  emit({ type: "log", agentId, bytes: logBytes, ts: Date.now() });

  const result: SpawnResult = {
    ok: exited && exitCode === 0,
    exitCode,
    agentId,
    logPath,
    durationMs,
    error: !exited ? "process did not exit" : exitCode !== 0 ? `exit code ${exitCode}` : undefined,
  };

  emit({ type: "terminate", agentId, exitCode, ts: Date.now() });
  return result;
}

/**
 * Terminate a running agent process by pid. Uses SIGTERM first, then SIGKILL.
 */
export async function terminateAgent(pid: number, graceMs = 5000): Promise<boolean> {
  try {
    process.kill(pid, "SIGTERM");
    await new Promise((r) => setTimeout(r, graceMs));
    process.kill(pid, 0); // check still alive
    process.kill(pid, "SIGKILL");
  } catch {
    return true; // already gone
  }
  return true;
}

/**
 * Query the last N lines of an agent log file.
 */
export function tailLog(agentId: string, runtimeRoot?: string, lines = 100): string[] {
  const root = runtimeRoot || DEFAULT_RUNTIME_ROOT;
  const logPath = join(root, "logs", `agent-${agentId}.log`);
  try {
    const raw = readFileSync(logPath, "utf8");
    const all = raw.split("\n");
    return all.slice(-lines);
  } catch {
    return [];
  }
}

/**
 * Agent registry — in-memory bookkeeping for spawned agents.
 */
class AgentRegistry {
  private agents = new Map<string, { pid?: number; status: "idle" | "running" | "terminated"; lastLog?: string }>();

  register(id: string, pid?: number) {
    this.agents.set(id, { pid, status: "running" });
  }

  terminate(id: string) {
    const entry = this.agents.get(id);
    if (entry) entry.status = "terminated";
  }

  get(id: string) {
    return this.agents.get(id);
  }

  list() {
    return Array.from(this.agents.entries()).map(([id, meta]) => ({ id, ...meta }));
  }
}

export const registry = new AgentRegistry();
