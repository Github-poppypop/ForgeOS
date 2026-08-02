# Developer Guide — Plugins

**Owner:** CTO · **Status:** Draft  
**Purpose:** Extend the Brain Console UI and API with first-party or community plugins.

---

## What is a plugin?

A plugin is a self-contained bundle that adds panels, API routes, or sidebar
commands to the Brain Console SPA. Plugins run in the same Bun server process
and share the `gbrain` mutex, so they must be well-behaved citizens:
no unbounded memory, no long blocking loops, and no writes to sacred governance
paths.

---

## Plugin manifest

Create a `plugin.json` in your plugin directory:

```json
{
  "id": "forgeos-plugin-poolleague",
  "name": "PoolLeague Bridge",
  "version": "0.1.0",
  "entry": "./src/index.ts",
  "panels": ["poolleague-bracket", "poolleague-live"],
  "commands": ["poolleague:refresh"],
  "permissions": ["api:read", "gbrain:capture"],
  "dependencies": ["gbrain"],
  "author": "cto/cto",
  "license": "MIT"
}
```

### Manifest fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique slug (`kebab-case`). |
| `entry` | yes | Relative path to the plugin bootstrap file. |
| `panels` | no | UI panel IDs this plugin registers. |
| `commands` | no | Sidebar commands this plugin exposes. |
| `permissions` | no | Capability grants; the console lints them at load time. |

---

## Lifecycle

1. **Discovery** — The console scans `plugins/` (or `marketplace/plugins/`) for
   directories containing `plugin.json`.
2. **Validation** — JSON schema check + permission lint.
3. **Bootstrap** — `entry` is imported as a Bun ESM module. It must export:
   - `init(console)` — called once with the console API handle.
   - `teardown()` — optional cleanup hook.
4. **Hot reload** — In `dev` mode, the console watches plugin files and re-runs
   `init` on change.

---

## Minimal plugin example

```ts
// plugins/hello-world/src/index.ts
export const id = "hello-world";
export const version = "0.1.0";

export function init(console: any) {
  console.onPanel("hello-world", () => {
    return `<div class="p-4"><h1>Hello from ${id}</h1></div>`;
  });

  console.onCommand("hello-world:ping", async () => {
    return { ok: true, pong: true };
  });
}

export function teardown() {
  // remove event listeners, cancel timers, etc.
}
```

---

## Panel API

Plugins receive a `console` handle with these methods:

- `console.onPanel(id, renderFn)` — Register a panel component. `renderFn`
  returns an HTML string (no framework — the SPA is hand-rolled).
- `console.onCommand(id, handler)` — Register a sidebar command.
- `console.gbrain(args)` — Run a `gbrain` CLI call (respects mutex).
- `console.api(path, opts)` — Call the console REST API from plugin code.

---

## Governance rules

- Plugins may **not** modify files under `governance/`.
- All `capture` writes are audited in the decision ledger automatically.
- Irreversible actions (delete, deploy, admin mutation) require a `permissions`
  entry of `admin:*` and must be reviewed by the owning C-suite agent.
- Plugins are signed by the repo owner (or a trusted maintainer) before they
  are loaded in production. Unsigned plugins load only in `dev` mode.

---

## Publishing

1. Add your plugin to `marketplace/plugins/` as a subdirectory.
2. Run `bun run scripts/lint-plugin.ts <path>`.
3. Open a PR against `main`. CMO/CPO review is required for public plugins.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `plugin.json` rejected | Run `bun run scripts/lint-plugin.ts .` to see schema errors. |
| Panel not showing | Check `console.log` in the browser; panels must return a string. |
| gbrain lockup | Your plugin is blocking the mutex. Use `await` and avoid sync loops. |
| Hot reload missed | Ensure your `entry` file is `.ts` and the watcher is active. |
