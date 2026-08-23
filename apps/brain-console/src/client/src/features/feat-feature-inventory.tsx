// Feature Inventory — surfaces the live auto-discovered feature registry so an
// operator can see exactly which panels are loaded into the console at build time.
// Distinct from System Health (which probes live endpoints): this lists the
// discovered FEATURES surface itself. Purely client-side, no backend required.
// Auto-registers through the features glob — no edits to App.tsx or server.ts,
// so it cannot collide with parallel waves on the VPS.
// Note: this project uses the automatic JSX runtime, so React is not imported.
import { FEATURES } from './registry';

interface Group {
  title: string;
  items: { label: string; path: string }[];
}

function groupByCategory(): Group[] {
  const map = new Map<string, { label: string; path: string }[]>();
  for (const f of FEATURES) {
    const cat = f.category || 'Features';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push({ label: f.label, path: f.path });
  }
  return Array.from(map.entries())
    .map(([title, items]) => ({ title, items }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export default {
  path: '/feature/registry',
  label: 'Feature Inventory',
  category: 'Observability',
  component: function FeatureInventory() {
    const groups = groupByCategory();
    const total = FEATURES.length;

    return (
      <div className="panel">
        <h2 className="section-header">Feature Inventory</h2>
        <p className="subtitle">
          Every panel the console discovered at build time via the features glob. Use this
          to confirm what is actually loaded (versus what the docs claim shipped).
        </p>

        <div className="row" style={{ gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
          <span className="pill ok">{total} loaded</span>
          <span className="muted">{groups.length} categories</span>
        </div>

        {total === 0 ? (
          <div className="card" style={{ marginTop: '12px' }}>
            <p className="muted">
              No features discovered — the features glob found nothing. Check that
              <code> features/feat-*.tsx </code> files exist and export a{' '}
              <code>FeatureModule</code>.
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <div className="card" key={g.title} style={{ marginTop: '14px' }}>
              <h3 className="section-header" style={{ fontSize: '15px' }}>
                {g.title} <span className="muted">({g.items.length})</span>
              </h3>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Route</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((it) => (
                      <tr key={it.path}>
                        <td>{it.label}</td>
                        <td>
                          <code>{it.path}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    );
  },
};
