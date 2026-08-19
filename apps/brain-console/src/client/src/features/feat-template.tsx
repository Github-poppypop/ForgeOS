// TEMPLATE FEATURE -- safe to delete. Demonstrates the self-contained feature contract.
// Copy this file to features/feat-<name>.tsx and edit; it will auto-appear in the sidebar
// and route dispatch with NO edits to App.tsx or server.ts.
// Note: this project uses the automatic JSX runtime, so you do NOT import React.
// Import hooks directly, e.g. `import { useState } from 'react';`.
export default {
  path: '/feature/template',
  label: 'Template Feature',
  category: 'Features',
  component: function TemplateFeature() {
    return (
      <div className="panel">
        <h2 className="section-header">Template Feature</h2>
        <p className="subtitle">Self-contained feature module -- replace me.</p>
        <div className="card">
          <p>Edit <code>features/feat-template.tsx</code> to build your feature.</p>
        </div>
      </div>
    );
  },
};
