/**
 * agents/__tests__/schema-validator.test.ts — tests for agents/schema-validator.ts
 *
 * Uses node:test so it runs locally via `npx tsx --test` and is also accepted
 * by Bun (which implements node:test). Backlog item #24
 * ("Structured agent output schema validation").
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { schemaValidator, SchemaValidator } from "../schema-validator";

describe("agents/schema-validator", () => {
  it("validates an object against a named schema", () => {
    schemaValidator.register("package", {
      type: "object",
      required: ["name", "version"],
      properties: { name: { type: "string" }, version: { type: "string" } },
    });
    const result = schemaValidator.validate("package", { name: "test", version: "1.0.0" });
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.errors, []);
  });

  it("reports missing required fields", () => {
    schemaValidator.register("package-required", {
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" } },
    });
    const result = schemaValidator.validate("package-required", {});
    assert.strictEqual(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.message.includes("Missing required property: name")),
      `expected a missing-required error, got: ${JSON.stringify(result.errors)}`
    );
  });

  it("returns an error for an unknown schema name", () => {
    const result = schemaValidator.validate("does-not-exist", { a: 1 });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes("Unknown schema")));
  });

  it("flags a type mismatch", () => {
    schemaValidator.register("num-field", {
      type: "object",
      properties: { count: { type: "integer" } },
    });
    const result = schemaValidator.validate("num-field", { count: "not-a-number" });
    assert.strictEqual(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.path === "count" && e.message.includes("integer")),
      `expected integer type error at count, got: ${JSON.stringify(result.errors)}`
    );
  });

  it("validates array items and minItems", () => {
    schemaValidator.register("str-list", {
      type: "array",
      items: { type: "string" },
      minItems: 1,
    });
    const empty = schemaValidator.validate("str-list", []);
    assert.strictEqual(empty.valid, false);
    const mixed = schemaValidator.validate("str-list", ["ok", 5]);
    assert.strictEqual(mixed.valid, false);
    const good = schemaValidator.validate("str-list", ["ok"]);
    assert.strictEqual(good.valid, true);
  });

  it("rejects additional properties when disallowed", () => {
    schemaValidator.register("closed", {
      type: "object",
      properties: { a: { type: "string" } },
      additionalProperties: false,
    });
    const result = schemaValidator.validate("closed", { a: "x", b: "y" });
    assert.strictEqual(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.message.includes("Additional property not allowed: b"))
    );
  });

  it("enforces enum constraints", () => {
    schemaValidator.register("status-only", {
      type: "object",
      required: ["status"],
      properties: { status: { enum: ["ok", "failed"] } },
    });
    const bad = schemaValidator.validate("status-only", { status: "maybe" });
    assert.strictEqual(bad.valid, false);
    const good = schemaValidator.validate("status-only", { status: "ok" });
    assert.strictEqual(good.valid, true);
  });

  it("validates the pre-registered agent-result schema", () => {
    const result = schemaValidator.validate("agent-result", {
      agentId: "agent-1",
      status: "ok",
      output: "done",
      tokensUsed: 12,
    });
    assert.strictEqual(result.valid, true);
    const bad = schemaValidator.validate("agent-result", {
      agentId: "agent-1",
      status: "nope",
      output: "done",
    });
    assert.strictEqual(bad.valid, false);
  });

  it("supports independent instances via the constructor", () => {
    const v = new SchemaValidator();
    v.register("thing", {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } },
    });
    assert.strictEqual(v.validate("thing", { id: "x" }).valid, true);
    assert.strictEqual(v.validate("thing", {}).valid, false);
  });
});
