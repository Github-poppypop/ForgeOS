import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentsDir = join(__dirname, "..");

describe("agents/verify-improvements smoke", () => {
  test("verify-improvements.ts exists", () => {
    assert.ok(existsSync(join(agentsDir, "verify-improvements.ts")));
  });
});
