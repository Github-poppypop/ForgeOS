import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { findDuplicates } from "../duplicates";

describe("knowledge-universe/duplicates smoke", () => {
  it("returns an array for a directory", () => {
    const groups = findDuplicates(".");
    assert.ok(Array.isArray(groups));
  });
});
