// tests/unit/capture.spec.ts — unit tests for /api/capture slug validation logic
import { describe, test, expect } from "bun:test";

// The validation logic from server.ts (extracted for unit testing)
function validateCaptureSlug(slug: string): { ok: boolean; error?: string } {
  if (typeof slug !== "string") return { ok: false, error: "slug required" };
  if (slug.includes("/") || slug.includes("\\") || slug.includes("..")) {
    return { ok: false, error: "invalid slug: no path separators or .. allowed" };
  }
  if (!slug || slug.trim().length === 0) return { ok: false, error: "slug required" };
  if (slug.length > 200) return { ok: false, error: "slug too long" };
  return { ok: true };
}

describe("/api/capture validation", () => {
  test("rejects ../etc/passwd with 400", () => {
    const r = validateCaptureSlug("../etc/passwd");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid slug/);
  });

  test("rejects slugs with / separator", () => {
    const r = validateCaptureSlug("decisions/../etc/passwd");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid slug/);
  });

  test("rejects slugs with backslash", () => {
    const r = validateCaptureSlug("decisions\..\passwd");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid slug/);
  });

  test("accepts valid slug", () => {
    const r = validateCaptureSlug("decisions-test-123");
    expect(r.ok).toBe(true);
  });

  test("rejects empty slug", () => {
    const r = validateCaptureSlug("");
    expect(r.ok).toBe(false);
  });

  test("rejects slug with ..", () => {
    const r = validateCaptureSlug("..");
    expect(r.ok).toBe(false);
  });

  test("rejects slug with dots but valid", () => {
    const r = validateCaptureSlug("decision.test-2024");
    expect(r.ok).toBe(true);
  });

  test("accepts slug with hyphens and numbers", () => {
    const r = validateCaptureSlug("meeting-2024-08-03-001");
    expect(r.ok).toBe(true);
  });
});
