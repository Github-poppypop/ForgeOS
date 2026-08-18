import { describe, test, expect } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentsDir = join(__dirname, "..");

describe("agents/self-improve-loop smoke", () => {
  test("self-improve-loop.ts exists", () => {
    expect(existsSync(join(agentsDir, "self-improve-loop.ts"))).toBe(true);
  });
  test("verify-improvements.ts exists", () => {
    expect(existsSync(join(agentsDir, "verify-improvements.ts"))).toBe(true);
  });
  test("agents package.json exists", () => {
    expect(existsSync(join(agentsDir, "package.json"))).toBe(true);
  });
});
