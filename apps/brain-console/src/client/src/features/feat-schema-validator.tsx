// Agent Output Schema Validator — addresses next-50 #24 (Structured agent output
// schema validation) on the CLIENT side, mock-first (no backend dependency).
// Self-contained: auto-registers through the features glob, so it needs NO edits to
// App.tsx / registry.ts and cannot collide with parallel waves. The user pastes a
// JSON agent output and validates it against a selectable schema (Agent Task Result,
// Decision Record, Incident Report), surfacing missing/required fields and type
// mismatches. A server-side enforcement layer (#24 backend) can layer on later.
// Uses the automatic JSX runtime, so React is not imported.
import { useMemo, useState } from 'react';

type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

interface FieldSpec {
  name: string;
  type: FieldType;
  required: boolean;
}

interface Schema {
  id: string;
  label: string;
  fields: FieldSpec[];
}

export const SCHEMAS: Schema[] = [
  {
    id: 'task-result',
    label: 'Agent Task Result',
    fields: [
      { name: 'id', type: 'string', required: true },
      { name: 'agent', type: 'string', required: true },
      { name: 'status', type: 'string', required: true },
      { name: 'output', type: 'string', required: true },
      { name: 'timestamp', type: 'string', required: true },
    ],
  },
  {
    id: 'decision-record',
    label: 'Decision Record',
    fields: [
      { name: 'id', type: 'string', required: true },
      { name: 'title', type: 'string', required: true },
      { name: 'status', type: 'string', required: true },
      { name: 'decidedBy', type: 'string', required: true },
      { name: 'createdAt', type: 'string', required: true },
    ],
  },
  {
    id: 'incident-report',
    label: 'Incident Report',
    fields: [
      { name: 'id', type: 'string', required: true },
      { name: 'severity', type: 'string', required: true },
      { name: 'summary', type: 'string', required: true },
      { name: 'raisedAt', type: 'string', required: true },
    ],
  },
];

interface ValidationIssue {
  field: string;
  message: string;
}

export function validate(data: unknown, schema: Schema): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return [{ field: '(root)', message: 'Expected a JSON object.' }];
  }
  const obj = data as Record<string, unknown>;
  for (const f of schema.fields) {
    const value = obj[f.name];
    if (value === undefined || value === null) {
      if (f.required) {
        issues.push({ field: f.name, message: `Missing required field "${f.name}".` });
      }
      continue;
    }
    const actual: string = Array.isArray(value) ? 'array' : typeof value;
    if (actual !== f.type) {
      issues.push({
        field: f.name,
        message: `Field "${f.name}" should be type ${f.type}, got ${actual}.`,
      });
    }
  }
  return issues;
}

const SAMPLES: Record<string, string> = {
  'task-result':
    '{\n  "id": "task_001",\n  "agent": "researcher",\n  "status": "completed",\n  "output": "Summary text",\n  "timestamp": "2026-08-20T12:00:00Z"\n}',
  'decision-record':
    '{\n  "id": "dec_001",\n  "title": "Adopt Postgres",\n  "status": "ratified",\n  "decidedBy": "CTO",\n  "createdAt": "2026-08-20T12:00:00Z"\n}',
  'incident-report':
    '{\n  "id": "inc_001",\n  "severity": "high",\n  "summary": "API latency spike",\n  "raisedAt": "2026-08-20T12:00:00Z"\n}',
};

export default {
  path: '/feature/schema-validator',
  label: 'Output Schema Validator',
  category: 'Agent Runtime',
  component: function SchemaValidatorPanel() {
    const [schemaId, setSchemaId] = useState(SCHEMAS[0].id);
    const [text, setText] = useState(SAMPLES[SCHEMAS[0].id]);
    const schema = useMemo(
      () => SCHEMAS.find((s) => s.id === schemaId) ?? SCHEMAS[0],
      [schemaId]
    );

    const result = useMemo(() => {
      const trimmed = text.trim();
      if (!trimmed) return { parseError: 'Input is empty.', issues: [] as ValidationIssue[] };
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        return {
          parseError: e instanceof Error ? e.message : String(e),
          issues: [] as ValidationIssue[],
        };
      }
      return { parseError: null, issues: validate(parsed, schema) };
    }, [text, schema]);

    const valid = !result.parseError && result.issues.length === 0;
    const requiredCount = schema.fields.filter((f) => f.required).length;

    return (
      <div className="panel">
        <h2 className="section-header">Output Schema Validator</h2>
        <p className="subtitle">
          Validate structured agent outputs against a known schema (next-50 #24). Mock-first — no
          backend required.
        </p>

        <div className="card">
          <label className="field-label" htmlFor="schema-select">
            Schema
          </label>
          <select
            id="schema-select"
            className="input select"
            value={schemaId}
            onChange={(e) => {
              setSchemaId(e.target.value);
              setText(SAMPLES[e.target.value]);
            }}
          >
            {SCHEMAS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <label className="field-label" htmlFor="json-input" style={{ marginTop: 12, display: 'block' }}>
            Agent output (JSON)
          </label>
          <textarea
            id="json-input"
            className="input"
            style={{
              width: '100%',
              minHeight: 200,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 13,
              resize: 'vertical',
            }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <button className="btn primary" onClick={() => setText(SAMPLES[schemaId])}>
              Load sample
            </button>
            {result.parseError ? (
              <span className="tag danger">Invalid JSON</span>
            ) : valid ? (
              <span className="tag success">Valid</span>
            ) : (
              <span className="tag danger">Invalid</span>
            )}
          </div>
        </div>

        {result.parseError ? (
          <div className="card" style={{ marginTop: 12, borderColor: 'var(--danger)' }}>
            <p style={{ color: 'var(--danger)', fontWeight: 600, margin: 0 }}>{result.parseError}</p>
          </div>
        ) : result.issues.length === 0 ? (
          <div className="card" style={{ marginTop: 12, borderColor: 'var(--success)' }}>
            <p style={{ color: 'var(--success)', fontWeight: 600, margin: 0 }}>
              Passed — all {requiredCount} required fields present and correctly typed.
            </p>
          </div>
        ) : (
          <div className="card" style={{ marginTop: 12, borderColor: 'var(--danger)' }}>
            <p className="empty-state-title" style={{ color: 'var(--danger)' }}>
              {result.issues.length} issue{result.issues.length === 1 ? '' : 's'} found
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-dim)' }}>
              {result.issues.map((iss, i) => (
                <li key={i}>
                  <code>{iss.field}</code>: {iss.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  },
};
