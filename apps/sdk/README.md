# ForgeOS External App SDK

Build external apps that integrate with the ForgeOS Brain Console.

## Installation

```bash
# From the ForgeOS repo root
cd apps/sdk
bun install
```

## Usage

```ts
import { createForgeOSClient } from "@forgeos/sdk";

const client = createForgeOSClient({
  baseUrl: "http://localhost:7777",
  token: process.env.FORGEOS_TOKEN,
  apiVersion: "v2",
});

// Health check
await client.health();

// Discover remote brains
const { remote_brains } = await client.listRemoteBrains();

// List missions
const { missions } = await client.listMissions();

// Subscribe to webhooks
await client.createWebhook({
  url: "https://your-app.com/webhook",
  events: ["mission.updated", "agent.completed"],
  secret: "your-webhook-secret",
});

// Dispatch an agent
await client.dispatchAgent({ missionId: "RFC-0000", agent: "my-agent" });
```

## API Versioning

The SDK supports `v1` and `v2`. Default is `v2`. Set `apiVersion: "v1"` to use the deprecated v1 endpoints (sunset date: 2026-09-01).

## Plugin System

External modules placed in `C:\ForgeOS\plugins\` are auto-loaded by the Brain Console.

```ts
// C:\ForgeOS\plugins\my-plugin.ts
import { defineForgeOSPlugin } from "../../apps/sdk/src/index.ts";

export default defineForgeOSPlugin({
  name: "my-plugin",
  version: "1.0.0",
  routes: {
    "/api/plugin/hello": "GET",
  },
});
```

## Webhook Events

- `mission.created`
- `mission.updated`
- `agent.started`
- `agent.completed`
- `agent.failed`

## License

MIT
