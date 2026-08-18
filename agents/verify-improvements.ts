/**
 * agents/verify-improvements.ts — Verify that worktree changes are safe.
 *
 * Runs tests and build in a given worktree/repo path and returns structured
 * results for the agent loop.
 */

import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

export interface VerifyResult {
  ok: boolean;
  testsOk: boolean;
  buildOk: boolean;
  testOutput?: string;
  buildOutput?: string;
  error?: string;
}

export async function verifyImprovements(repoPath: string): Promise<VerifyResult> {
  const tests = await runCommand("npm", ["test"], { cwd: repoPath, timeoutMs: 300_000 });
  const build = await runCommand("npm", ["run", "build"], { cwd: repoPath, timeoutMs: 300_000 });

  const result: VerifyResult = {
    ok: tests.ok && build.ok,
    testsOk: tests.ok,
    buildOk: build.ok,
    testOutput: [tests.stdout, tests.stderr].filter(Boolean).join("\n") || undefined,
    buildOutput: [build.stdout, build.stderr].filter(Boolean).join("\n") || undefined,
    error: !tests.ok ? tests.error : !build.ok ? build.error : undefined,
  };

  return result;
}

async function runCommand(cmd: string, args: string[], opts?: { cwd?: string; timeoutMs?: number }): Promise<{ ok: boolean; stdout: string; stderr: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts?.cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
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
