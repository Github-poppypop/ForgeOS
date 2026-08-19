// API Reference feature — conflict-free. Auto-appears in the sidebar / command
// palette with NO edits to App.tsx or server.ts. Links to the live, CSP-safe
// /api/docs viewer (no iframe — CSP frame-ancestors:'none' blocks embedding).
// Note: this project uses the automatic JSX runtime, so you do NOT import React.
export default {
  path: '/feature/api-docs',
  label: 'API Reference',
  category: 'Developer',
  component: function ApiDocsFeature() {
    return (
      <div className="panel">
        <h2 className="section-header">API Reference</h2>
        <p className="subtitle">The full REST surface, published live from openapi.json.</p>
        <div className="card">
          <p>
            <a className="link" href="/api/docs" target="_blank" rel="noreferrer">
              Open the searchable API Reference &rarr;
            </a>
          </p>
          <ul className="muted" style={{ lineHeight: 1.7 }}>
            <li><code>/api/docs</code> &mdash; human-readable reference (rendered in-app)</li>
            <li><code>/api/openapi.json</code> &mdash; raw OpenAPI 3 document</li>
            <li><code>/api/openapi</code> &mdash; router-derived endpoint map</li>
          </ul>
        </div>
      </div>
    );
  },
};
