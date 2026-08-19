# feat-missionsched

> Server feature — `src/server/features/feat-missionsched.ts`

Server feature: Mission Scheduler store + management API. Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts. This is the schedule store that feat-missionsched-exec.ts imports to fire enabled schedules on a tick. Schedules persist to data/missions-schedule.json (gitignored runtime artifact, like store.json / webhooks.json).

## Endpoints

| Method | Path |
|--------|------|
| GET | `/api/missions/schedule` |
| POST | `/api/missions/schedule` |
| PUT | `/api/missions/schedule/:id` |
| DELETE | `/api/missions/schedule/:id` |

---

_Auto-generated from source. Edit the module to change behaviour._
