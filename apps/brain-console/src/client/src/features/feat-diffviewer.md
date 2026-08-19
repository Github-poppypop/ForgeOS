# feat-diffviewer (client)

> Client feature — `src/client/src/features/feat-diffviewer.tsx`

**Mounts at:** `/feature/diff-viewer` · **Label:** Page Diff Viewer · **Category:** Knowledge

Page Diff Viewer — Batch B enhancement #16 (Time-Travel / Diff Viewer). Self-contained conflict-free feature: compares the `body` of any two knowledge pages (by slug) via the existing GET /api/page/:slug endpoint and renders a line-level diff. Auto-appears in the sidebar / command palette (no App.tsx edits). Note: this project uses the automatic JSX runtime, so React is not imported.

---

_Auto-generated from source. Edit the module to change behaviour._
