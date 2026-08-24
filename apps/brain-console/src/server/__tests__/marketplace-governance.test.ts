import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import { createRuntime } from "../runtime";

// Real HTTP coverage for marketplace governance:
//   #41 listing review/approval workflow  (POST /api/marketplace/approvals[/:id/decision])
//   #42 capability compatibility gate     (POST /api/marketplace/compat, install 409)
//   #43 publisher analytics               (GET  /api/marketplace/analytics)
// The registry and store persist to disk, so every test uses a unique suffix.

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
const incompatibleName = `gate-incompatible-${suffix}`;
const compatibleName = `gate-compatible-${suffix}`;
const engineName = `gate-engine-${suffix}`;

describe("apps/brain-console marketplace governance (#41/#42/#43)", () => {
  let server: http.Server;
  let port = 0;

  before(async () => {
    const app = express();
    app.use(await createRuntime());
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    port = (server.address() as { port: number }).port;
  });

  after(() => {
    server.close();
  });

  const request = (
    method: string,
    urlPath: string,
    body?: unknown,
  ): Promise<{ status: number; body: any }> =>
    new Promise((resolve, reject) => {
      const url = new URL(urlPath, `http://127.0.0.1:${port}/`);
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method,
          headers: payload
            ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) }
            : {},
        },
        (res) => {
          let raw = "";
          res.on("data", (c) => (raw += c));
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : null });
            } catch {
              resolve({ status: res.statusCode ?? 0, body: raw });
            }
          });
        },
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });

  // ── #42 compatibility gate ────────────────────────────────────────────────
  it("publishes a plugin that declares unmet capabilities", async () => {
    const { status, body } = await request("POST", "/api/marketplace", {
      name: incompatibleName,
      version: "1.0.0",
      author: `pub-a-${suffix}`,
      requires: ["console:panels", "gpu:cuda"],
    });
    assert.equal(status, 201);
    assert.deepEqual(body.plugin.requires, ["console:panels", "gpu:cuda"]);
  });

  it("blocks install with 409 when a required capability is missing", async () => {
    const { status, body } = await request("POST", `/api/marketplace/${incompatibleName}/install`, {});
    assert.equal(status, 409);
    assert.equal(body.installed, false);
    assert.equal(body.compatible, false);
    assert.ok(body.compat.missingCapabilities.includes("gpu:cuda"));
    assert.equal(body.compat.checks.find((c: any) => c.id === "capabilities").ok, false);
  });

  it("allows the blocked install through with force:true", async () => {
    const { status, body } = await request("POST", `/api/marketplace/${incompatibleName}/install`, { force: true });
    assert.equal(status, 200);
    assert.equal(body.installed, true);
    assert.equal(body.forced, true);
  });

  it("installs a plugin whose required capabilities the host provides", async () => {
    const published = await request("POST", "/api/marketplace", {
      name: compatibleName,
      version: "2.1.0",
      author: `pub-b-${suffix}`,
      requires: ["console:panels", "storage:local"],
      engines: { forgeos: ">=1.0.0" },
    });
    assert.equal(published.status, 201);
    const { status, body } = await request("POST", `/api/marketplace/${compatibleName}/install`, {});
    assert.equal(status, 200);
    assert.equal(body.installed, true);
    assert.equal(body.compat.compatible, true);
  });

  it("blocks install when the host engine is below the declared range", async () => {
    await request("POST", "/api/marketplace", {
      name: engineName,
      version: "1.0.0",
      author: `pub-b-${suffix}`,
      engines: { forgeos: ">=99.0.0" },
    });
    const { status, body } = await request("POST", `/api/marketplace/${engineName}/install`, {});
    assert.equal(status, 409);
    assert.equal(body.compat.checks.find((c: any) => c.id === "engine").ok, false);
  });

  it("POST /api/marketplace/compat evaluates an ad-hoc descriptor", async () => {
    const { status, body } = await request("POST", "/api/marketplace/compat", {
      name: "ad-hoc",
      version: "1.0.0",
      requires: ["net:fetch"],
    });
    assert.equal(status, 200);
    assert.equal(body.compatible, true);
    assert.equal(body.message, "Compatible");
    assert.equal(body.resolvedFromRegistry, false);
    assert.ok(Array.isArray(body.checks));
  });

  it("POST /api/marketplace/compat resolves declarations from the registry", async () => {
    const { status, body } = await request("POST", "/api/marketplace/compat", { name: incompatibleName });
    assert.equal(status, 200);
    assert.equal(body.resolvedFromRegistry, true);
    assert.equal(body.compatible, false);
    assert.ok(body.reasons.length > 0);
  });

  it("keeps the legacy compat contract for a bad version", async () => {
    const { status, body } = await request("POST", "/api/marketplace/compat", { name: "x", version: "nope" });
    assert.equal(status, 200);
    assert.equal(body.compatible, false);
    assert.match(body.message, /Incompatible/);
  });

  // ── #41 approval workflow ─────────────────────────────────────────────────
  let submissionId = 0;

  it("submits a listing for review", async () => {
    const { status, body } = await request("POST", "/api/marketplace/approvals", {
      package: compatibleName,
      version: "2.1.0",
      requested_by: "CTO",
      reason: "new panel surface",
    });
    assert.equal(status, 201);
    assert.equal(body.submitted, true);
    assert.equal(body.submission.status, "pending");
    submissionId = Number(body.submission.id);
    assert.ok(submissionId > 0);
  });

  it("rejects a duplicate pending submission with 409", async () => {
    const { status, body } = await request("POST", "/api/marketplace/approvals", {
      package: compatibleName,
      requested_by: "CTO",
    });
    assert.equal(status, 409);
    assert.equal(body.submitted, false);
  });

  it("requires package and requested_by", async () => {
    const { status } = await request("POST", "/api/marketplace/approvals", { package: "" });
    assert.equal(status, 400);
  });

  it("validates the decision verb", async () => {
    const { status } = await request("POST", `/api/marketplace/approvals/${submissionId}/decision`, {
      decision: "maybe",
    });
    assert.equal(status, 400);
  });

  it("approves a pending submission and records the reviewer", async () => {
    const { status, body } = await request("POST", `/api/marketplace/approvals/${submissionId}/decision`, {
      decision: "approve",
      reviewer: "CEO",
      note: "looks good",
    });
    assert.equal(status, 200);
    assert.equal(body.decided, true);
    assert.equal(body.submission.status, "approved");
    assert.equal(body.submission.reviewer, "CEO");
    assert.ok(body.submission.decided_at);
  });

  it("refuses to decide the same submission twice", async () => {
    const { status, body } = await request("POST", `/api/marketplace/approvals/${submissionId}/decision`, {
      decision: "reject",
      reviewer: "CEO",
    });
    assert.equal(status, 409);
    assert.equal(body.decided, false);
    assert.match(body.error, /already approved/);
  });

  it("404s on an unknown submission", async () => {
    const { status } = await request("POST", "/api/marketplace/approvals/99999999/decision", { decision: "approve" });
    assert.equal(status, 404);
  });

  it("blocks approving a listing whose plugin is incompatible", async () => {
    const submitted = await request("POST", "/api/marketplace/approvals", {
      package: engineName,
      requested_by: "CTO",
    });
    assert.equal(submitted.status, 201);
    const id = Number(submitted.body.submission.id);
    const blocked = await request("POST", `/api/marketplace/approvals/${id}/decision`, {
      decision: "approve",
      reviewer: "CEO",
    });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.decided, false);
    assert.match(blocked.body.error, /cannot approve/);

    // Rejecting an incompatible listing is always allowed.
    const rejected = await request("POST", `/api/marketplace/approvals/${id}/decision`, {
      decision: "reject",
      reviewer: "CEO",
      note: "engine too new",
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.submission.status, "rejected");
  });

  it("GET /api/marketplace/approvals filters by status and reports counts", async () => {
    const all = await request("GET", "/api/marketplace/approvals");
    assert.equal(all.status, 200);
    assert.ok(Array.isArray(all.body.submissions));
    assert.deepEqual(all.body.statuses, ["pending", "approved", "rejected"]);
    assert.ok((all.body.counts.approved ?? 0) >= 1);

    const approved = await request("GET", "/api/marketplace/approvals?status=approved");
    assert.equal(approved.status, 200);
    assert.ok(approved.body.submissions.every((s: any) => s.status === "approved"));
    assert.ok(approved.body.submissions.some((s: any) => Number(s.id) === submissionId));
  });

  // ── #43 publisher analytics ───────────────────────────────────────────────
  it("GET /api/marketplace/analytics rolls up real registry data per publisher", async () => {
    const { status, body } = await request("GET", "/api/marketplace/analytics");
    assert.equal(status, 200);
    assert.ok(body.stats && typeof body.stats === "object", "legacy stats preserved");
    assert.ok(Array.isArray(body.publishers));

    const pubB = body.publishers.find((p: any) => p.author === `pub-b-${suffix}`);
    assert.ok(pubB, "publisher row present");
    assert.ok(pubB.plugins.includes(compatibleName));
    assert.equal(pubB.versions >= 2, true);
    assert.equal(pubB.installs >= 1, true);
    assert.ok(pubB.lastPublished);
    assert.ok(pubB.avgRating >= 0 && pubB.avgRating <= 5);

    assert.equal(body.totals.publishers, body.publishers.length);
    assert.ok(body.totals.versions >= body.totals.plugins);
    assert.ok(body.totals.installs >= 1);
    assert.equal(typeof body.totals.pendingApprovals, "number");
  });

  it("publishers are sorted by downloads descending", async () => {
    const { body } = await request("GET", "/api/marketplace/analytics");
    const downloads = body.publishers.map((p: any) => p.downloads);
    const sorted = [...downloads].sort((a: number, b: number) => b - a);
    assert.deepEqual(downloads, sorted);
  });
});
