/**
 * agents/self-improve-loop.ts — Bounded self-improvement cycle.
 *
 * Flow:
 * 1. Create git worktree from main
 * 2. Run focused edit prompt via aider/claude wrapper
 * 3. Run test gate + build gate
 * 4. If green → commit → fast-forward merge → push
 * 5. If red  → discard worktree, log failure, stop or retry
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const WORKTREES = join(ROOT, ".worktrees");
const LOGS = join(ROOT, ".forgeos", "logs");

type CycleResult = { ok: boolean; cycle: number; worktree?: string; commit?: string; error?: string };

export async function runSelfImproveCycle(options?: { prompt?: string; scope?: string[]; maxRetries?: number }): Promise<CycleResult> {
  const prompt = options?.prompt ?? "Review the codebase and make one small, safe improvement to tests, docs, or type safety. Do not change behavior.";
  const scope = options?.scope ?? [];
  const maxRetries = options?.maxRetries ?? 1;
  const cycle = readCycleCounter() + 1;

  mkdirSync(WORKTREES, { recursive: true });
  mkdirSync(LOGS, { recursive: true });

  const cycleDir = join(WORKTREES, `cycle-${cycle}`);
  const logPath = join(LOGS, `self-improve-${Date.now()}.log`);

  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    writeFileSync(logPath, `${line}\n`, { flag: "a" });
    console.log(line);
  };

  log(`Cycle ${cycle} start`);

  // 1. Create worktree
  const createWorktree = await exec("git", ["worktree", "add", "-b", `self-improve/${cycle}`, cycleDir, "HEAD"], { cwd: ROOT });
  if (!createWorktree.ok) {
    log(`Failed to create worktree: ${createWorktree.error}`);
    return { ok: false, cycle, error: createWorktree.error };
  }
  log(`Worktree created: ${cycleDir}`);

  // 2. Run agent edit in worktree
  const editResult = await runAgentEdit(cycleDir, prompt, scope);
  if (!editResult.ok) {
    log(`Agent edit failed: ${editResult.error}`);
    await cleanupWorktree(cycleDir);
    return { ok: false, cycle, worktree: cycleDir, error: editResult.error };
  }
  log(`Agent edit completed in ${editResult.durationMs}ms`);

  // 3. Run test/build gates
  const testResult = await runGate(cycleDir, ["npm", "test"], "test");
  if (!testResult.ok) {
    log(`Test gate failed: ${testResult.error}`);
    await cleanupWorktree(cycleDir);
    return { ok: false, cycle, worktree: cycleDir, error: testResult.error };
  }
  log("Test gate passed");

  const buildResult = await runGate(cycleDir, ["npm", "run", "build"], "build");
  if (!buildResult.ok) {
    log(`Build gate failed: ${buildResult.error}`);
    await cleanupWorktree(cycleDir);
    return { ok: false, cycle, worktree: cycleDir, error: buildResult.error };
  }
  log("Build gate passed");

  // 4. Commit and merge
  const commitMsg = `feat(self-improve): cycle ${cycle} automated improvement`;
  const commitResult = await exec("git", ["commit", "-am", commitMsg], { cwd: cycleDir });
  if (!commitResult.ok && !commitResult.error.includes("nothing to commit")) {
    log(`Commit failed: ${commitResult.error}`);
    await cleanupWorktree(cycleDir);
    return { ok: false, cycle, worktree: cycleDir, error: commitResult.error };
  }

  const commitHash = await getCurrentCommit(cycleDir);
  log(`Committed: ${commitHash}`);

  // Merge back to main
  const mergeResult = await exec("git", ["merge", "--ff-only", `self-improve/${cycle}`], { cwd: ROOT });
  if (!mergeResult.ok) {
    log(`Merge failed: ${mergeResult.error}`);
    await cleanupWorktree(cycleDir);
    return { ok: false, cycle, worktree: cycleDir, error: mergeResult.error };
  }
  log("Merged to main");

  // 5. Cleanup
  await cleanupWorktree(cycleDir);
  writeCycleCounter(cycle);
  log(`Cycle ${cycle} complete`);
  return { ok: true, cycle, worktree: cycleDir, commit: commitHash };
}

async function runAgentEdit(cwd: string, prompt: string, scope: string[]): Promise<{ ok: boolean; durationMs: number; error?: string }> {
  const start = Date.now();
  try {
    const agent = resolveAgent();
    const args = buildAgentArgs(agent, prompt, scope);
    const result = await exec(agent, args, { cwd, env: process.env, input: "", timeoutMs: 300_000 });
    const detail = result.error ? `${result.error}${result.stderr ? ` — ${result.stderr.slice(0, 500)}` : ""}` : undefined;
    return { ok: result.ok, durationMs: Date.now() - start, error: detail };
  } catch (e: any) {
    return { ok: false, durationMs: Date.now() - start, error: e?.message ?? String(e) };
  }
}

function resolveAgent(): string {
  const preferred = process.env.FORGEOS_AGENT?.trim();
  if (preferred) return preferred;
  // Prefer an API-key-driven, non-interactive provider if a key is present.
  if (process.env.ANTHROPIC_API_KEY) return "claude-keyed";
  if (process.env.OPENAI_API_KEY || process.env.AIDER_API_KEY) return "aider";
  return "claude";
}

function buildAgentArgs(agent: string, prompt: string, scope: string[]): string[] {
  const scopeLine = scope.length ? `Scope: ${scope.join(", ")}` : "Scope: all files";
  const message = `${prompt}

${scopeLine}

Rules:
- Make the smallest safe change possible.
- Do not change app behavior unless explicitly asked.
- Run tests before finishing.
- If tests fail, revert and stop.`;

  if (agent === "aider") {
    return ["--message", message, "--yes"];
  }
  if (agent === "claude-keyed") {
    // Non-interactive, API-key-driven (requires ANTHROPIC_API_KEY in env).
    return ["-p", "--output-format", "text", "--model", process.env.FORGEOS_AGENT_MODEL || "claude-sonnet-4-0", message];
  }
  if (agent === "claude") {
    return ["-p", "--output-format", "text", "--model", "sonnet", message];
  }
  return ["-p", message];
}

async function runGate(cwd: string, cmd: string[], label: string): Promise<{ ok: boolean; error?: string }> {
  const result = await exec(cmd[0], cmd.slice(1), { cwd, timeoutMs: 300_000 });
  if (result.ok) return { ok: true };
  return { ok: false, error: `${label} failed: ${result.error}` };
}

async function cleanupWorktree(worktree: string): Promise<void> {
  try {
    await exec("git", ["worktree", "remove", "--force", worktree], { cwd: ROOT });
  } catch {
    // non-fatal
  }
}

function readCycleCounter(): number {
  const p = join(LOGS, "cycle-counter");
  try {
    return Number(readFileSync(p, "utf8").trim()) || 0;
  } catch {
    return 0;
  }
}

function writeCycleCounter(n: number): void {
  writeFileSync(join(LOGS, "cycle-counter"), String(n));
}

async function getCurrentCommit(cwd: string): Promise<string> {
  const r = await exec("git", ["rev-parse", "--short", "HEAD"], { cwd });
  if (!r.ok) return "unknown";
  return r.stdout.trim();
}

async function exec(cmd: string, args: string[], opts?: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string; timeoutMs?: number }): Promise<{ ok: boolean; stdout: string; stderr: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts?.cwd, env: opts?.env ?? process.env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    if (opts?.input !== undefined) {
      child.stdin.write(opts.input);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    const timeout = opts?.timeoutMs ?? 120_000;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ ok: false, stdout, stderr, error: `timeout after ${timeout}ms` });
    }, timeout);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        stdout,
        stderr,
        error: code === 0 ? undefined : `exit ${code}`,
      });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr, error: e?.message ?? String(e) });
    });
  });
}

// Self-invoking bootstrap: when run directly via `tsx agents/self-improve-loop.ts`,
// execute one bounded cycle and exit with the cycle's status code.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === pathResolve(process.argv[1]);
if (isMain) {
  (async () => {
    try {
      const scope = process.argv.slice(2);
      const result = await runSelfImproveCycle({ scope });
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(result));
      process.exit(result.ok ? 0 : 1);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e?.stack ?? String(e));
      process.exit(1);
    }
  })();
}
