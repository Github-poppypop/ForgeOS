/**
 * src/server/__tests__/sse.test.ts — Real tests for the SSE hub module
 * (sse.ts): client add/remove lifecycle and broadcast frame formatting.
 *
 * The feature under test is the hub logic; the express `Response` is just a
 * writable sink, so each test uses a minimal controllable stub (write +
 * writableEnded) rather than mocking the hub itself.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSSEHub } from "../sse.js";

function makeRes() {
  let buf = "";
  const res: any = {
    writableEnded: false,
    write(chunk: string) {
      buf += chunk;
      return true;
    },
    setHeader() {},
    on() {},
    end() {
      this.writableEnded = true;
    },
  };
  return {
    res,
    written: () => buf,
    end: () => {
      res.writableEnded = true;
    },
  };
}

test("addClient then broadcast writes an SSE frame to that client", () => {
  const hub = createSSEHub();
  const c = makeRes();
  hub.addClient(c.res);
  hub.broadcast("tick", { n: 1 });
  const out = c.written();
  assert.ok(out.includes("event: tick"), "event line present");
  assert.ok(out.includes("data: " + JSON.stringify({ n: 1 })), "data line present");
  assert.ok(out.endsWith("\n\n"), "frame terminated");
});

test("removeClient stops receiving broadcasts", () => {
  const hub = createSSEHub();
  const c = makeRes();
  hub.addClient(c.res);
  hub.removeClient(c.res);
  hub.broadcast("tick", { n: 2 });
  assert.equal(c.written(), "", "removed client receives nothing");
});

test("broadcast skips clients whose response already ended", () => {
  const hub = createSSEHub();
  const c = makeRes();
  hub.addClient(c.res);
  c.end();
  hub.broadcast("tick", { n: 3 });
  assert.equal(c.written(), "", "ended client skipped");
});
