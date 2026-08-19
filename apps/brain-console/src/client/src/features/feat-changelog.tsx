// What's New / Changelog feature — conflict-free. Auto-appears in the sidebar /
// command palette with NO edits to App.tsx or server.ts. Pulls /api/changelog
// (the project CHANGELOG.md parsed into structured releases) and renders it.
// Note: this project uses the automatic JSX runtime, so you do NOT import React.
import { useEffect, useState } from 'react';

interface ChangelogNote {
  type: string;
  notes: string[];
}
interface ChangelogRelease {
  version: string;
  date?: string;
  sections: ChangelogNote[];
}
interface ChangelogData {
  releases: ChangelogRelease[];
  markdown: string;
}

export default {
  path: '/feature/changelog',
  label: "What's New",
  category: 'About',
  component: function ChangelogFeature() {
    const [data, setData] = useState<ChangelogData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      fetch('/api/changelog')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
        .then((d: ChangelogData) => {
          if (!cancelled) {
            setData(d);
            setLoading(false);
          }
        })
        .catch((e: Error) => {
          if (!cancelled) {
            setError(e.message);
            setLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }, []);

    return (
      <div className="panel">
        <h2 className="section-header">What's New</h2>
        <p className="subtitle">Notable changes shipped to ForgeOS — parsed live from CHANGELOG.md.</p>
        {loading ? (
          <div className="card">
            <p className="muted">Loading changelog…</p>
          </div>
        ) : error ? (
          <div className="card error">
            <p className="muted">Failed to load changelog: {error}</p>
          </div>
        ) : !data || data.releases.length === 0 ? (
          <div className="card">
            <p className="muted">No changelog entries found.</p>
          </div>
        ) : (
          <div className="changelog-list">
            {data.releases.map((rel) => (
              <section key={rel.version} className="card changelog-release">
                <header className="changelog-release-head">
                  <h3 className="changelog-version">{rel.version}</h3>
                  {rel.date ? <span className="pill muted">{rel.date}</span> : null}
                </header>
                {rel.sections.map((sec, i) => (
                  <div key={`${sec.type}-${i}`} className="changelog-section">
                    <div className="changelog-type">{sec.type}</div>
                    <ul className="changelog-notes">
                      {sec.notes.map((n, j) => (
                        <li key={j}>{n}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    );
  },
};
