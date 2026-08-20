// Reading List feature — closes Batch D #34 (semantic bookmarking + reading-list
// capture). Conflict-free: auto-registers through the features glob, so it needs
// NO edits to App.tsx / server.ts and cannot collide with parallel waves.
// Bookmarks are captured client-side in localStorage (mock-first, no backend
// dependency) with title, url, note, and tags, and can be exported to CSV or
// imported from JSON. Server-side persistence can layer on later behind the same
// UI by wiring a feat-*.ts endpoint.
// Uses the automatic JSX runtime, so React is not imported.
import { useEffect, useRef, useState } from 'react';

interface Bookmark {
  id: string;
  url: string;
  title: string;
  note: string;
  tags: string[];
  createdAt: string;
}

const STORE_KEY = 'forgeos.readinglist.v1';

function load(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Bookmark[]) : [];
  } catch {
    return [];
  }
}

function save(list: Bookmark[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota errors */
  }
}

function downloadCsv(rows: Bookmark[]): void {
  if (!rows.length) return;
  const esc = (v: string): string =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = [
    ['title', 'url', 'note', 'tags', 'createdAt'].join(','),
    ...rows.map((b) =>
      [b.title, b.url, b.note, b.tags.join('|'), b.createdAt].map(esc).join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'reading-list.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default {
  path: '/feature/reading-list',
  label: 'Reading List',
  category: 'Knowledge',
  component: function ReadingListPanel() {
    const [items, setItems] = useState<Bookmark[]>([]);
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');
    const [note, setNote] = useState('');
    const [tagsText, setTagsText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      setItems(load());
    }, []);

    function persist(next: Bookmark[]): void {
      setItems(next);
      save(next);
    }

    function add(): void {
      const u = url.trim();
      if (!u) {
        setError('URL or page path is required (e.g. /feature/sse or https://…).');
        return;
      }
      const bm: Bookmark = {
        id: 'bm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        url: u,
        title: title.trim() || u,
        note: note.trim(),
        tags: tagsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        createdAt: new Date().toISOString(),
      };
      persist([bm, ...items]);
      setUrl('');
      setTitle('');
      setNote('');
      setTagsText('');
      setError(null);
    }

    function remove(id: string): void {
      persist(items.filter((b) => b.id !== id));
    }

    function importJson(file: File): void {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const arr = Array.isArray(parsed)
            ? parsed
            : ((parsed as { bookmarks?: Bookmark[] }).bookmarks ?? []);
          const clean = (arr as Bookmark[]).filter(
            (b) => b && typeof b.url === 'string'
          );
          persist([...clean, ...items]);
          setError(null);
        } catch {
          setError('Could not parse JSON file.');
        }
      };
      reader.readAsText(file);
    }

    return (
      <div className="card">
        <div className="section-header">
          <h2>Reading List</h2>
          <span className="subtitle">{items.length} bookmark(s) · Batch D #34</span>
        </div>

        <p className="muted mt-2">
          Capture pages, RFCs, and references to read later. Stored locally in your
          browser (no server required) and exportable to CSV or importable from JSON.
        </p>

        <div className="row gap-2 mt-2 wrap items-center">
          <input
            className="input"
            style={{ flex: '2 1 240px' }}
            placeholder="URL or page path (e.g. /feature/sse)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="URL or page path"
          />
          <input
            className="input"
            style={{ flex: '2 1 200px' }}
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Title"
          />
        </div>
        <div className="row gap-2 mt-2 wrap items-center">
          <input
            className="input"
            style={{ flex: '2 1 200px' }}
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Note"
          />
          <input
            className="input"
            style={{ flex: '1 1 160px' }}
            placeholder="Tags (comma-separated)"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            aria-label="Tags"
          />
          <button className="btn secondary" onClick={add}>
            Add bookmark
          </button>
          <button
            className="btn secondary"
            onClick={() => downloadCsv(items)}
            disabled={items.length === 0}
          >
            Export CSV
          </button>
          <button className="btn secondary" onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = '';
            }}
          />
        </div>
        {error && (
          <p className="muted mt-2" role="alert">
            {error}
          </p>
        )}

        <div className="table-wrap mt-3">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Link</th>
                <th>Tags</th>
                <th>Note</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id}>
                  <td>{b.title}</td>
                  <td>
                    <a href={b.url} target="_blank" rel="noreferrer">
                      {b.url}
                    </a>
                  </td>
                  <td className="muted">{b.tags.join(', ')}</td>
                  <td className="muted">{b.note}</td>
                  <td className="muted">{b.createdAt.slice(0, 10)}</td>
                  <td>
                    <button className="btn secondary" onClick={() => remove(b.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    No bookmarks yet. Add a page above to start your reading list.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
};
