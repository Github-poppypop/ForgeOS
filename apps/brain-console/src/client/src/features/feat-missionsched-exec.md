# feat-missionsched-exec (client)

> Client feature — `src/client/src/features/feat-missionsched-exec.tsx`

**Mounts at:** `/feature/mission-scheduler-exec` · **Label:** Scheduler Executions · **Category:** Features

Mission Scheduler Executions feature — conflict-free. Auto-appears in the sidebar / command palette with NO edits to App.tsx or server.ts. Shows the configured scheduled jobs (with last-run / next-run) and a live table of recent execution attempts pulled from the server executor. Uses the automatic JSX runtime, so React is not imported; hooks are imported directly.

## API calls

- `/api/missions/schedule`
- `/api/missions/schedule/executions`

---

_Auto-generated from source. Edit the module to change behaviour._
