# Video Tutorial Script — Agent Dispatch

**Length:** 7–9 minutes  
**Audience:** Operators, PMs, engineers running missions  
**Style:** Interactive screencast + diagram overlays  
**Props:** Brain Console UI, terminal, tmux session viewer

---

## Scene 1 — Intro (0:00–0:50)

| Time | Visual | Audio |
|------|--------|-------|
| 0:00 | Fade in on Mission Center panel showing 3 missions. | "In this tutorial you will dispatch a C-suite agent to a mission, watch its live logs, and advance the mission through the governance lifecycle." |
| 0:20 | Overlay diagram: *Mission → Dispatch → tmux → Log → Decision*. | "Agent dispatch is the operational heart of ForgeOS. It connects human strategy to machine execution." |
| 0:40 | Browser focused on `http://127.0.0.1:7777` Mission Center. | "Open the Brain Console and go to Missions." |

---

## Scene 2 — Create a mission (0:50–2:00)

| Time | Visual | Audio |
|------|--------|-------|
| 0:50 | Show Missions panel with `RFC-0000` (done), `POOL-E1` (proposed), `POOL-SUB` (approved). | "Every agent needs a mission. Missions are tracked in the in-memory store and can also be persisted to the brain." |
| 1:05 | Use `PATCH /api/missions/POOL-E1` with body `{ "status": "approved", "progress": 5 }`. | "Advance a mission from `proposed` to `approved` via the API. The status ladder is fixed: proposed → approved → executing → review → done." |
| 1:30 | Show the mission card updating in real time. | "The UI polls and reflects the new status immediately." |

---

## Scene 3 — Dispatch the agent (2:00–3:45)

| Time | Visual | Audio |
|------|--------|-------|
| 2:00 | Click **Dispatch** on `POOL-E1`, select agent `cto/cto`. | "Click Dispatch and pick an agent. The console will POST to `/api/agent/dispatch`." |
| 2:15 | Show curl: `curl -X POST http://127.0.0.1:7777/api/agent/dispatch -H "Authorization: Bearer $TOKEN" -d '{"missionId":"POOL-E1","agent":"cto/cto"}'`. | "Under the hood, the server creates a tmux session named `agent-POOL-E1-<timestamp>` and tails its log." |
| 2:40 | Show terminal: `tmux ls` revealing the new session. | "The session is detached. You can attach to it for live debugging, or let the console stream the log." |
| 3:00 | Open `/api/agent/POOL-E1/log` — show initial log lines. | "The log endpoint returns the last 50 lines. New lines appear as the agent writes them." |
| 3:25 | Show the mission card flipping to `agentState: running`. | "The console flips the in-memory state from `pending` to `running` once tmux confirms the session started." |

---

## Scene 4 — Live monitoring (3:45–5:30)

| Time | Visual | Audio |
|------|--------|-------|
| 3:45 | Open a second browser tab on `/api/agent/POOL-E1/log` and refresh every 5s. | "You can poll the log endpoint, or use the SSE health stream for a live heartbeat." |
| 4:05 | Show a fake agent script writing to stdout: `echo "running checks..."` in tmux. | "Agents can be any executable: a Python script, a Node worker, or a shell pipeline. The console only cares about the exit code and stdout." |
| 4:30 | Log shows `[2026-08-02T...] tmux session started`. | "Each log line is timestamped and capped at 500 lines in memory." |
| 4:50 | Simulate agent finishing: tmux exits 0. Log shows `done`. | "When the tmux session exits cleanly, the state becomes `done`. Non-zero exits become `failed`." |
| 5:10 | Show decision page captured in brain: `decisions/agent-dispatch-POOL-E1-<ts>`. | "A decision record is automatically captured so the governance ledger has an immutable trace." |

---

## Scene 5 — Governance handoff (5:30–6:45)

| Time | Visual | Audio |
|------|--------|-------|
| 5:30 | Open `/api/ledger` and `/api/timeline`. | "Every dispatch writes to the decision ledger. The timeline shows mission milestones." |
| 5:45 | Show `PATCH /api/missions/POOL-E1` to `review` then `done`. | "After the agent completes, a human owner advances the mission. No agent can mark itself `done` without human sign-off." |
| 6:10 | Show the full lifecycle: proposed → approved → executing → review → done. | "This human-in-the-loop gate is what makes ForgeOS governed AI, not just autonomous chaos." |
| 6:30 | Host back on camera. | "You have seen the full dispatch loop: create, approve, launch, monitor, and close." |

---

## Scene 6 — Wrap (6:45–7:30)

| Time | Visual | Audio |
|------|--------|-------|
| 6:45 | Show Governance Workflow tutorial thumbnail. | "Next, learn how proposals become ratified law in the Governance Workflow tutorial." |
| 7:00 | End screen with links. | "Star the repo, read the agent spec, and open your first mission." |

---

## Production notes

- Record the terminal in 4K if possible; text must be readable on mobile.
- Use `tmux -f /dev/null` to avoid loading user config during the demo.
- Mute `tmux` bell and visual-activity flags for clean screencasts.
