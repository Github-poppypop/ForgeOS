// Minimal, dependency-free WebSocket sync hub for real-time brain sync.
//
// The 'ws' package is NOT installed in this worktree, and the task forbids
// adding new dependencies. So this implements a tiny RFC 6455 WebSocket
// server using only Node.js built-ins (node:crypto, node:http, node:net).
//
// It exposes a real `ws://<host>/ws` endpoint. When a client connects it
// immediately receives a `hello` frame (heartbeat handshake) and, every 25s,
// a `heartbeat` frame. Callers invoke `syncHub.sync("capture", detail)` (or
// "apps") from relevant POST endpoints to push a `sync` event to all clients.

import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";
import type { Socket } from "node:net";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

type SyncDetail = unknown;

interface Client {
  id: string;
  socket: Socket;
}

class SyncHub {
  private clients = new Set<Client>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  /** Attach to an existing http.Server so it can upgrade /ws connections. */
  attach(server: Server): void {
    server.on("upgrade", (req: IncomingMessage, socket: Socket, _head: Buffer) => {
      this.handleUpgrade(req, socket);
    });
    if (!this.heartbeat) {
      this.heartbeat = setInterval(() => {
        this.broadcast({ type: "heartbeat", ts: Date.now(), clients: this.clients.size });
      }, 25000);
    }
  }

  private handleUpgrade(req: IncomingMessage, socket: Socket): void {
    const url = req.url ?? "";
    // Only handle our own endpoint; leave other upgrades (e.g. Vite HMR) alone.
    if (!url.startsWith("/ws")) return;

    const key = req.headers["sec-websocket-key"];
    const upgrade = String(req.headers["upgrade"] ?? "").toLowerCase();
    if (!key || upgrade !== "websocket") {
      socket.destroy();
      return;
    }

    const accept = createHash("sha1").update(key + WS_GUID).digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n` +
        "\r\n"
    );

    const client: Client = { id: randomUUID(), socket };
    this.clients.add(client);

    socket.on("data", (chunk: Buffer) => this.onData(client, chunk));
    const cleanup = () => this.clients.delete(client);
    socket.on("close", cleanup);
    socket.on("error", cleanup);

    // Immediate hello/heartbeat so the client knows the connection is live.
    this.send(client, { type: "hello", ts: Date.now(), clients: this.clients.size });
  }

  // Minimal inbound frame parser: handle close (0x8) and ping (0x9); ignore the rest.
  private onData(client: Client, chunk: Buffer): void {
    let offset = 0;
    while (offset + 2 <= chunk.length) {
      const b0 = chunk[offset];
      const b1 = chunk[offset + 1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let p = offset + 2;
      if (len === 126) {
        if (p + 2 > chunk.length) break;
        len = chunk.readUInt16BE(p);
        p += 2;
      } else if (len === 127) {
        if (p + 8 > chunk.length) break;
        len = Number(chunk.readBigUInt64BE(p));
        p += 8;
      }
      if (masked) {
        if (p + 4 > chunk.length) break;
        p += 4; // client frames are masked; we only need to skip the payload
      }
      if (p + len > chunk.length) break; // frame spans multiple chunks; wait for more
      if (opcode === 0x8) {
        client.socket.destroy();
        return;
      }
      if (opcode === 0x9) {
        // Reply to ping with an unmasked pong (0xA).
        client.socket.write(Buffer.from([0x8a, 0x00]));
      }
      offset = p + len;
    }
  }

  private send(client: Client, payload: unknown): void {
    try {
      const data = Buffer.from(JSON.stringify(payload), "utf8");
      client.socket.write(encodeTextFrame(data));
    } catch {
      this.clients.delete(client);
    }
  }

  /** Send a payload to every connected client. */
  broadcast(payload: unknown): void {
    for (const client of this.clients) this.send(client, payload);
  }

  /** Emit a 'sync' event to all connected clients. */
  sync(event: string, detail: SyncDetail = null): void {
    this.broadcast({
      type: "sync",
      event,
      detail,
      ts: Date.now(),
      clients: this.clients.size,
    });
  }

  /** Stop the heartbeat interval and tear down all client sockets. Used for
   *  graceful shutdown and in tests so the singleton does not keep the event
   *  loop (and therefore the test process) alive after a suite finishes. */
  stop(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    for (const client of this.clients) {
      try {
        client.socket.destroy();
      } catch {
        /* ignore */
      }
    }
    this.clients.clear();
  }
}

// Encode a single unmasked text frame (server -> client).
function encodeTextFrame(data: Buffer): Buffer {
  const length = data.length;
  let header: Buffer;
  if (length < 126) {
    header = Buffer.from([0x81, length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(length, 6);
  }
  return Buffer.concat([header, data]);
}

export const syncHub = new SyncHub();
