import { useEffect, useMemo, useState } from 'react';

type Route =
  | '#/dashboard'
  | '#/roles'
  | '#/page/:slug'
  | '#/search'
  | '#/capture'
  | '#/decisions'
  | '#/timeline'
  | '#/ledger'
  | '#/missions'
  | '#/mcp'
  | '#/vault'
  | '#/vaultfile/:file'
  | '#/embed'
  | '#/federation'
  | '#/audit'
  | '#/schema'
  | '#/config'
  | '#/command'
  | '#/governance'
  | '#/monitoring'
  | '#/workflows'
  | '#/marketplace'
  | '#/plugins'
  | '#/plugins/:name/manifest'
  | '#/projects'
  | '#/settings'
  | '#/wizard'
  | '#/poolleague'
  | '#/monitoring/processes'
  | '#/settings/ports'
  | '#/settings/reload'
  | '#/governance/sacred'
  | '#/governance/amendments'
  | '#/monitoring/heartbeat'
  | '#/monitoring/memory'
  | '#/webhooks';

const ROUTES: { href: string; label: string; title: string }[] = [
  { href: '#/dashboard', label: 'Status', title: 'Dashboard' },
  { href: '#/roles', label: 'Roles', title: 'Roles' },
  { href: '#/search', label: 'Search', title: 'Semantic Search' },
  { href: '#/capture', label: 'Capture', title: 'Capture Page' },
  { href: '#/decisions', label: 'Decisions', title: 'Decisions / Incidents' },
  { href: '#/timeline', label: 'Timeline', title: 'Timeline Engine' },
  { href: '#/ledger', label: 'Ledger', title: 'Decision Ledger' },
  { href: '#/missions', label: 'Missions', title: 'Mission Center' },
  { href: '#/mcp', label: 'MCP', title: 'MCP / Agent Tools' },
  { href: '#/vault', label: 'Vault', title: 'Vault' },
  { href: '#/embed', label: 'Embed', title: 'Embedding Admin' },
  { href: '#/federation', label: 'Federation', title: 'Federation' },
  { href: '#/audit', label: 'Audit', title: 'Audit Trail' },
  { href: '#/schema', label: 'Schema', title: 'Schema Pack' },
  { href: '#/config', label: 'Config', title: 'Environment' },
  { href: '#/command', label: 'Command', title: 'Command Center' },
  { href: '#/governance', label: 'Governance', title: 'Governance' },
  { href: '#/monitoring', label: 'Monitoring', title: 'Monitoring' },
  { href: '#/workflows', label: 'Workflows', title: 'Workflows' },
  { href: '#/marketplace', label: 'Marketplace', title: 'Marketplace' },
  { href: '#/plugins', label: 'Plugins', title: 'Plugins' },
  { href: '#/projects', label: 'Projects', title: 'Projects' },
  { href: '#/settings', label: 'Settings', title: 'Settings' },
  { href: '#/poolleague', label: 'PoolLeague', title: 'PoolLeague' },
  { href: '#/webhooks', label: 'Webhooks', title: 'Webhooks' },
];

function useHash() {
  const [hash, setHash] = useState(() => location.hash || '#/dashboard');
  useEffect(() => {
    const onHashChange = () => setHash(location.hash || '#/dashboard');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return hash;
}

function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="crumb" aria-label="Breadcrumb">
      {items.map((item, idx) => (
        <span key={idx}>
          {item.href ? (
            <a href={item.href}>{item.label}</a>
          ) : (
            <span>{item.label}</span>
          )}
          {idx < items.length - 1 && <span className="crumb-sep"> › </span>}
        </span>
      ))}
    </nav>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <h1>{title}</h1>
      <div className="panel-body">{children}</div>
    </div>
  );
}

function Pill({ children, tone = '' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function Button({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`btn ${props.className || ''}`.trim()}>
      {children}
    </button>
  );
}

function toItem(input: RequestInit | unknown): RequestInit {
  return input as RequestInit;
}

function statusPill(status?: string) {
  const s = (status || '').toLowerCase();
  if (s === 'ok' || s === 'approved') return 'ok';
  if (s === 'down' || s === 'rejected' || s === 'failed' || s === 'error') return 'bad';
  if (s === 'degraded' || s === 'pending' || s === 'review' || s === 'proposed') return 'warn';
  return '';
}

async function safe<T>(fn: () => Promise<T>, tries = 2): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) { last = e; if (i < tries - 1) await new Promise(r => setTimeout(r, 600)); }
  }
  throw last;
}

function useQuery() {
  const hash = useHash();
  const qs = useMemo(() => new URLSearchParams((hash.split('?')[1] || '')), [hash]);
  return { hash, qs };
}

function Dashboard() {
  const [status, setStatus] = useState<any>(null);
  const [roles, setRoles] = useState<any>(null);
  useEffect(() => {
    safe(() => api.get('/api/status')).then(setStatus).catch(() => {});
    safe(() => api.get('/api/roles')).then(setRoles).catch(() => {});
  }, []);
  const health = status?.gbrain_health?.status === 'ok';
  return (
    <Panel title="Brain Console">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Console' }]} />
      <div className="row" style={{ marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <Pill tone={health ? 'ok' : 'bad'}>{health ? 'brain ok' : 'brain down'}</Pill>
        <Pill>{status?.embedding_model || '—'}</Pill>
      </div>
      <div className="grid cols-3">
        <Card title="Isolation">{status?.isolation || '—'}</Card>
        <Card title="Roles seeded">{(roles?.roles || []).filter((r: any) => r.exists).length}/7</Card>
        <Card title="Console port">{status?.console_port || '—'}</Card>
      </div>
    </Panel>
  );
}

function Roles() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/roles')).then(setData).catch(() => {}); }, []);
  const list = data?.roles || [];
  return (
    <Panel title="C-Suite Roles">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Roles' }]} />
      <div className="grid cols-2">
        {list.map((r: any) => (
          <Card key={r.slug} title={r.role || r.slug}>
            <p className="muted mono">{r.slug}</p>
            <p className="muted">reports_to: {r.reports_to || '—'}</p>
          </Card>
        ))}
      </div>
    </Panel>
  );
}

function Search() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const run = async () => {
    if (!q.trim()) return;
    const r = await safe(() => api.get(`/api/search?q=${encodeURIComponent(q)}`)).catch(() => ({ raw: '' }));
    setResults((r.raw || '').split('\n').filter(Boolean));
  };
  return (
    <Panel title="Semantic Search">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Search' }]} />
      <div className="row" style={{ gap: 8 }}>
        <input className="mono" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
        <Button onClick={run}>Search</Button>
      </div>
      <div style={{ marginTop: 16 }}>
        {results.map((line, i) => (
          <Card key={i} title={line.slice(0, 80)}>{line}</Card>
        ))}
      </div>
    </Panel>
  );
}

function Capture() {
  const [slug, setSlug] = useState('decisions/demo');
  const [type, setType] = useState('note');
  const [body, setBody] = useState('# Demo\nWrite something for the brain.');
  const [status, setStatus] = useState<string | null>(null);
  const save = async () => {
    const r = await safe(() => api.post('/api/capture', { slug, type, body })).catch((e: any) => ({ error: String(e) }));
    setStatus(r.error || 'saved');
  };
  return (
    <Panel title="Capture Page">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Capture' }]} />
      <div className="card">
        <div className="row"><label>slug</label><input className="mono" value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
        <div className="row" style={{ marginTop: 8 }}><label>type</label><input value={type} onChange={(e) => setType(e.target.value)} /></div>
        <textarea rows={8} style={{ width: '100%', marginTop: 8 }} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="row" style={{ marginTop: 8, gap: 8 }}>
          <Button onClick={save}>Capture</Button>
          {status && <span className="muted">{status}</span>}
        </div>
      </div>
    </Panel>
  );
}

function Decisions() {
  const [ledger, setLedger] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/ledger')).then(setLedger).catch(() => {}); }, []);
  const entries = Array.isArray(ledger?.ledger) ? ledger.ledger : [];
  return (
    <Panel title="Decisions & Incidents">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/command' }, { label: 'Decisions / Incidents' }]} />
      <div className="card">
        <table className="tbl">
          <thead><tr><th>Date</th><th>Title</th><th>Type</th><th>Outcome</th></tr></thead>
          <tbody>
            {entries.map((e: any, i: number) => (
              <tr key={i}>
                <td className="mono">{e.date}</td>
                <td>{e.title}</td>
                <td><span className="pill">{e.type}</span></td>
                <td><span className={`pill ${statusPill(e.outcome)}`}>{e.outcome}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Timeline() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/timeline')).then(setData).catch(() => {}); }, []);
  const items = Array.isArray(data?.timeline) ? data.timeline : [];
  return (
    <Panel title="Timeline Engine">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/command' }, { label: 'Timeline' }]} />
      <div className="timeline">
        {items.map((item: any, i: number) => (
          <div key={i} className={`tl-item ${item.status === 'done' ? 'done' : item.status === 'in-progress' ? 'active' : ''}`}>
            <div className="tl-date">{item.date}</div>
            <div className="tl-body">
              <div className="tl-title">{item.title}</div>
              <div className="tl-meta">{item.owner} · <span className={`pill ${statusPill(item.status)}`}>{item.status}</span></div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Ledger() {
  const [ledger, setLedger] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/ledger')).then(setLedger).catch(() => {}); }, []);
  const entries = Array.isArray(ledger?.ledger) ? ledger.ledger : [];
  return (
    <Panel title="Decision Ledger">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/command' }, { label: 'Decision Ledger' }]} />
      <div className="card">
        <table className="tbl">
          <thead><tr><th>Date</th><th>Title</th><th>Type</th><th>Outcome</th></tr></thead>
          <tbody>
            {entries.map((e: any, i: number) => (
              <tr key={i}>
                <td className="mono">{e.date}</td>
                <td>{e.title}</td>
                <td><span className="pill">{e.type}</span></td>
                <td><span className={`pill ${statusPill(e.outcome)}`}>{e.outcome}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Missions() {
  const [missions, setMissions] = useState<any[]>([]);
  useEffect(() => { safe(() => api.get('/api/missions')).then((r: any) => setMissions(r.missions || [])).catch(() => {}); }, []);
  return (
    <Panel title="Mission Center">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/command' }, { label: 'Missions' }]} />
      <div className="card">
        <table className="tbl">
          <thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Progress</th></tr></thead>
          <tbody>
            {missions.map((m) => (
              <tr key={m.id}>
                <td className="mono">{m.id}</td>
                <td>{m.title}</td>
                <td><span className={`pill ${statusPill(m.status)}`}>{m.status}</span></td>
                <td>{m.progress}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function MCP() {
  const [mcp, setMcp] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/mcp')).then(setMcp).catch(() => {}); }, []);
  return (
    <Panel title="MCP / Agent Tools">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'MCP' }]} />
      <Card title="MCP Connection"><pre className="code json">{JSON.stringify(mcp || {}, null, 2)}</pre></Card>
    </Panel>
  );
}

function Vault() {
  const [vault, setVault] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/vault')).then(setVault).catch(() => {}); }, []);
  const files = vault?.files || [];
  return (
    <Panel title="Obsidian Vault Sync">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Vault' }]} />
      <div className="card">
        {files.map((f: string) => (
          <div key={f} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <a className="link mono" href={`#/vaultfile/${encodeURIComponent(f)}`}>{f}</a>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function VaultFile({ file }: { file: string }) {
  const [body, setBody] = useState('');
  useEffect(() => {
    safe(() => api.get(`/api/vault/file?path=${encodeURIComponent(file)}`)).then((r: any) => setBody(r.body || r.content || '')).catch(() => {});
  }, [file]);
  return (
    <Panel title={file}>
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Vault', href: '#/vault' }, { label: file }]} />
      <textarea rows={16} style={{ width: '100%' }} value={body} onChange={(e) => setBody(e.target.value)} />
    </Panel>
  );
}

function Embed() {
  const [out, setOut] = useState('');
  const reembed = async () => {
    const r = await safe(() => api.post('/api/embed', {})).catch((e: any) => ({ out: '', err: String(e) }));
    setOut((r.out || '') + '\n' + (r.err || ''));
  };
  return (
    <Panel title="Embedding Admin">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Embeddings' }]} />
      <Button onClick={reembed}>Re-embed all</Button>
      <pre className="code json" style={{ marginTop: 12 }}>{out}</pre>
    </Panel>
  );
}

function Federation() {
  const [fed, setFed] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/federation')).then(setFed).catch(() => {}); }, []);
  const children = fed?.children || [];
  return (
    <Panel title="Brain Federation">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Federation' }]} />
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Pill>Root: {fed?.root_status || '—'}</Pill>
        <Pill>{children.length} children</Pill>
      </div>
      <div className="grid cols-3" style={{ marginTop: 12 }}>
        {children.map((c: any, i: number) => (
          <Card key={i} title={c.name || 'child'}>
            <p className="muted">status: {c.status}</p>
            <p className="muted">latency: {c.latency}</p>
          </Card>
        ))}
      </div>
    </Panel>
  );
}

function Audit() {
  const [audit, setAudit] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/audit')).then(setAudit).catch(() => {}); }, []);
  const rows = (audit?.raw || '').split('\n').filter(Boolean);
  return (
    <Panel title="Audit Trail">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Audit' }]} />
      <div className="card">
        {rows.map((row: string, i: number) => (
          <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>{row}</div>
        ))}
      </div>
    </Panel>
  );
}

function Schema() {
  const [schema, setSchema] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/schema')).then(setSchema).catch(() => {}); }, []);
  return (
    <Panel title="Schema Pack">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Schema' }]} />
      <Card title="Active"><pre className="code json">{schema?.active || '—'}</pre></Card>
      <Card title="Page types"><pre className="code json">{schema?.types || '—'}</pre></Card>
    </Panel>
  );
}

function Config() {
  const [status, setStatus] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/status')).then(setStatus).catch(() => {}); }, []);
  return (
    <Panel title="Environment">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Config' }]} />
      <Card title="System">
        <p className="muted">GBRAIN_HOME = {status?.gbrain_home || '—'}</p>
        <p className="muted">Ollama = {status?.ollama ? 'on' : 'off'}</p>
        <p className="muted">Auth = {status?.auth ? 'enabled' : 'disabled'}</p>
      </Card>
    </Panel>
  );
}

function Command() {
  return (
    <Panel title="Command Center">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/command' }, { label: 'Command Center' }]} />
      <Card title="Mission">
        <p>Current Mission: RFC-0000</p>
        <p className="muted">Constitution & Platform Evolution</p>
      </Card>
      <Card title="Actions">
        <div className="row" style={{ gap: 8 }}>
          <a className="btn primary" href="#/governance">Open Governance</a>
          <a className="btn secondary" href="#/decisions">Decisions</a>
        </div>
      </Card>
    </Panel>
  );
}

function Governance() {
  const [gov, setGov] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/governance')).then(setGov).catch(() => {}); }, []);
  const sections = gov?.tree || {};
  return (
    <Panel title="Governance">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/command' }, { label: 'Governance' }]} />
      <div className="grid cols-3">
        {Object.keys(sections).map((key) => (
          <Card key={key} title={key}>
            {(sections[key] || []).map((f: string, i: number) => (
              <div key={i} className="link" style={{ padding: '4px 0' }}>{f}</div>
            ))}
          </Card>
        ))}
      </div>
    </Panel>
  );
}

function Monitoring() {
  const [agents, setAgents] = useState<any>(null);
  const [compliance, setCompliance] = useState<any>(null);
  useEffect(() => {
    safe(() => api.get('/api/monitoring/agents')).then(setAgents).catch(() => {});
    safe(() => api.get('/api/compliance')).then(setCompliance).catch(() => {});
  }, []);
  return (
    <Panel title="Monitoring">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Monitoring' }]} />
      <div className="grid cols-2">
        <Card title="Agents"><pre className="code json">{JSON.stringify(agents || {}, null, 2)}</pre></Card>
        <Card title="Compliance"><pre className="code json">{JSON.stringify(compliance || {}, null, 2)}</pre></Card>
      </div>
    </Panel>
  );
}

function Workflows() {
  const [wf, setWf] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/workflows')).then(setWf).catch(() => {}); }, []);
  return (
    <Panel title="Workflows">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Workflows' }]} />
      <pre className="code json">{JSON.stringify(wf || {}, null, 2)}</pre>
    </Panel>
  );
}

function Marketplace() {
  const [pkgs, setPkgs] = useState<any[]>([]);
  useEffect(() => { safe(() => api.get('/api/marketplace')).then((r: any) => setPkgs(r.packages || [])).catch(() => {}); }, []);
  return (
    <Panel title="Marketplace">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Marketplace' }]} />
      <div className="grid cols-2">
        {pkgs.map((p) => (
          <Card key={p.name} title={p.name}>
            <p className="muted">v{p.version || '—'}</p>
          </Card>
        ))}
      </div>
    </Panel>
  );
}

function Plugins() {
  const [plugins, setPlugins] = useState<any[]>([]);
  useEffect(() => { safe(() => api.get('/api/plugins')).then((r: any) => setPlugins(r.plugins || [])).catch(() => {}); }, []);
  return (
    <Panel title="Plugins">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Plugins' }]} />
      <div className="grid cols-2">
        {plugins.map((p) => (
          <Card key={p.id || p.name} title={p.name}>
            <Pill tone={p.active === false ? 'warn' : 'ok'}>{p.active === false ? 'inactive' : 'active'}</Pill>
          </Card>
        ))}
      </div>
    </Panel>
  );
}

function Projects() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    try { setItems(JSON.parse(localStorage.getItem('forgeos-work-items') || '[]')); }
    catch {}
  }, []);
  return (
    <Panel title="Projects">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Projects' }]} />
      <div className="grid cols-4">
        {['todo', 'in-progress', 'review', 'done'].map((status) => (
          <Card key={status} title={status.replace('-', ' ')}>
            {items.filter((i) => i.status === status).map((i) => (
              <div key={i.id} className="card" style={{ marginTop: 8 }}>
                <strong>{i.title}</strong>
                <p className="muted mono">{i.assignee}</p>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </Panel>
  );
}

function Settings() {
  const [theme, setTheme] = useState(localStorage.getItem('forgeos-theme') || 'system');
  return (
    <Panel title="Settings">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Settings' }]} />
      <Card title="Preferences">
        <div className="row" style={{ gap: 8 }}>
          <label>Theme</label>
          <select value={theme} onChange={(e) => { setTheme(e.target.value); localStorage.setItem('forgeos-theme', e.target.value); }}>
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="hc">High contrast</option>
          </select>
        </div>
      </Card>
    </Panel>
  );
}

function Wizard() {
  return (
    <Panel title="Setup Wizard">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Setup Wizard' }]} />
      <Card title="Welcome">This wizard will guide you through initial configuration.</Card>
    </Panel>
  );
}

function PoolLeague() {
  const [status, setStatus] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/poolleague/status')).then(setStatus).catch(() => {}); }, []);
  return (
    <Panel title="PoolLeague">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'PoolLeague' }]} />
      <Card title="Backend"><pre className="code json">{JSON.stringify(status || {}, null, 2)}</pre></Card>
    </Panel>
  );
}

function Webhooks() {
  const [webhooks, setWebhooks] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/webhooks')).then(setWebhooks).catch(() => {}); }, []);
  const list = webhooks?.webhooks || [];
  return (
    <Panel title="Webhooks">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Webhooks' }]} />
      <div className="card">
        {list.map((w: any, i: number) => (
          <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <strong>{w.url}</strong>
              <Pill tone={w.active ? 'ok' : 'warn'}>{w.active ? 'active' : 'paused'}</Pill>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function App() {
  const hash = useHash();
  const base = hash.split('?')[0].split('/')[1] || 'dashboard';
  const file = decodeURIComponent(hash.split('/vaultfile/')[1] || '');

  let panel: React.ReactNode = null;
  if (hash.startsWith('#/page/')) panel = <Page slug={hash.slice(7)} />;
  else if (hash.startsWith('#/vaultfile/')) panel = <VaultFile file={file} />;
  else if (hash.startsWith('#/plugins/') && hash.endsWith('/manifest')) panel = <PluginManifest name={hash.split('/')[2]} />;
  else if (hash.startsWith('#/governance/sacred')) panel = <SacredLock />;
  else if (hash.startsWith('#/governance/amendments')) panel = <Amendments />;
  else if (hash.startsWith('#/monitoring/heartbeat')) panel = <AgentHeartbeat />;
  else if (hash.startsWith('#/monitoring/memory')) panel = <MemoryPool />;
  else if (hash.startsWith('#/monitoring/processes')) panel = <ProcessSupervisor />;
  else if (hash.startsWith('#/settings/ports')) panel = <PortConflicts />;
  else if (hash.startsWith('#/settings/reload')) panel = <Reload />;
  else if (hash.startsWith('#/settings')) panel = <Settings />;
  else if (hash.startsWith('#/wizard')) panel = <Wizard />;
  else {
    switch (base) {
      case 'dashboard': panel = <Dashboard />; break;
      case 'roles': panel = <Roles />; break;
      case 'search': panel = <Search />; break;
      case 'capture': panel = <Capture />; break;
      case 'decisions': panel = <Decisions />; break;
      case 'timeline': panel = <Timeline />; break;
      case 'ledger': panel = <Ledger />; break;
      case 'missions': panel = <Missions />; break;
      case 'mcp': panel = <MCP />; break;
      case 'vault': panel = <Vault />; break;
      case 'embed': panel = <Embed />; break;
      case 'federation': panel = <Federation />; break;
      case 'audit': panel = <Audit />; break;
      case 'schema': panel = <Schema />; break;
      case 'config': panel = <Config />; break;
      case 'command': panel = <Command />; break;
      case 'governance': panel = <Governance />; break;
      case 'monitoring': panel = <Monitoring />; break;
      case 'workflows': panel = <Workflows />; break;
      case 'marketplace': panel = <Marketplace />; break;
      case 'plugins': panel = <Plugins />; break;
      case 'projects': panel = <Projects />; break;
      case 'poolleague': panel = <PoolLeague />; break;
      case 'webhooks': panel = <Webhooks />; break;
      default: panel = <Dashboard />;
    }
  }

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">ForgeOS Console</div>
        <div className="nav">
          {ROUTES.map((r) => (
            <a key={r.href} href={r.href} className={`nav-link ${hash === r.href ? 'active' : ''}`} title={r.title}>
              {r.label}
            </a>
          ))}
        </div>
      </nav>
      <main className="main">
        <div className="topbar">
          <div className="brand-mobile">ForgeOS Console</div>
          <div className="topbar-actions">
            <span className="pill">React/Express</span>
          </div>
        </div>
        <div className="content">{panel}</div>
      </main>
    </div>
  );
}

function Page({ slug }: { slug: string }) {
  const [page, setPage] = useState<any>(null);
  useEffect(() => {
    safe(() => api.get(`/api/page/${encodeURIComponent(slug)}`)).then(setPage).catch(() => {});
  }, [slug]);
  return (
    <Panel title={slug}>
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Roles', href: '#/roles' }, { label: slug }]} />
      <pre className="code json">{page?.body || 'loading...'}</pre>
    </Panel>
  );
}

function PluginManifest({ name }: { name: string }) {
  const [manifest, setManifest] = useState<any>(null);
  useEffect(() => { safe(() => api.get(`/api/plugins/${encodeURIComponent(name)}/manifest`)).then(setManifest).catch(() => {}); }, [name]);
  return (
    <Panel title={`${name} manifest`}>
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/dashboard' }, { label: 'Plugins', href: '#/plugins' }, { label: name }]} />
      <pre className="code json">{JSON.stringify(manifest || {}, null, 2)}</pre>
    </Panel>
  );
}

function SacredLock() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/sacred')).then(setData).catch(() => {}); }, []);
  return (
    <Panel title="Sacred Folder Lock">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/command' }, { label: 'Governance', href: '#/governance' }, { label: 'Sacred Lock' }]} />
      <pre className="code json">{JSON.stringify(data || {}, null, 2)}</pre>
    </Panel>
  );
}

function Amendments() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/amendments')).then(setData).catch(() => {}); }, []);
  return (
    <Panel title="Amendments">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/command' }, { label: 'Governance', href: '#/governance' }, { label: 'Amendments' }]} />
      <pre className="code json">{JSON.stringify(data || {}, null, 2)}</pre>
    </Panel>
  );
}

function AgentHeartbeat() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    safe(() => api.get('/api/agent/heartbeat')).then(setData).catch(() => {});
    const t = setInterval(() => safe(() => api.get('/api/agent/heartbeat')).then(setData).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <Panel title="Agent Heartbeat">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/monitoring' }, { label: 'Agent Heartbeat' }]} />
      <pre className="code json">{JSON.stringify(data || {}, null, 2)}</pre>
    </Panel>
  );
}

function MemoryPool() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    safe(() => api.get('/api/memory/pool')).then(setData).catch(() => {});
    const t = setInterval(() => safe(() => api.get('/api/memory/pool')).then(setData).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <Panel title="Agent Memory Pool">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/monitoring' }, { label: 'Memory Pool' }]} />
      <pre className="code json">{JSON.stringify(data || {}, null, 2)}</pre>
    </Panel>
  );
}

function ProcessSupervisor() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/processes')).then(setData).catch(() => {}); }, []);
  return (
    <Panel title="Process Supervisor">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/settings' }, { label: 'Processes' }]} />
      <pre className="code json">{JSON.stringify(data || {}, null, 2)}</pre>
    </Panel>
  );
}

function PortConflicts() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { safe(() => api.get('/api/ports')).then(setData).catch(() => {}); }, []);
  return (
    <Panel title="Port Conflict Prevention">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/settings' }, { label: 'Port Conflicts' }]} />
      <pre className="code json">{JSON.stringify(data || {}, null, 2)}</pre>
    </Panel>
  );
}

function Reload() {
  return (
    <Panel title="SPA Hot Reload">
      <Breadcrumb items={[{ label: 'ForgeOS', href: '#/settings' }, { label: 'SPA Reload' }]} />
      <Card title="Actions">
        <div className="grid cols-2">
          <Button onClick={() => api.post('/api/bust-sw', {})}>Bust cache & reload</Button>
          <Button onClick={() => api.post('/api/embed', {})}>Re-embed all</Button>
          <Button onClick={() => { localStorage.removeItem('brainConsoleOfflineQueue'); }}>Clear offline queue</Button>
          <Button onClick={() => api.post('/api/log/clear', {})}>Clear request log</Button>
        </div>
      </Card>
    </Panel>
  );
}

export default App;
