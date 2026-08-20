/**
 * __tests__/bootstrap-org.test.ts — Real tests for the org-bootstrapping
 * script logic (scripts/bootstrap-org.ts): the minimal YAML parser, the
 * frontmatter renderer, and the role/org page builders. Pure string functions
 * — no filesystem side effects.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSimpleYaml, frontmatter, rolePage, orgPage, type RoleDef } from "../bootstrap-org.js";

test("parseSimpleYaml parses top-level key: value pairs", () => {
  const out = parseSimpleYaml("name: ForgeOS\nversion: 1.0.0\nenabled: true");
  assert.equal(out.name, "ForgeOS");
  assert.equal(out.enabled, true, "booleans coerced");
  assert.ok("version" in out, "version key present");
});

test("frontmatter wraps metadata in a YAML block", () => {
  const fm = frontmatter({ id: "x", type: "role", n: 3 });
  assert.ok(fm.startsWith("---\n"), "opens with ---");
  assert.ok(fm.includes("id: x"));
  assert.ok(fm.includes("type: role"));
  assert.ok(fm.includes("n: 3"), "numbers JSON-stringified");
  assert.ok(fm.trimEnd().endsWith("---"), "closes with ---");
});

test("rolePage builds a role page with title, reportsTo, and authority tier", () => {
  const role: RoleDef = {
    id: "cto",
    title: "Chief Technology Officer",
    reportsTo: "CEO",
    owns: ["platform", "security"],
    domain: "engineering",
    description: "Owns the tech stack.",
    authorityTier: "admin",
  };
  const page = rolePage(role);
  assert.ok(page.includes("type: role"), "role frontmatter");
  assert.ok(page.includes("id: role-cto"), "namespaced id");
  assert.ok(page.includes("Chief Technology Officer"), "title present");
  assert.ok(page.includes("Reports to:** CEO"), "reports-to rendered");
  assert.ok(page.includes("tier **admin**"), "authority tier rendered");
});

test("orgPage builds the org scaffold with type: org", () => {
  const page = orgPage();
  assert.ok(page.includes("type: org"), "org frontmatter");
  assert.ok(page.includes("ForgeOS Org"), "org name");
  assert.ok(page.includes("Operational Discipline"), "body content");
});
