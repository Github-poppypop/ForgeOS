# feat-missionsched-exec

> Server feature — `src/server/features/feat-missionsched-exec.ts`

Server feature: Mission Scheduler EXECUTION engine. Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts.  Imports the schedule store from feat-missionsched.ts and, on module load, starts a 30s tick (.unref()'d so it never blocks process exit) that scans every enabled schedule whose nextRun <= now and fires it: POSTing the stored payload to the schedule's target URL (global fetch, AbortController 5s). Every fire is recorded into an in-memory execution log (capped at 200) and exposed via GET /api/missions/schedule/executions.  Crash-proof by construction: the tick is fully wrapped in try/catch and never throws; individual executions are awaited with a trailing .catch so a single bad schedule can never take down the loop.

## Endpoints

| Method | Path |
|--------|------|
| GET | `/api/missions/schedule/executions` |

---

_Auto-generated from source. Edit the module to change behaviour._
