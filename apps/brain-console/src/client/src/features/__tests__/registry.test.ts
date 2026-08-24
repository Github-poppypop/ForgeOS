/**
 * src/client/src/features/__tests__/registry.test.ts — Real tests for the
 * client feature-discovery registry (registry.ts). Under tsx/Node,
 * import.meta.glob is undefined so FEATURES is empty and the registry safely
 * degrades; this asserts that documented contract.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FEATURES, findFeature, featureSidebar, featureLabel } from "../registry.js";

test("FEATURES is an array (empty under Node where import.meta.glob is absent)", () => {
  assert.ok(Array.isArray(FEATURES));
  assert.equal(FEATURES.length, 0, "no features discovered without Vite glob");
});

test("findFeature returns undefined when no features are registered", () => {
  assert.equal(findFeature("/feature/hello"), undefined);
});

test("featureSidebar returns an empty list under Node", () => {
  const sb = featureSidebar();
  assert.ok(Array.isArray(sb));
  assert.equal(sb.length, 0);
});

test("featureLabel falls back to the de-slashed path for unknown routes", () => {
  assert.equal(featureLabel("/feature/webhooks"), "feature/webhooks");
  assert.equal(featureLabel("/x/y/z"), "x/y/z");
});
