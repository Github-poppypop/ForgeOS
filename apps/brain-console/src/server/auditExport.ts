import { readdirSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface AuditEntry {
  ts: string;
  method: string;
  path: string;
  status: number;
  ms: number;
  ip: string;
}

function coerceEntry(raw: unknown): AuditEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown): number => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const str = (v: unknown): string => (v == null ? '' : String(v));
  return {
    ts: str(r.ts),
    method: str(r.method),
    path: str(r.path),
    status: num(r.status),
    ms: num(r.ms),
    ip: str(r.ip),
  };
}

// Matches the daily-rotated structured request logs written by server.ts
// (forgeos-YYYY-MM-DD.log) plus any explicit JSON/JSONL dumps.
function isLogFileName(name: string): boolean {
  return (
    /^forgeos-\d{4}-\d{2}-\d{2}\.log$/.test(name) ||
    name.endsWith('.json') ||
    name.endsWith('.jsonl')
  );
}

export async function readAuditLog(logDir = 'logs'): Promise<AuditEntry[]> {
  const dir = resolve(logDir);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => isLogFileName(f));
  const entries: AuditEntry[] = [];
  for (const file of files) {
    const content = readFileSync(resolve(dir, file), 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const entry = coerceEntry(item);
            if (entry) entries.push(entry);
          }
        } else {
          const entry = coerceEntry(parsed);
          if (entry) entries.push(entry);
        }
      } catch {
        // skip unparseable line
      }
    }
  }
  return entries;
}

export type AuditFormat = 'csv' | 'json' | 'sql';

function csvCell(value: string): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_COLUMNS: (keyof AuditEntry)[] = ['ts', 'method', 'path', 'status', 'ms', 'ip'];

export function toCsv(entries: AuditEntry[]): string {
  const header = CSV_COLUMNS.join(',');
  if (entries.length === 0) return `${header}\n`;
  const rows = entries.map((e) =>
    CSV_COLUMNS.map((c) => csvCell(String(e[c]))).join(',')
  );
  return [header, ...rows].join('\n') + '\n';
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

export function toSql(entries: AuditEntry[]): string {
  const header =
    'CREATE TABLE IF NOT EXISTS audit_log(ts TEXT, method TEXT, path TEXT, status INTEGER, ms INTEGER, ip TEXT);\n';
  if (entries.length === 0) {
    return header;
  }
  const inserts = entries
    .map(
      (e) =>
        `INSERT INTO audit_log VALUES ('${escapeSql(e.ts)}', '${escapeSql(
          e.method
        )}', '${escapeSql(e.path)}', ${e.status}, ${e.ms}, '${escapeSql(
          e.ip
        )}');`
    )
    .join('\n');
  return header + inserts + '\n';
}

export function toJson(entries: AuditEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

export async function exportAudit(
  format: AuditFormat,
  logDir?: string
): Promise<string> {
  const entries = await readAuditLog(logDir);
  if (format === 'sql') return toSql(entries);
  if (format === 'csv') return toCsv(entries);
  return toJson(entries);
}
