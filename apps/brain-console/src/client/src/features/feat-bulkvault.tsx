import { useEffect, useState } from 'react';
import { ContextMenu, type CtxItem } from '../panelkit';

interface VaultItem {
  id: number;
  kind: string;
  name: string;
  updated?: string;
  metadata?: Record<string, unknown>;
}

interface VaultListResponse {
  items: VaultItem[];
  encrypted?: boolean;
}

interface BulkResponse {
  ok?: boolean;
  deleted?: number;
  exported?: number;
  items?: VaultItem[];
  error?: string;
}

export default {
  path: '/feature/bulk-vault',
  label: 'Bulk Vault',
  category: 'Knowledge',
  component: BulkVaultPanel,
};

function BulkVaultPanel() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [menu, setMenu] = useState<{ x: number; y: number; item: VaultItem } | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    try {
      const r = await fetch('/api/vault');
      const data = (await r.json()) as VaultListResponse;
      setItems(data.items ?? []);
    } catch {
      setMsg('Failed to load vault');
    }
  }

  function toggle(id: number): void {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function run(action: 'delete' | 'export'): Promise<void> {
    const ids = [...selected];
    if (!ids.length) {
      setMsg('Select at least one item');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/vault/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      });
      const data = (await r.json()) as BulkResponse;
      if (!r.ok) {
        setMsg('Error: ' + (data.error ?? String(r.status)));
        return;
      }
      if (action === 'delete') {
        setMsg(`Deleted ${data.deleted ?? 0} item(s)`);
        setSelected(new Set());
        await load();
      } else {
        const blob = new Blob([JSON.stringify(data.items ?? [], null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vault-export.json';
        a.click();
        URL.revokeObjectURL(url);
        setMsg(`Exported ${data.exported ?? 0} item(s)`);
      }
    } catch {
      setMsg('Request failed');
    } finally {
      setBusy(false);
    }
  }

  function contextMenuItems(item: VaultItem): CtxItem[] {
    return [
      {
        label: selected.has(item.id) ? 'Deselect row' : 'Select row',
        onClick: () => toggle(item.id),
      },
      {
        label: 'Copy item ID',
        onClick: () => {
          void navigator.clipboard?.writeText(String(item.id));
        },
      },
      {
        label: 'Export row (JSON)',
        onClick: () => {
          const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `vault-${item.id}.json`;
          a.click();
          URL.revokeObjectURL(url);
        },
      },
      {
        label: 'Delete row',
        danger: true,
        onClick: () => void deleteRow(item.id),
      },
    ];
  }

  async function deleteRow(id: number): Promise<void> {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/vault/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids: [id] }),
      });
      const data = (await r.json()) as BulkResponse;
      if (!r.ok) {
        setMsg('Error: ' + (data.error ?? String(r.status)));
        return;
      }
      setMsg(`Deleted ${data.deleted ?? 0} item(s)`);
      setSelected((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      await load();
    } catch {
      setMsg('Request failed');
    } finally {
      setBusy(false);
      setMenu(null);
    }
  }

  return (
    <div className="card">
      <div className="section-header">
        <h2>Bulk Vault actions</h2>
        <span className="subtitle">{items.length} items · {selected.size} selected</span>
      </div>
      <div className="row gap-2 mt-2 wrap items-center">
        <button className="btn secondary" disabled={busy || selected.size === 0} onClick={() => void run('delete')}>
          Delete selected
        </button>
        <button className="btn secondary" disabled={busy || selected.size === 0} onClick={() => void run('export')}>
          Export selected
        </button>
        <span className="muted">{msg}</span>
      </div>
      <div className="table-wrap mt-3">
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Kind</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr
                key={it.id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, item: it });
                }}
              >
                <td>
                  <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} aria-label={`Select ${it.name}`} />
                </td>
                <td>{it.name}</td>
                <td>{it.kind}</td>
                <td>{it.updated ?? '—'}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">No vault items.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={contextMenuItems(menu.item)}
        />
      )}
    </div>
  );
}
