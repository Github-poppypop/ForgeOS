// Shared Workspaces feature — conflict-free. Auto-appears in the sidebar /
// command palette with NO edits to App.tsx or server.ts. Lets an operator
// create a workspace, join it with an agent name, post activity to the shared
// feed, and watch the live feed (polled every 4s). Reuses table-wrap/card/tag.
// Automatic JSX runtime: do NOT import React.
import { useEffect, useRef, useState } from 'react';

interface Member {
  name: string;
  joinedAt: string;
}

interface FeedEntry {
  ts: string;
  agent: string;
  text: string;
}

interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  members: Member[];
}

export default {
  path: '/feature/workspaces',
  label: 'Shared Workspaces',
  category: 'Features',
  component: function WorkspacesFeature() {
    const [list, setList] = useState<Workspace[]>([]);
    const [created, setCreated] = useState<Workspace | null>(null);
    const [name, setName] = useState('');
    const [createError, setCreateError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const [agent, setAgent] = useState('');
    const [joinError, setJoinError] = useState<string | null>(null);
    const [joining, setJoining] = useState(false);

    const [activity, setActivity] = useState('');
    const [posting, setPosting] = useState(false);
    const [postError, setPostError] = useState<string | null>(null);

    const [feed, setFeed] = useState<FeedEntry[]>([]);
    const [feedError, setFeedError] = useState<string | null>(null);
    const pollRef = useRef<number | null>(null);

    function refreshList() {
      fetch('/api/workspaces')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
        .then((d: { workspaces: Workspace[] }) => setList(d.workspaces))
        .catch(() => setList([]));
    }

    useEffect(() => {
      refreshList();
      return () => {
        if (pollRef.current !== null) window.clearInterval(pollRef.current);
      };
    }, []);

    // Start/stop feed polling when the selected workspace changes.
    useEffect(() => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (!created) {
        setFeed([]);
        setFeedError(null);
        return;
      }
      const wsId = created.id;
      function loadFeed() {
        fetch('/api/workspaces/' + wsId + '/feed')
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
          .then((d: { feed: FeedEntry[] }) => {
            setFeed(d.feed);
            setFeedError(null);
          })
          .catch((e: Error) => setFeedError(e.message));
      }
      loadFeed();
      pollRef.current = window.setInterval(loadFeed, 4000);
      return () => {
        if (pollRef.current !== null) window.clearInterval(pollRef.current);
        pollRef.current = null;
      };
    }, [created]);

    function create() {
      if (!name.trim()) {
        setCreateError('Workspace name is required');
        return;
      }
      setCreating(true);
      setCreateError(null);
      fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
        .then(async (r) => {
          const d = (await r.json()) as { ok: boolean; workspace?: Workspace; error?: string };
          if (!r.ok || !d.workspace) {
            setCreateError(d.error || 'Failed to create workspace');
            setCreating(false);
            return;
          }
          setCreated(d.workspace);
          setName('');
          setCreating(false);
          refreshList();
        })
        .catch((e: Error) => {
          setCreateError(e.message);
          setCreating(false);
        });
    }

    function join(action: 'join' | 'leave') {
      if (!created) return;
      if (!agent.trim()) {
        setJoinError('Agent name is required');
        return;
      }
      setJoining(true);
      setJoinError(null);
      fetch('/api/workspaces/' + created.id + '/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: agent.trim(), action }),
      })
        .then(async (r) => {
          const d = (await r.json()) as { ok: boolean; members?: Member[]; error?: string };
          if (!r.ok) {
            setJoinError(d.error || 'Failed to update membership');
            setJoining(false);
            return;
          }
          setCreated({ ...created, members: d.members ?? created.members });
          setJoining(false);
        })
        .catch((e: Error) => {
          setJoinError(e.message);
          setJoining(false);
        });
    }

    function postActivity() {
      if (!created) return;
      if (!agent.trim()) {
        setPostError('Set an agent name first');
        return;
      }
      if (!activity.trim()) {
        setPostError('Activity text is required');
        return;
      }
      setPosting(true);
      setPostError(null);
      fetch('/api/workspaces/' + created.id + '/feed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent: agent.trim(), text: activity.trim() }),
      })
        .then(async (r) => {
          const d = (await r.json()) as { ok: boolean; error?: string };
          if (!r.ok) {
            setPostError(d.error || 'Failed to post activity');
            setPosting(false);
            return;
          }
          setActivity('');
          setPosting(false);
        })
        .catch((e: Error) => {
          setPostError(e.message);
          setPosting(false);
        });
    }

    return (
      <div className="panel">
        <h2 className="section-header">Shared Workspaces</h2>
        <p className="subtitle">
          Spin up a shared workspace, let agents join as members, and watch the live multi-agent
          activity feed. In-memory mock store — resets when the server restarts.
        </p>

        <div className="card">
          <label className="label" htmlFor="ws-name">
            New workspace name
          </label>
          <input
            id="ws-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q3 Launch War Room"
          />
          {createError ? (
            <div className="muted" style={{ color: 'var(--danger)', marginTop: '8px' }}>
              {createError}
            </div>
          ) : null}
          <div className="row" style={{ marginTop: '12px' }}>
            <button className="btn btn-primary" onClick={create} disabled={creating}>
              {creating ? 'Creating…' : 'Create workspace'}
            </button>
          </div>
        </div>

        {!created ? (
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>Available workspaces</strong>
              <span className="muted">{list.length}</span>
            </div>
            {list.length === 0 ? (
              <p className="muted" style={{ marginTop: '8px' }}>
                No workspaces yet. Create one above to start collaborating.
              </p>
            ) : (
              <div className="table-wrap" style={{ marginTop: '10px' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Members</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((w) => (
                      <tr key={w.id}>
                        <td>{w.name}</td>
                        <td>
                          <span className="tag">{w.members.length}</span>
                        </td>
                        <td className="muted">{w.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="stack stack-md">
            <div className="card">
              <div className="row" style={{ justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div>
                  <strong>{created.name}</strong>
                  <div className="muted" style={{ marginTop: '4px' }}>
                    {created.id}
                  </div>
                </div>
                <span className="tag info">{created.members.length} members</span>
              </div>
              <div className="row" style={{ marginTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <input
                  className="input"
                  style={{ width: '220px' }}
                  value={agent}
                  onChange={(e) => setAgent(e.target.value)}
                  placeholder="Agent name (e.g. Scout-7)"
                />
                <button className="btn btn-sm" onClick={() => join('join')} disabled={joining}>
                  Join
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => join('leave')} disabled={joining}>
                  Leave
                </button>
              </div>
              {joinError ? (
                <div className="muted" style={{ color: 'var(--danger)', marginTop: '8px' }}>
                  {joinError}
                </div>
              ) : null}

              <div className="table-wrap" style={{ marginTop: '14px' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {created.members.length === 0 ? (
                      <tr>
                        <td className="muted" colSpan={2}>
                          No agents have joined yet.
                        </td>
                      </tr>
                    ) : (
                      created.members.map((m) => (
                        <tr key={m.name}>
                          <td>
                            <span className="tag success">{m.name}</span>
                          </td>
                          <td className="muted">{m.joinedAt}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <label className="label" htmlFor="ws-activity">
                Post activity
              </label>
              <input
                id="ws-activity"
                className="input"
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                placeholder="What did this agent just do?"
              />
              {postError ? (
                <div className="muted" style={{ color: 'var(--danger)', marginTop: '8px' }}>
                  {postError}
                </div>
              ) : null}
              <div className="row" style={{ marginTop: '12px' }}>
                <button className="btn btn-primary" onClick={postActivity} disabled={posting}>
                  {posting ? 'Posting…' : 'Post activity'}
                </button>
                <span className="muted">Live feed refreshes every 4s</span>
              </div>
            </div>

            <div className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>Live feed</strong>
                <span className="muted">{feed.length}</span>
              </div>
              {feedError ? (
                <div className="muted" style={{ color: 'var(--danger)', marginTop: '8px' }}>
                  Feed error: {feedError}
                </div>
              ) : feed.length === 0 ? (
                <p className="muted" style={{ marginTop: '8px' }}>
                  No activity yet. Post something above to see it here.
                </p>
              ) : (
                <div className="table-wrap" style={{ marginTop: '10px' }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Agent</th>
                        <th>Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feed.map((f, i) => (
                        <tr key={f.ts + '-' + i}>
                          <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                            {f.ts}
                          </td>
                          <td>
                            <span className="tag info">{f.agent}</span>
                          </td>
                          <td>{f.text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
};
