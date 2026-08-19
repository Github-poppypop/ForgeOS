// Keyboard Shortcuts cheatsheet — persistent, browsable, searchable reference.
// Complements the ephemeral `?` overlay with an always-available panel that
// also documents the Ctrl/Cmd+K command palette (missing from the overlay list).
// Auto-registers through the features glob — no App.tsx / server.ts edits.

import { useState } from 'react';

type Shortcut = { keys: string; action: string; group: string; desc: string };

const SHORTCUTS: Shortcut[] = [
  { keys: '?', action: 'Show shortcuts overlay', group: 'Global', desc: 'Open the quick shortcuts overlay' },
  { keys: 'Ctrl / Cmd + K', action: 'Command palette', group: 'Global', desc: 'Fuzzy-jump to any panel or action' },
  { keys: 'Esc', action: 'Close', group: 'Global', desc: 'Dismiss dialogs, overlays, and menus' },
  { keys: 'd', action: 'Dashboard', group: 'Navigate', desc: 'Go to the dashboard' },
  { keys: 'r', action: 'Roles', group: 'Navigate', desc: 'Go to roles' },
  { keys: 's', action: 'Search', group: 'Navigate', desc: 'Go to search' },
  { keys: 'c', action: 'Capture', group: 'Navigate', desc: 'Go to capture' },
  { keys: 'a', action: 'Apps', group: 'Navigate', desc: 'Go to the app store' },
];

export default {
  path: '/feature/keyboard-shortcuts',
  label: 'Keyboard Shortcuts',
  category: 'Help',
  component: function KeyboardShortcuts() {
    const [q, setQ] = useState('');
    const query = q.trim().toLowerCase();
    const groups = Array.from(new Set(SHORTCUTS.map((s) => s.group)));
    const filtered = SHORTCUTS.filter(
      (s) =>
        !query ||
        s.action.toLowerCase().includes(query) ||
        s.keys.toLowerCase().includes(query) ||
        s.group.toLowerCase().includes(query) ||
        s.desc.toLowerCase().includes(query),
    );
    return (
      <div className="panel">
        <h2 className="section-header">Keyboard Shortcuts</h2>
        <p className="subtitle">
          Press <span className="kbd">?</span> anywhere for the quick overlay, or{' '}
          <span className="kbd">Ctrl</span>/<span className="kbd">Cmd</span> +{' '}
          <span className="kbd">K</span> to open the command palette.
        </p>
        <div className="card">
          <input
            className="input"
            type="search"
            placeholder="Filter shortcuts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Filter shortcuts"
          />
          {filtered.length === 0 ? (
            <p className="muted" style={{ marginTop: 12 }}>
              No shortcuts match “{q}”.
            </p>
          ) : (
            groups.map((g) => {
              const rows = filtered.filter((s) => s.group === g);
              if (rows.length === 0) return null;
              return (
                <div key={g} style={{ marginTop: 16 }}>
                  <h3 className="section-subheader">{g}</h3>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Keys</th>
                        <th>Action</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => (
                        <tr key={s.keys + s.action}>
                          <td className="mono" style={{ width: 190 }}>
                            <span className="kbd">{s.keys}</span>
                          </td>
                          <td>{s.action}</td>
                          <td className="muted">{s.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  },
};
