# Video Tutorial Script — ForgeOS Setup

**Length:** 6–8 minutes  
**Audience:** New operators, developers, C-suite admins  
**Style:** Walkthrough + screencast with voice-over  
**Props:** Windows machine, terminal, browser

---

## Scene 1 — Intro (0:00–0:45)

| Time | Visual | Audio |
|------|--------|-------|
| 0:00 | Fade in on ForgeOS logo + tagline: *"Governed AI for the whole org."* | "Welcome to ForgeOS. In this video you will bootstrap the Brain Console, connect Ollama, and verify the stack in under ten minutes." |
| 0:15 | Host face-to-camera (or avatar) in front of a clean desktop. | "ForgeOS is not just another chatbot. It is a governed multi-agent platform with a local brain, C-suite roles, and an immutable constitution." |
| 0:35 | Screen transitions to Windows Terminal with PowerShell open. | "Let's start with prerequisites: Bun, Git, and Ollama." |

---

## Scene 2 — Prerequisites (0:45–1:45)

| Time | Visual | Audio |
|------|--------|-------|
| 0:45 | Type `bun --version` in terminal. | "First, Bun. ForgeOS is built on Bun for speed and native TypeScript support." |
| 0:55 | Show Bun install prompt if missing: `powershell -c "irm bun.sh/install.ps1 | iex"`. | "If you don't have it, install it with one line from the official script." |
| 1:05 | Type `git --version` and `ollama --version`. | "Git for cloning the repo, and Ollama for local embeddings. We use `mxbai-embed-large` at 1024 dimensions." |
| 1:25 | Show `ollama pull mxbai-embed-large` running. | "Pull the embedding model now so it's ready when the brain starts." |

---

## Scene 3 — Clone & boot (1:45–3:15)

| Time | Visual | Audio |
|------|--------|-------|
| 1:45 | Type `git clone https://github.com/forgeos/forgeos.git && cd forgeos`. | "Clone the monorepo. The Brain Console lives in `apps/brain-console`." |
| 1:55 | `cd apps/brain-console` | "Change into the app directory." |
| 2:00 | Show `GBRAIN_HOME` and `GBRAIN_CWD` environment variables in `server.ts`. | "Two environment variables matter: `GBRAIN_HOME` points to the brain vault, and `GBRAIN_CWD` points to the gbrain CLI install." |
| 2:20 | Type `setx GBRAIN_HOME "C:\ForgeOS"` and `setx GBRAIN_CWD "C:\Users\pop\forge-gbrain"` (or edit `.env`). | "Set them now. On Windows, `setx` writes to user env so the Task Scheduler can pick them up." |
| 2:40 | Run `bun run server.ts` in a new terminal tab. | "Start the server. It binds to `:7777` by default." |
| 2:55 | Show browser at `http://127.0.0.1:7777` loading the SPA. | "Open your browser. You should see the Brain Console UI within a second or two." |

---

## Scene 4 — Verify (3:15–4:30)

| Time | Visual | Audio |
|------|--------|-------|
| 3:15 | Open DevTools → Network tab. Refresh the page. | "Let's verify the backend is healthy." |
| 3:25 | Show `GET /api/health` returning `200` with `{ ok: true }`. | "/api/health is a lightweight ping — no gbrain dependency." |
| 3:35 | Show `GET /api/status` returning gbrain + ollama status. | "/api/status confirms the brain engine is `pglite`, Ollama is reachable, and embeddings are online." |
| 3:50 | Show `GET /api/governance` returning the file tree. | "The governance index shows your constitution, laws, standards, and RFCs." |
| 4:05 | Show `GET /api/roles` returning 7 C-suite roles. | "Roles are loaded from the brain. If you see the C-suite table, the brain is seeded correctly." |

---

## Scene 5 — Auth & hardening (4:30–5:45)

| Time | Visual | Audio |
|------|--------|-------|
| 4:30 | Edit `server.ts` or set `CONSOLE_TOKEN` env var. | "For production, enable the auth gate. Set `CONSOLE_TOKEN` to a strong random string." |
| 4:45 | Restart server. Show `401` on `/api/health` without token, then `200` with `Authorization: Bearer <token>`. | "All `/api/` routes now require a bearer token. The SPA reads it from `localStorage` or prompts you." |
| 5:05 | Show Task Scheduler → create task `ForgeOSBrainConsole` with `bun run server.ts` on logon. | "Auto-start on boot is a one-time Task Scheduler setup. Set it to run whether you are logged on or not." |
| 5:30 | Reboot VM or simulate logon. Show server auto-starts and `:7777` is listening. | "After a reboot, the console comes up automatically. No manual intervention needed." |

---

## Scene 6 — Wrap (5:45–6:30)

| Time | Visual | Audio |
|------|--------|-------|
| 5:45 | Host back on camera. | "You now have a local, governed AI brain with semantic search, mission tracking, and agent dispatch." |
| 6:00 | Show the Roadmap in the UI (timeline panel). | "Next up: watch the Agent Dispatch tutorial to see how to launch a C-suite agent on a mission." |
| 6:15 | End screen with links: `docs/developers/`, `docs/tutorials/`, Discord / GitHub. | "Thanks for watching. Star the repo, open an RFC, or join the community." |

---

## Production notes

- Record at 1080p 30fps minimum.
- Use a clean Windows 11 VM to avoid personal data leaks.
- Mute notifications and disable startup sounds.
- Add chapter markers in YouTube description for fast navigation.
