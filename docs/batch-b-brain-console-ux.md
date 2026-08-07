# Batch B — Brain Console UX + Data Panels (Enhancements 11–20)

## 11. Saved Views/Filters
- Add `localStorage` key `forgeos-saved-views` storing `{ missions: {}, vault: {}, audit: {} }`
- Add a `Saved views` dropdown in each table toolbar
- Wire Apply/Clear buttons to filter table rows by saved column sets

## 12. Command Palette Fuzzy Search
- Add `Cmd+K` / `Ctrl+K` listener in `app.js`
- Render `#cmd-palette` overlay with fuzzy-matched panels/actions
- Source list: `KNOWN` routes + CMD_TIPS entries

## 13. Batch Actions
- Add checkboxes to missions/decisions/audit table headers
- Add batch action bar: Archive, Export, Delete, Assign
- Wire to new `/api/batch` endpoint in `server.ts`

## 14. Export CSV
- Add `Export CSV` button to vault/audit/missions toolbars
- Serialize visible rows to CSV with `data:text/csv` download

## 15. Inline Decision Edit
- Replace `prompt()` edit with inline `contenteditable` field
- Debounce save to `/api/capture` with 500ms delay
- Show revert toast on failure

## 16. Time-Travel Diff Viewer
- Add `renderDiff(leftSlug, rightSlug)` panel
- Use simple line-diff algorithm on raw markdown
- Render in `#diff-view` with old/new highlighting

## 17. Keyboard Shortcuts Cheatsheet
- Add `?` key handler showing `#shortcuts-overlay`
- List all panel shortcuts and command-palette shortcut
- Persist custom shortcuts in `localStorage`

## 18. Offline Mode Queue
- Detect `navigator.onLine` changes
- Queue failed API calls in `IndexedDB` or memory array
- Replay queue on `online` event with backoff

## 19. Panel Resize + Column Reorder
- Add drag handles on table headers
- Store column order in `localStorage`
- Debounce resize events to avoid layout thrash

## 20. Right-Click Context Menus
- Add `contextmenu` listener on table rows
- Render native-style menu with: Edit, Duplicate, Archive, Delete
- Close on outside click or `Escape`
