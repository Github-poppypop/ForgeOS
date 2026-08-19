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

export async function readAuditLog(logDir = 'logs'): Promise<AuditEntry[]> {
  const dir = resolve(logDir);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter(
    (f) => f.endsWith('.json') || f.endsWith('.jsonl')
  );
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
  format: 'sql' | 'json',
  logDir?: string
): Promise<string> {
  const entries = await readAuditLog(logDir);
  return format === 'sql' ? toSql(entries) : toJson(entries);
}
