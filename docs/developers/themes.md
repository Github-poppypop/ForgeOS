# Developer Guide — Themes

**Owner:** CMO · **Status:** Draft  
**Purpose:** Skin the Brain Console SPA with custom color palettes and typography.

---

## How theming works

The SPA is a hand-rolled Bun-served SPA (no framework). All theme values are
CSS custom properties on `:root`. The active theme is stored in
`localStorage.forgeos-theme` and applied by swapping the `data-theme` attribute
on `<html>`.

---

## Theme manifest

Create a theme directory under `themes/<slug>/` with a `theme.json`:

```json
{
  "id": "forgeos-theme-midnight",
  "name": "Midnight",
  "version": "1.0.0",
  "author": "cmo/cmo",
  "description": "High-contrast dark theme for night ops.",
  "entry": "./midnight.css",
  "preview": "./preview.png",
  "colors": {
    "bg-primary": "#0f172a",
    "bg-panel": "#1e293b",
    "text-primary": "#f8fafc",
    "text-secondary": "#94a3b8",
    "accent": "#38bdf8",
    "accent-hover": "#7dd3fc",
    "border": "#334155",
    "success": "#22c55e",
    "warning": "#f59e0b",
    "danger": "#ef4444"
  },
  "typography": {
    "fontFamily": "Inter, system-ui, sans-serif",
    "mono": "JetBrains Mono, monospace"
  }
}
```

### Supported CSS custom properties

| Variable | Purpose | Default |
|----------|---------|---------|
| `--bg-primary` | App background | `#0f172a` |
| `--bg-panel` | Panel/card background | `#1e293b` |
| `--text-primary` | Headings + body | `#f8fafc` |
| `--text-secondary` | Muted text | `#94a3b8` |
| `--accent` | Links, active states | `#38bdf8` |
| `--accent-hover` | Hover states | `#7dd3fc` |
| `--border` | Panel borders | `#334155` |
| `--success` | OK status | `#22c55e` |
| `--warning` | Warnings | `#f59e0b` |
| `--danger` | Errors | `#ef4444` |

---

## CSS entry file

Your `entry` CSS should set the properties on `[data-theme="<id>"]`:

```css
[data-theme="forgeos-theme-midnight"] {
  --bg-primary: #0f172a;
  --bg-panel: #1e293b;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --accent: #38bdf8;
  --accent-hover: #7dd3fc;
  --border: #334155;
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
  font-family: "Inter", system-ui, sans-serif;
}
```

---

## Loading a theme

1. Drop the theme directory into `themes/`.
2. Restart the console (or add a `/api/themes` endpoint to hot-load).
3. Select the theme in Settings → Appearance.

The SPA reads the active theme at boot and injects the corresponding CSS file
into the page.

---

## Accessibility

- Ensure contrast ratio ≥ 4.5:1 for body text (WCAG AA).
- Provide a `preview.png` (1200×800) for the theme picker.
- Do not remove focus rings or reduce motion without a user toggle.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Theme not appearing | Check `theme.json` is valid JSON and `entry` path is correct. |
| Flash of wrong theme | The SPA reads `localStorage` before paint; if missing, it defaults to `forgeos-theme-default`. |
| Contrast too low | Use the browser DevTools contrast checker and bump `--text-secondary`. |
| Fonts not loading | Ensure web-safe fallbacks are listed in `typography.fontFamily`. |
